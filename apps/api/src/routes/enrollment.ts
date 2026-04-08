import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { enrollmentBodySchema } from "@mhp/shared";
import {
  enroll,
  rescheduleSession,
  cancelSession,
  getUserEnrollments,
  requestRefund,
  processRefund,
  getPendingRefunds,
} from "../services/enrollment.js";
import {
  getExtranetUrl,
  getTraineeWithSessions,
  findTraineeByEmail,
} from "@mhp/integrations/digiforma";
import { AppError } from "../lib/errors.js";
import { db } from "../db.js";
import { users, userProfiles } from "@mhp/shared";
import { eq } from "drizzle-orm";

const router = Router();

// All enrollment routes require authentication
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Enroll
// ---------------------------------------------------------------------------

// POST /api/enrollments
router.post("/", async (req, res, next) => {
  try {
    const parsed = enrollmentBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides.", issues: parsed.error.issues });
      return;
    }

    const enrollment = await enroll(
      req.session.userId!,
      parsed.data.programCode,
      parsed.data.sessionId,
      parsed.data.pricingTierId,
      parsed.data.finalAmount
    );
    res.status(201).json(enrollment);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// My enrollments
// ---------------------------------------------------------------------------

// GET /api/enrollments/me
router.get("/me", async (req, res, next) => {
  try {
    const enrollments = await getUserEnrollments(req.session.userId!);
    res.json(enrollments);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Extranet URL (DigiForma)
// ---------------------------------------------------------------------------

// GET /api/enrollments/extranet-url
router.get("/extranet-url", async (req, res, next) => {
  try {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, req.session.userId!))
      .limit(1);

    if (!user) throw new AppError("Utilisateur introuvable.", 404);

    const url = await getExtranetUrl(user.email);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Extranet sessions — per-session DigiForma learner portal URLs
// ---------------------------------------------------------------------------

// GET /api/enrollments/me/extranet-sessions
router.get("/me/extranet-sessions", async (req, res, next) => {
  try {
    const [profileRow] = await db
      .select({
        digiformaId: userProfiles.digiformaId,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, req.session.userId!))
      .limit(1);

    let digiformaId = profileRow?.digiformaId ?? null;

    if (!digiformaId) {
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, req.session.userId!))
        .limit(1);

      if (user) {
        const trainee = await findTraineeByEmail(user.email);
        if (trainee) {
          digiformaId = trainee.id;
        }
      }
    }

    if (!digiformaId) {
      res.json({ sessions: [] });
      return;
    }

    const trainee = await getTraineeWithSessions(digiformaId);
    if (!trainee?.trainingSessions) {
      res.json({ sessions: [] });
      return;
    }

    const sessions = trainee.trainingSessions
      .filter((s) => s.extranetUrl)
      .map((s) => ({
        digiformaSessionId: s.id,
        programCode: s.program?.code ?? null,
        programName: s.program?.name ?? null,
        startDate: s.startDate,
        endDate: s.endDate,
        extranetUrl: s.extranetUrl,
      }));

    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Reschedule
// ---------------------------------------------------------------------------

// POST /api/enrollments/:enrollmentId/reschedule
router.post("/:enrollmentId/reschedule", async (req, res, next) => {
  try {
    const { newSessionId } = req.body as { newSessionId: unknown };
    if (typeof newSessionId !== "string" || !newSessionId) {
      throw new AppError("`newSessionId` requis.", 400);
    }
    const assignment = await rescheduleSession(
      req.params.enrollmentId as string,
      newSessionId,
      req.session.userId!,
      req.session.role === "admin"
    );
    res.json(assignment);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Cancel session
// ---------------------------------------------------------------------------

// POST /api/enrollments/:enrollmentId/cancel-session
router.post("/:enrollmentId/cancel-session", async (req, res, next) => {
  try {
    const assignment = await cancelSession(
      req.params.enrollmentId as string,
      req.session.userId!,
      req.session.role === "admin"
    );
    res.json(assignment);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

// POST /api/enrollments/:enrollmentId/refund-request
router.post("/:enrollmentId/refund-request", async (req, res, next) => {
  try {
    const { reason } = req.body as { reason?: unknown };
    const request = await requestRefund(
      req.params.enrollmentId as string,
      typeof reason === "string" ? reason : "",
      req.session.userId!
    );
    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Admin: refund management
// ---------------------------------------------------------------------------

// GET /api/enrollments/admin/refunds
router.get("/admin/refunds", requireAdmin, async (_req, res, next) => {
  try {
    const refunds = await getPendingRefunds();
    res.json(refunds);
  } catch (err) {
    next(err);
  }
});

// POST /api/enrollments/admin/refunds/:refundRequestId/process
router.post(
  "/admin/refunds/:refundRequestId/process",
  requireAdmin,
  async (req, res, next) => {
    try {
      const { approved, adminNote } = req.body as {
        approved: unknown;
        adminNote?: unknown;
      };
      if (typeof approved !== "boolean") {
        throw new AppError("`approved` doit être un booléen.", 400);
      }
      const request = await processRefund(
        req.params.refundRequestId as string,
        approved,
        typeof adminNote === "string" ? adminNote : null,
        req.session.userId!
      );
      res.json(request);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
