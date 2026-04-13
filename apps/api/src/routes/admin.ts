import { Router, type Request } from "express";
import { and, count, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import {
  users,
  userProfiles,
  activityLogs,
  programEnrollments,
  sessionAssignments,
  accredibleCredentials,
  offers,
  adminUsers,
  refundRequests,
  bexioInvoices,
  syncState,
  notifications,
  notificationTemplates,
  updateUserRoleSchema,
  updateUserRoleParamsSchema,
  accredibleWebhookSchema,
  offerBodySchema,
  type UserRole,
} from "@mhp/shared";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { runIncrementalSync, runFullSync, getSyncStatus, bulkImportTrainees, remapEnrollmentCodes, getRecentPushLogs, type SyncResult, type BulkImportResult, type RemapResult } from "../services/sync.js";
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
import { ensureChannelsForAllPrograms, ensureChannelsForAllSessions, cleanupNonAllowedChannels, ensureIntroPostsForAllChannels } from "../services/forum.js";
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
    const wasAdminUser = req.session.impersonatedByAdminUser;

    if (!adminId) {
      res.status(400).json({ error: "Aucune session d'impersonation active." });
      return;
    }

    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve()))
    );

    if (wasAdminUser) {
      const [admin] = await db
        .select({ id: adminUsers.id, isSuperAdmin: adminUsers.isSuperAdmin })
        .from(adminUsers)
        .where(eq(adminUsers.id, adminId))
        .limit(1);

      if (!admin) {
        req.session.destroy(() => {});
        res.status(403).json({ error: "Le compte admin n'existe plus." });
        return;
      }

      req.session.adminUserId = admin.id;
      req.session.isSuperAdmin = admin.isSuperAdmin ?? false;
    } else {
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

      req.session.userId = admin.id;
      req.session.role = admin.role as UserRole;
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// All routes below this point require admin
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// Dashboard — aggregated stats
// ---------------------------------------------------------------------------

router.get("/dashboard", async (_req, res, next) => {
  try {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const allUsers = await db
      .select({ id: users.id, createdAt: users.createdAt })
      .from(users);
    const totalUsers = allUsers.length;
    const newUsersThisMonth = allUsers.filter(
      (u) => u.createdAt && new Date(u.createdAt) >= firstOfMonth
    ).length;

    const allEnrollments = await db
      .select({ status: programEnrollments.status })
      .from(programEnrollments);
    const activeEnrollments = allEnrollments.filter((e) => e.status === "active").length;
    const completedEnrollments = allEnrollments.filter((e) => e.status === "completed").length;
    const refundedEnrollments = allEnrollments.filter((e) => e.status === "refunded").length;

    const [pendingRefunds] = await db
      .select({ count: count() })
      .from(refundRequests)
      .where(eq(refundRequests.status, "pending"));

    const [syncRow] = await db
      .select({
        lastSyncAt: syncState.lastSyncAt,
        lastSyncStatus: syncState.lastSyncStatus,
      })
      .from(syncState)
      .where(eq(syncState.service, "digiforma"))
      .limit(1);

    const allInvoices = await db
      .select({ status: bexioInvoices.status })
      .from(bexioInvoices);
    const paidInvoices = allInvoices.filter((i) =>
      ["paid", "payed"].includes(i.status.toLowerCase())
    ).length;
    const pendingInvoices = allInvoices.filter((i) =>
      ["pending", "draft", "open", "partial"].includes(i.status.toLowerCase())
    ).length;

    const recentActivity = await db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        detail: activityLogs.detail,
        targetType: activityLogs.targetType,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(10);

    res.json({
      users: { total: totalUsers, newThisMonth: newUsersThisMonth },
      enrollments: {
        active: activeEnrollments,
        completed: completedEnrollments,
        refunded: refundedEnrollments,
        total: allEnrollments.length,
      },
      pendingRefunds: pendingRefunds?.count ?? 0,
      sync: {
        lastSyncAt: syncRow?.lastSyncAt ?? null,
        lastSyncStatus: syncRow?.lastSyncStatus ?? null,
      },
      invoices: {
        total: allInvoices.length,
        paid: paidInvoices,
        pending: pendingInvoices,
      },
      recentActivity,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Notification log — paginated queue view
// ---------------------------------------------------------------------------

router.get("/notifications/log", async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 100);
    const offset = (page - 1) * limit;
    const statusFilter = (req.query.status as string) || undefined;
    const eventTypeFilter = (req.query.eventType as string) || undefined;
    const search = (req.query.search as string) || undefined;

    const conditions = [];

    if (statusFilter) {
      conditions.push(eq(notifications.status, statusFilter));
    }

    if (eventTypeFilter) {
      conditions.push(eq(notificationTemplates.eventType, eventTypeFilter));
    }

    if (search) {
      conditions.push(sql`lower(${users.email}) like lower(${'%' + search + '%'})`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: notifications.id,
        recipientId: notifications.recipientId,
        recipientEmail: users.email,
        channel: notifications.channel,
        status: notifications.status,
        eventType: notificationTemplates.eventType,
        sentAt: notifications.sentAt,
        retryCount: notifications.retryCount,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .innerJoin(users, eq(notifications.recipientId, users.id))
      .leftJoin(notificationTemplates, eq(notifications.templateId, notificationTemplates.id))
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalRow] = await db
      .select({ count: count() })
      .from(notifications)
      .innerJoin(users, eq(notifications.recipientId, users.id))
      .leftJoin(notificationTemplates, eq(notifications.templateId, notificationTemplates.id))
      .where(whereClause);

    const total = totalRow?.count ?? 0;

    res.json({
      items: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

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

// GET /api/admin/sync/push-log — recent outbound push attempts
router.get("/sync/push-log", async (_req, res, next) => {
  try {
    const logs = await getRecentPushLogs(50);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/sync/channels — auto-create forum channels for all programs + sessions
router.post("/sync/channels", async (_req, res, next) => {
  try {
    const cleanup = await cleanupNonAllowedChannels();
    const programs = await ensureChannelsForAllPrograms();
    const sessions = await ensureChannelsForAllSessions();
    const introPosts = await ensureIntroPostsForAllChannels();
    res.json({ cleanup, programs, sessions, introPosts });
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

// PATCH /api/admin/users/:id/profile
router.patch("/users/:id/profile", async (req, res, next) => {
  try {
    const userId = req.params.id as string;

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new AppError("Utilisateur introuvable.", 404);

    const body = req.body as Record<string, unknown>;

    const stringFields = [
      "firstName", "lastName", "phone", "phoneSecondary",
      "roadAddress", "city", "cityCode", "country", "countryCode",
      "birthdate", "nationality", "profession",
      "practiceName", "bio", "website", "profileImageUrl",
      "digiformaId", "bexioContactId",
    ];
    const booleanFields = ["showPhone", "showEmail", "showAddress", "showOnMap"];
    const validVisibilities = ["hidden", "internal", "public"];

    const updates: Record<string, unknown> = {};

    for (const key of stringFields) {
      if (key in body) {
        const val = body[key];
        if (val !== null && typeof val !== "string") {
          throw new AppError(`Le champ "${key}" doit être une chaîne ou null.`, 400);
        }
        updates[key] = val || null;
      }
    }

    for (const key of booleanFields) {
      if (key in body) {
        if (typeof body[key] !== "boolean") {
          throw new AppError(`Le champ "${key}" doit être un booléen.`, 400);
        }
        updates[key] = body[key];
      }
    }

    if ("directoryVisibility" in body) {
      if (!validVisibilities.includes(body.directoryVisibility as string)) {
        throw new AppError(`directoryVisibility doit être: ${validVisibilities.join(", ")}`, 400);
      }
      updates.directoryVisibility = body.directoryVisibility;
    }

    if ("specialties" in body) {
      const val = body.specialties;
      if (val !== null && !Array.isArray(val)) {
        throw new AppError(`Le champ "specialties" doit être un tableau ou null.`, 400);
      }
      updates.specialties = val;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Aucun champ modifiable fourni." });
      return;
    }

    const [existing] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (!existing) {
      await db.insert(userProfiles).values({
        userId,
        ...updates,
      });
    } else {
      await db
        .update(userProfiles)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userProfiles.userId, userId));
    }

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    res.json(profile);
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
    const isAdminUser = !!req.session.adminUserId;
    const adminId = req.session.adminUserId ?? req.session.userId;

    if (!adminId) {
      throw new AppError("Session admin introuvable.", 401);
    }

    if (targetId === adminId) {
      throw new AppError("Impossible de s'impersonner soi-même.", 400);
    }

    const [targetUser] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!targetUser) throw new AppError("Utilisateur introuvable.", 404);

    delete req.session.adminUserId;
    delete req.session.isSuperAdmin;
    req.session.userId = targetUser.id;
    req.session.role = targetUser.role as UserRole;
    req.session.impersonatedBy = adminId;
    req.session.impersonatedByAdminUser = isAdminUser;

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

// ---------------------------------------------------------------------------
// Offers management
// ---------------------------------------------------------------------------

router.get("/offers", async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(offers)
      .orderBy(offers.sortOrder, desc(offers.createdAt));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/offers", async (req, res, next) => {
  try {
    const parsed = offerBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides.", issues: parsed.error.issues });
      return;
    }

    const data = parsed.data;
    const [offer] = await db
      .insert(offers)
      .values({
        title: data.title,
        description: data.description ?? null,
        partnerName: data.partnerName,
        partnerLogoUrl: data.partnerLogoUrl ?? null,
        discountText: data.discountText ?? null,
        category: data.category ?? null,
        redemptionUrl: data.redemptionUrl ?? null,
        redemptionCode: data.redemptionCode ?? null,
        visibility: data.visibility ?? "all",
        requiredFeature: data.requiredFeature ?? null,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        published: data.published ?? false,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(offer);
  } catch (err) {
    next(err);
  }
});

router.put("/offers/:id", async (req, res, next) => {
  try {
    const parsed = offerBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides.", issues: parsed.error.issues });
      return;
    }

    const data = parsed.data;
    const [updated] = await db
      .update(offers)
      .set({
        title: data.title,
        description: data.description ?? null,
        partnerName: data.partnerName,
        partnerLogoUrl: data.partnerLogoUrl ?? null,
        discountText: data.discountText ?? null,
        category: data.category ?? null,
        redemptionUrl: data.redemptionUrl ?? null,
        redemptionCode: data.redemptionCode ?? null,
        visibility: data.visibility ?? "all",
        requiredFeature: data.requiredFeature ?? null,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        published: data.published ?? false,
        sortOrder: data.sortOrder ?? 0,
        updatedAt: new Date(),
      })
      .where(eq(offers.id, req.params.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Offre introuvable." });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.patch("/offers/:id/toggle-publish", async (req, res, next) => {
  try {
    const [existing] = await db
      .select({ published: offers.published })
      .from(offers)
      .where(eq(offers.id, req.params.id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Offre introuvable." });
      return;
    }

    const [updated] = await db
      .update(offers)
      .set({ published: !existing.published, updatedAt: new Date() })
      .where(eq(offers.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/offers/:id", async (req, res, next) => {
  try {
    const [deleted] = await db
      .delete(offers)
      .where(eq(offers.id, req.params.id))
      .returning({ id: offers.id });

    if (!deleted) {
      res.status(404).json({ error: "Offre introuvable." });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
