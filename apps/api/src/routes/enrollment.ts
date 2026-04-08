import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  enroll,
  rescheduleSession,
  cancelSession,
  getUserEnrollments,
  requestRefund,
  processRefund,
  getPendingRefunds,
} from "../services/enrollment.js";
import { AppError } from "../lib/errors.js";

const router = Router();

// All enrollment routes require authentication
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Enroll
// ---------------------------------------------------------------------------

// POST /api/enrollments
router.post("/", async (req, res, next) => {
  try {
    const { programCode, sessionId, pricingTierId, finalAmount } =
      req.body as {
        programCode: unknown;
        sessionId: unknown;
        pricingTierId: unknown;
        finalAmount?: unknown;
      };

    if (typeof programCode !== "string" || !programCode)
      throw new AppError("`programCode` requis.", 400);
    if (typeof sessionId !== "string" || !sessionId)
      throw new AppError("`sessionId` requis.", 400);
    if (typeof pricingTierId !== "string" || !pricingTierId)
      throw new AppError("`pricingTierId` requis.", 400);

    const amount =
      finalAmount !== undefined ? Number(finalAmount) : undefined;
    if (amount !== undefined && isNaN(amount)) {
      throw new AppError("`finalAmount` doit être un nombre.", 400);
    }

    const enrollment = await enroll(
      req.session.userId!,
      programCode,
      sessionId,
      pricingTierId,
      amount
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
      req.params.enrollmentId,
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
      req.params.enrollmentId,
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
      req.params.enrollmentId,
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
        req.params.refundRequestId,
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
