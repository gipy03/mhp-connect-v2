import { Router, type Request } from "express";
import { eq, desc } from "drizzle-orm";
import {
  users,
  userProfiles,
  activityLogs,
  programEnrollments,
} from "@mhp/shared";
import { requireAdmin } from "../middleware/auth.js";
import { runIncrementalSync, runFullSync, getSyncStatus } from "../services/sync.js";
import {
  handleWebhook,
  verifyWebhookSignature,
  type AccredibleWebhookPayload,
} from "../services/accredible.js";
import { db } from "../db.js";
import { AppError } from "../lib/errors.js";

const router = Router();

// ---------------------------------------------------------------------------
// Accredible webhook — no auth, HMAC-SHA256 signature verified
// Must be defined BEFORE requireAdmin so it isn't gated.
// Raw body is available via req.rawBody (set by express.json verify callback).
// ---------------------------------------------------------------------------

router.post("/webhook/accredible", async (req, res, next) => {
  try {
    const secret = process.env.ACCREDIBLE_WEBHOOK_SECRET;
    if (!secret) {
      console.error("ACCREDIBLE_WEBHOOK_SECRET not configured");
      res.status(500).json({ error: "Webhook not configured." });
      return;
    }

    const signature =
      (req.headers["x-signature"] as string | undefined) ?? "";

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      res.status(400).json({ error: "Missing raw body." });
      return;
    }

    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      res.status(401).json({ error: "Invalid webhook signature." });
      return;
    }

    const payload = req.body as AccredibleWebhookPayload;
    const result = await handleWebhook(payload);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// All routes below this point require admin
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// Sync management
// ---------------------------------------------------------------------------

// GET /api/admin/sync
router.get("/sync", async (_req, res, next) => {
  try {
    const status = await getSyncStatus();
    res.json(status ?? { service: "digiforma", lastSyncAt: null, lastSyncStatus: null });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/sync/incremental
router.post("/sync/incremental", async (_req, res, next) => {
  try {
    const result = await runIncrementalSync();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/sync/full
router.post("/sync/full", async (_req, res, next) => {
  try {
    const result = await runFullSync();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

// GET /api/admin/users
router.get("/users", async (req, res, next) => {
  try {
    const { search, role } = req.query as {
      search?: string;
      role?: string;
    };

    let rows = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        profile: {
          firstName: userProfiles.firstName,
          lastName: userProfiles.lastName,
          city: userProfiles.city,
          directoryVisibility: userProfiles.directoryVisibility,
        },
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .orderBy(desc(users.createdAt));

    if (role) {
      rows = rows.filter((r) => r.role === role);
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.email.toLowerCase().includes(q) ||
          r.profile?.firstName?.toLowerCase().includes(q) ||
          r.profile?.lastName?.toLowerCase().includes(q)
      );
    }

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users/:id
router.get("/users/:id", async (req, res, next) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.params.id))
      .limit(1);

    if (!user) throw new AppError("Utilisateur introuvable.", 404);

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, req.params.id))
      .limit(1);

    res.json({ ...user, profile: profile ?? null });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users/:id/enrollments
router.get("/users/:id/enrollments", async (req, res, next) => {
  try {
    const enrollments = await db
      .select({
        id: programEnrollments.id,
        programCode: programEnrollments.programCode,
        status: programEnrollments.status,
        bexioDocumentNr: programEnrollments.bexioDocumentNr,
        bexioTotal: programEnrollments.bexioTotal,
        enrolledAt: programEnrollments.enrolledAt,
        cancelledAt: programEnrollments.cancelledAt,
      })
      .from(programEnrollments)
      .where(eq(programEnrollments.userId, req.params.id))
      .orderBy(desc(programEnrollments.enrolledAt));
    res.json(enrollments);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/role
router.patch("/users/:id/role", async (req, res, next) => {
  try {
    const { role } = req.body as { role: unknown };
    if (!["member", "admin"].includes(role as string)) {
      throw new AppError("`role` doit être 'member' ou 'admin'.", 400);
    }

    const [updated] = await db
      .update(users)
      .set({ role: role as string, updatedAt: new Date() })
      .where(eq(users.id, req.params.id))
      .returning({ id: users.id, email: users.email, role: users.role });

    if (!updated) throw new AppError("Utilisateur introuvable.", 404);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Activity logs
// ---------------------------------------------------------------------------

// GET /api/admin/activity-logs
router.get("/activity-logs", async (req, res, next) => {
  try {
    const { userId, limit: rawLimit } = req.query as {
      userId?: string;
      limit?: string;
    };

    const limit = Math.min(parseInt(rawLimit ?? "100", 10) || 100, 500);

    let query = db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);

    if (userId) {
      // Re-build with userId filter
      const logs = await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.userId, userId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);
      res.json(logs);
      return;
    }

    res.json(await query);
  } catch (err) {
    next(err);
  }
});

export default router;
