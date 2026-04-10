import { Router, type Request } from "express";
import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  files,
  fileDownloads,
  filePurchases,
  programEnrollments,
  fileUpdateSchema,
  type FileVisibility,
} from "@mhp/shared";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  createUploadMiddleware,
  generateSignedDownloadUrl,
  deleteFileFromStorage,
  isStorageConfigured,
} from "../services/storage.js";
import { queue } from "../services/notification.js";
import { db } from "../db.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import Stripe from "stripe";

const router = Router();

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-04-30.basil" as any });
}

// ============================================================================
// STRIPE WEBHOOK — no auth, signature-verified
// Must be BEFORE requireAuth so Stripe can reach it.
// ============================================================================

router.post("/webhook/stripe", async (req, res, next) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      res.status(500).json({ error: "Stripe non configuré." });
      return;
    }

    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      res.status(500).json({ error: "Webhook secret non configuré." });
      return;
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      res.status(400).json({ error: "Missing raw body." });
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch {
      res.status(400).json({ error: "Signature invalide." });
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata;

      if (meta?.type === "file_purchase" && meta.fileId && meta.userId) {
        const [file] = await db
          .select()
          .from(files)
          .where(eq(files.id, meta.fileId))
          .limit(1);

        if (!file) {
          logger.warn({ fileId: meta.fileId }, "Webhook: file not found");
          return res.json({ received: true });
        }

        const paidCents = session.amount_total ?? 0;
        const expectedCents = Math.round(parseFloat(file.price ?? "0") * 100);
        if (paidCents < expectedCents) {
          logger.error(
            { fileId: meta.fileId, paidCents, expectedCents, sessionId: session.id },
            "Webhook: payment amount mismatch — rejecting purchase"
          );
          return res.json({ received: true });
        }

        const [existing] = await db
          .select()
          .from(filePurchases)
          .where(
            and(
              eq(filePurchases.fileId, meta.fileId),
              eq(filePurchases.userId, meta.userId)
            )
          )
          .limit(1);

        if (!existing) {
          await db.insert(filePurchases).values({
            fileId: meta.fileId,
            userId: meta.userId,
            stripeSessionId: session.id,
            amountPaid: ((paidCents) / 100).toFixed(2),
            currency: (session.currency ?? "chf").toUpperCase(),
          });

          logger.info(
            { fileId: meta.fileId, userId: meta.userId },
            "File purchase recorded"
          );
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

router.get("/public", async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: files.id,
        title: files.title,
        description: files.description,
        category: files.category,
        fileName: files.fileName,
        fileSize: files.fileSize,
        mimeType: files.mimeType,
        downloadCount: files.downloadCount,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(eq(files.visibility, "public"))
      .orderBy(desc(files.createdAt));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/public/:id/download", async (req, res, next) => {
  try {
    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, req.params.id), eq(files.visibility, "public")))
      .limit(1);

    if (!file) throw new AppError("Fichier introuvable.", 404);

    await db
      .update(files)
      .set({ downloadCount: sql`${files.downloadCount} + 1` })
      .where(eq(files.id, file.id));

    await db.insert(fileDownloads).values({
      fileId: file.id,
      userId: null,
    });

    const url = await generateSignedDownloadUrl(file.fileKey, 600);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

router.use(requireAuth);

router.get("/my", async (req, res, next) => {
  try {
    const userId = req.session.userId!;
    const isAdmin = req.session.role === "admin";

    const allFiles = await db
      .select()
      .from(files)
      .orderBy(desc(files.createdAt));

    if (isAdmin) {
      const enriched = allFiles.map((f) => ({
        ...f,
        purchased: true,
        canDownload: true,
      }));
      res.json(enriched);
      return;
    }

    const enrollments = await db
      .select({ programCode: programEnrollments.programCode })
      .from(programEnrollments)
      .where(
        and(
          eq(programEnrollments.userId, userId),
          inArray(programEnrollments.status, ["active", "completed"])
        )
      );
    const enrolledCodes = new Set(enrollments.map((e) => e.programCode));

    const purchases = await db
      .select({ fileId: filePurchases.fileId })
      .from(filePurchases)
      .where(eq(filePurchases.userId, userId));
    const purchasedIds = new Set(purchases.map((p) => p.fileId));

    const accessible = allFiles
      .filter((f) => {
        if (f.visibility === "public") return true;
        if (f.visibility === "members") return true;
        if (f.visibility === "program") {
          return f.programCode ? enrolledCodes.has(f.programCode) : false;
        }
        if (f.visibility === "paid") return true;
        return false;
      })
      .map((f) => {
        const purchased =
          f.visibility !== "paid" || purchasedIds.has(f.id);
        return {
          ...f,
          purchased,
          canDownload: purchased,
        };
      });

    res.json(accessible);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/download", async (req, res, next) => {
  try {
    const userId = req.session.userId!;
    const isAdmin = req.session.role === "admin";

    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, req.params.id))
      .limit(1);

    if (!file) throw new AppError("Fichier introuvable.", 404);

    if (!isAdmin) {
      const hasAccess = await checkFileAccess(file, userId);
      if (!hasAccess) {
        throw new AppError("Accès refusé à ce fichier.", 403);
      }
    }

    await db
      .update(files)
      .set({ downloadCount: sql`${files.downloadCount} + 1` })
      .where(eq(files.id, file.id));

    await db.insert(fileDownloads).values({
      fileId: file.id,
      userId,
    });

    const url = await generateSignedDownloadUrl(file.fileKey, 600);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/purchase", async (req, res, next) => {
  try {
    const userId = req.session.userId!;

    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, req.params.id), eq(files.visibility, "paid")))
      .limit(1);

    if (!file) throw new AppError("Fichier introuvable ou non payant.", 404);
    if (!file.price) throw new AppError("Prix non défini.", 400);

    const [existing] = await db
      .select()
      .from(filePurchases)
      .where(
        and(
          eq(filePurchases.fileId, file.id),
          eq(filePurchases.userId, userId)
        )
      )
      .limit(1);

    if (existing) {
      res.json({ alreadyPurchased: true });
      return;
    }

    const stripe = getStripe();
    if (!stripe) throw new AppError("Stripe non configuré.", 500);

    const baseUrl =
      process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: (file.currency || "CHF").toLowerCase(),
            product_data: {
              name: file.title,
              description: file.description || undefined,
            },
            unit_amount: Math.round(parseFloat(file.price) * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        fileId: file.id,
        userId,
        type: "file_purchase",
      },
      success_url: `${baseUrl}/user/resources?purchased=${file.id}`,
      cancel_url: `${baseUrl}/user/resources?cancelled=true`,
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================

router.use(requireAdmin);

router.get("/admin", async (req, res, next) => {
  try {
    const { category, visibility, search } = req.query as {
      category?: string;
      visibility?: string;
      search?: string;
    };

    let rows = await db.select().from(files).orderBy(desc(files.createdAt));

    if (category) {
      rows = rows.filter((r) => r.category === category);
    }
    if (visibility) {
      rows = rows.filter((r) => r.visibility === visibility);
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.fileName.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q)
      );
    }

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/admin/stats", async (_req, res, next) => {
  try {
    const [totalFiles] = await db.select({ count: count() }).from(files);
    const [totalDownloads] = await db
      .select({ count: count() })
      .from(fileDownloads);
    const [totalPurchases] = await db
      .select({ count: count() })
      .from(filePurchases);

    res.json({
      totalFiles: totalFiles?.count ?? 0,
      totalDownloads: totalDownloads?.count ?? 0,
      totalPurchases: totalPurchases?.count ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/admin/:id/downloads", async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(fileDownloads)
      .where(eq(fileDownloads.fileId, req.params.id))
      .orderBy(desc(fileDownloads.downloadedAt))
      .limit(100);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/admin/upload", (req, res, next) => {
  if (!isStorageConfigured()) {
    res.status(500).json({
      error:
        "Stockage R2 non configuré. Veuillez configurer les variables d'environnement R2.",
    });
    return;
  }

  const upload = createUploadMiddleware();
  upload.single("file")(req, res, async (err) => {
    if (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors du téléchargement.";
      res.status(400).json({ error: message });
      return;
    }

    try {
      const file = req.file as Express.MulterS3.File;
      if (!file) {
        res.status(400).json({ error: "Aucun fichier fourni." });
        return;
      }

      const {
        title,
        description,
        category,
        programCode,
        visibility,
        price,
        currency,
      } = req.body as {
        title?: string;
        description?: string;
        category?: string;
        programCode?: string;
        visibility?: string;
        price?: string;
        currency?: string;
      };

      const vis = (visibility as FileVisibility) || "members";

      if (vis === "paid" && !price) {
        res
          .status(400)
          .json({ error: "Un prix est requis pour les fichiers payants." });
        return;
      }
      if (vis === "program" && !programCode) {
        res.status(400).json({
          error:
            "Un code programme est requis pour les fichiers liés à un programme.",
        });
        return;
      }

      const [inserted] = await db
        .insert(files)
        .values({
          title: title || file.originalname,
          description: description || null,
          category: category || null,
          programCode: programCode || null,
          visibility: vis,
          price: vis === "paid" ? price! : null,
          currency: currency || "CHF",
          fileKey: file.key,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.contentType || file.mimetype,
          uploadedBy: req.session.userId!,
        })
        .returning();

      logger.info(
        { fileId: inserted.id, fileKey: file.key },
        "File uploaded to R2"
      );

      res.status(201).json(inserted);
    } catch (uploadErr) {
      next(uploadErr);
    }
  });
});

router.patch("/admin/:id", async (req, res, next) => {
  try {
    const parsed = fileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Données invalides.", issues: parsed.error.issues });
      return;
    }

    const data = parsed.data;

    if (data.visibility === "paid" && data.price === null) {
      res
        .status(400)
        .json({ error: "Un prix est requis pour les fichiers payants." });
      return;
    }
    if (data.visibility === "program" && data.programCode === null) {
      res.status(400).json({
        error:
          "Un code programme est requis pour les fichiers liés à un programme.",
      });
      return;
    }

    if (data.visibility && data.visibility !== "paid") {
      data.price = null;
    }

    const [updated] = await db
      .update(files)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(files.id, req.params.id))
      .returning();

    if (!updated) throw new AppError("Fichier introuvable.", 404);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/admin/:id", async (req, res, next) => {
  try {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, req.params.id))
      .limit(1);

    if (!file) throw new AppError("Fichier introuvable.", 404);

    try {
      await deleteFileFromStorage(file.fileKey);
    } catch (err) {
      logger.error({ err, fileKey: file.fileKey }, "Failed to delete from R2");
    }

    await db.delete(files).where(eq(files.id, file.id));

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// HELPERS
// ============================================================================

async function checkFileAccess(
  file: typeof files.$inferSelect,
  userId: string
): Promise<boolean> {
  if (file.visibility === "public") return true;
  if (file.visibility === "members") return true;

  if (file.visibility === "program") {
    if (!file.programCode) return false;
    const [enrollment] = await db
      .select({ id: programEnrollments.id })
      .from(programEnrollments)
      .where(
        and(
          eq(programEnrollments.userId, userId),
          eq(programEnrollments.programCode, file.programCode),
          inArray(programEnrollments.status, ["active", "completed"])
        )
      )
      .limit(1);
    return !!enrollment;
  }

  if (file.visibility === "paid") {
    const [purchase] = await db
      .select({ id: filePurchases.id })
      .from(filePurchases)
      .where(
        and(
          eq(filePurchases.fileId, file.id),
          eq(filePurchases.userId, userId)
        )
      )
      .limit(1);
    return !!purchase;
  }

  return false;
}

export default router;
