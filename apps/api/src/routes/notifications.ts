import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  getForUser,
  markRead,
  getTemplates,
  updateTemplate,
  testSendTemplate,
} from "../services/notification.js";
import { AppError } from "../lib/errors.js";

const router = Router();

// All notification routes require authentication
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Member: in-app bell notifications (channel = "internal")
// ---------------------------------------------------------------------------

// GET /api/notifications?limit=50
router.get("/", async (req, res, next) => {
  try {
    const limitParam = parseInt(req.query.limit as string, 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50;
    const items = await getForUser(req.session.userId!, limit);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", async (req, res, next) => {
  try {
    await markRead(req.params.id as string, req.session.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Admin: template management
// ---------------------------------------------------------------------------

// GET /api/notifications/admin/templates
router.get("/admin/templates", requireAdmin, async (_req, res, next) => {
  try {
    const templates = await getTemplates();
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/admin/templates/:id
router.put(
  "/admin/templates/:id",
  requireAdmin,
  async (req, res, next) => {
    try {
      const { subject, body, active } = req.body as {
        subject?: unknown;
        body?: unknown;
        active?: unknown;
      };

      if (typeof active !== "boolean") {
        throw new AppError("`active` doit être un booléen.", 400);
      }

      const template = await updateTemplate(
        req.params.id as string,
        typeof subject === "string" ? subject : null,
        typeof body === "string" ? body : null,
        active
      );
      res.json(template);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/notifications/admin/templates/:id/test-send
// Sends a test email with placeholder data to the requesting admin's email.
router.post(
  "/admin/templates/:id/test-send",
  requireAdmin,
  async (req, res, next) => {
    try {
      const { recipientEmail } = req.body as { recipientEmail?: unknown };
      if (typeof recipientEmail !== "string" || !recipientEmail) {
        throw new AppError("`recipientEmail` requis.", 400);
      }
      await testSendTemplate(req.params.id as string, recipientEmail);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
