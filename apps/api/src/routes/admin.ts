import { Router, type Request } from "express";
import { and, count, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import {
  users,
  userProfiles,
  activityLogs,
  programEnrollments,
  sessionAssignments,
  accredibleCredentials,
  updateUserRoleSchema,
  updateUserRoleParamsSchema,
  accredibleWebhookSchema,
  type UserRole,
} from "@mhp/shared";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { runIncrementalSync, runFullSync, getSyncStatus, bulkImportTrainees, remapEnrollmentCodes, type SyncResult, type BulkImportResult, type RemapResult } from "../services/sync.js";
import {
  handleWebhook,
  verifyWebhookSignature,
  type AccredibleWebhookPayload,
} from "../services/accredible.js";
import {
  syncBexioContacts,
  syncBexioInvoices,
  runFullBexioSync,
} from "../services/bexio-sync.js";
import { geocodeAddress } from "@mhp/integrations/geocoding";
import { db } from "../db.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ---------------------------------------------------------------------------
// Accredible webhook — no auth, HMAC-SHA256 signature verified
// Must be defined BEFORE requireAdmin so it isn't gated.
// ---------------------------------------------------------------------------

router.post("/webhook/accredible", async (req, res, next) => {
  try {
    const secret = process.env.ACCREDIBLE_WEBHOOK_SECRET;
    if (!secret) {
      logger.error("ACCREDIBLE_WEBHOOK_SECRET not configured");
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

    const parsed = accredibleWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid webhook payload.", issues: parsed.error.issues });
      return;
    }

    const result = await handleWebhook(parsed.data as AccredibleWebhookPayload);
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Stop impersonation — authenticated (not admin-only, since admin is now
// logged in as the impersonated user)
// ---------------------------------------------------------------------------

router.post("/stop-impersonating", requireAuth, async (req, res, next) => {
  try {
    const adminId = req.session.impersonatedBy;
    if (!adminId) {
      res.status(400).json({ error: "Aucune session d'impersonation active." });
      return;
    }

    const [admin] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, adminId))
      .limit(1);

    if (!admin) throw new AppError("Session admin introuvable.", 404);

    if (admin.role !== "admin") {
      req.session.destroy(() => {});
      res.status(403).json({ error: "Le compte d'origine n'est plus administrateur." });
      return;
    }

    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve()))
    );

    req.session.userId = admin.id;
    req.session.role = admin.role as UserRole;

    res.json({ ok: true });
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
    const result: SyncResult = await runIncrementalSync();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/sync/full
router.post("/sync/full", async (_req, res, next) => {
  try {
    const result: SyncResult = await runFullSync();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/sync/import
router.post("/sync/import", async (_req, res, next) => {
  try {
    const result: BulkImportResult = await bulkImportTrainees();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/sync/remap-enrollments
router.post("/sync/remap-enrollments", async (_req, res, next) => {
  try {
    const result: RemapResult = await remapEnrollmentCodes();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/sync/bexio — full Bexio sync (contacts + invoices)
router.post("/sync/bexio", async (_req, res, next) => {
  try {
    const result = await runFullBexioSync();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/sync/bexio/contacts — sync Bexio contacts only
router.post("/sync/bexio/contacts", async (_req, res, next) => {
  try {
    const result = await syncBexioContacts();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/sync/bexio/invoices — sync Bexio invoices only
router.post("/sync/bexio/invoices", async (_req, res, next) => {
  try {
    const result = await syncBexioInvoices();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Geocoding backfill
// ---------------------------------------------------------------------------

// POST /api/admin/geocoding/backfill
// Geocodes all profiles that have a city but no lat/lng coordinates.
router.post("/geocoding/backfill", async (_req, res, next) => {
  try {
    const profiles = await db
      .select({
        id: userProfiles.id,
        userId: userProfiles.userId,
        roadAddress: userProfiles.roadAddress,
        cityCode: userProfiles.cityCode,
        city: userProfiles.city,
        country: userProfiles.country,
      })
      .from(userProfiles)
      .where(
        and(
          isNull(userProfiles.latitude),
          or(
            // has at least a city to geocode
            eq(userProfiles.city, userProfiles.city) // workaround: filter non-null city below
          )
        )
      );

    // Filter in JS: only process profiles that have at least a city
    const toGeocode = profiles.filter((p) => p.city || p.roadAddress);

    let updated = 0;
    let failed = 0;

    for (const profile of toGeocode) {
      try {
        const coords = await geocodeAddress(
          profile.roadAddress,
          profile.cityCode,
          profile.city,
          profile.country
        );
        if (coords) {
          await db
            .update(userProfiles)
            .set({ latitude: coords.latitude, longitude: coords.longitude, updatedAt: new Date() })
            .where(eq(userProfiles.id, profile.id));
          updated++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    res.json({ total: toGeocode.length, updated, failed });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/geocoding/status
// Returns count of profiles with/without geocoding.
router.get("/geocoding/status", async (_req, res, next) => {
  try {
    const [withCoords] = await db
      .select({ count: count() })
      .from(userProfiles)
      .where(and(
        // latitude IS NOT NULL — Drizzle uses isNull negation
        eq(userProfiles.directoryVisibility, userProfiles.directoryVisibility) // placeholder, filtered below
      ));

    const all = await db.select({ id: userProfiles.id, lat: userProfiles.latitude }).from(userProfiles);
    const geocoded = all.filter((p) => p.lat !== null).length;
    const total = all.length;
    const needsGeocode = all.filter((p) => p.lat === null).length;

    res.json({ total, geocoded, needsGeocode });
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
// Full detail: profile + enrollments (with session assignments) + credentials
router.get("/users/:id", async (req, res, next) => {
  try {
    const userId = req.params.id as string;

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new AppError("Utilisateur introuvable.", 404);

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    const enrollments = await db
      .select()
      .from(programEnrollments)
      .where(eq(programEnrollments.userId, userId))
      .orderBy(desc(programEnrollments.enrolledAt));

    // Attach session assignments for each enrollment
    const enrollmentIds = enrollments.map((e) => e.id);
    const allAssignments =
      enrollmentIds.length > 0
        ? await db
            .select()
            .from(sessionAssignments)
            .where(inArray(sessionAssignments.enrollmentId, enrollmentIds))
            .orderBy(desc(sessionAssignments.assignedAt))
        : [];

    // Filter assignments to their enrollment in JS
    const assignmentsByEnrollment = new Map<string, typeof allAssignments>();
    for (const a of allAssignments) {
      if (!enrollmentIds.includes(a.enrollmentId)) continue;
      if (!assignmentsByEnrollment.has(a.enrollmentId)) {
        assignmentsByEnrollment.set(a.enrollmentId, []);
      }
      assignmentsByEnrollment.get(a.enrollmentId)!.push(a);
    }

    const enrichedEnrollments = enrollments.map((e) => ({
      ...e,
      sessionAssignments: assignmentsByEnrollment.get(e.id) ?? [],
    }));

    const credentials = await db
      .select()
      .from(accredibleCredentials)
      .where(eq(accredibleCredentials.userId, userId))
      .orderBy(desc(accredibleCredentials.issuedAt));

    res.json({
      ...user,
      profile: profile ?? null,
      enrollments: enrichedEnrollments,
      credentials,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/role
router.patch("/users/:id/role", async (req, res, next) => {
  try {
    const parsedParams = updateUserRoleParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: "Données invalides.", issues: parsedParams.error.issues });
      return;
    }

    const parsed = updateUserRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides.", issues: parsed.error.issues });
      return;
    }

    const userId = parsedParams.data.id;

    const [updated] = await db
      .update(users)
      .set({ role: parsed.data.role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id, email: users.email, role: users.role });

    if (!updated) throw new AppError("Utilisateur introuvable.", 404);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users/:id/impersonate
router.post("/users/:id/impersonate", async (req, res, next) => {
  try {
    const targetId = req.params.id as string;
    const adminId = req.session.userId!;

    if (targetId === adminId) {
      throw new AppError("Impossible de s'impersonner soi-même.", 400);
    }

    const [targetUser] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!targetUser) throw new AppError("Utilisateur introuvable.", 404);

    req.session.userId = targetUser.id;
    req.session.role = targetUser.role as UserRole;
    req.session.impersonatedBy = adminId;

    res.json({ ok: true, userId: targetUser.id, email: targetUser.email });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Enrollment overview
// ---------------------------------------------------------------------------

// GET /api/admin/enrollments
router.get("/enrollments", async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: programEnrollments.id,
        userId: programEnrollments.userId,
        programCode: programEnrollments.programCode,
        status: programEnrollments.status,
        enrolledAt: programEnrollments.enrolledAt,
        bexioDocumentNr: programEnrollments.bexioDocumentNr,
        bexioTotal: programEnrollments.bexioTotal,
        bexioInvoiceId: programEnrollments.bexioInvoiceId,
        email: users.email,
        firstName: userProfiles.firstName,
        lastName: userProfiles.lastName,
      })
      .from(programEnrollments)
      .innerJoin(users, eq(users.id, programEnrollments.userId))
      .leftJoin(userProfiles, eq(userProfiles.userId, programEnrollments.userId))
      .orderBy(desc(programEnrollments.enrolledAt));

    // Attach current session assignment for each enrollment
    const ids = rows.map((r) => r.id);
    const assignments =
      ids.length > 0
        ? await db
            .select({
              enrollmentId: sessionAssignments.enrollmentId,
              sessionId: sessionAssignments.sessionId,
              status: sessionAssignments.status,
            })
            .from(sessionAssignments)
            .orderBy(desc(sessionAssignments.assignedAt))
        : [];

    // Keep only the most recent assignment per enrollment
    const latestAssignment = new Map<string, { sessionId: string; status: string }>();
    for (const a of assignments) {
      if (ids.includes(a.enrollmentId) && !latestAssignment.has(a.enrollmentId)) {
        latestAssignment.set(a.enrollmentId, { sessionId: a.sessionId, status: a.status });
      }
    }

    const result = rows.map((r) => ({
      ...r,
      currentSession: latestAssignment.get(r.id) ?? null,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/stats
router.get("/stats", async (_req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const all = await db
      .select({
        status: programEnrollments.status,
        enrolledAt: programEnrollments.enrolledAt,
        bexioInvoiceId: programEnrollments.bexioInvoiceId,
      })
      .from(programEnrollments);

    const active = all.filter((e) => e.status === "active").length;
    const completed = all.filter((e) => e.status === "completed").length;
    const refunded = all.filter((e) => e.status === "refunded").length;
    const recentCount = all.filter((e) => new Date(e.enrolledAt) >= thirtyDaysAgo).length;
    const unpaidCount = all.filter((e) => e.status === "active" && !e.bexioInvoiceId).length;

    res.json({
      active,
      completed,
      refunded,
      total: all.length,
      recentCount,
      unpaidCount,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Accredible credentials log
// ---------------------------------------------------------------------------

// GET /api/admin/credentials
router.get("/credentials", async (req, res, next) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10) || 50, 200);
    const rows = await db
      .select()
      .from(accredibleCredentials)
      .orderBy(desc(accredibleCredentials.createdAt))
      .limit(limit);
    res.json(rows);
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

    if (userId) {
      const logs = await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.userId, userId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);
      res.json(logs);
      return;
    }

    const logs = await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

export default router;
