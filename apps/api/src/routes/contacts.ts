import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../middleware/featureAccess.js";
import { validateBody, validateUuidParam } from "../middleware/validate.js";
import {
  sendContactRequest,
  listAcceptedContacts,
  listPendingRequests,
  acceptContactRequest,
  rejectContactRequest,
} from "../services/contacts.js";

const router = Router();

const contactRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Trop de demandes de contact. Réessayez plus tard." },
  standardHeaders: true,
  legacyHeaders: false,
});

const contactRequestSchema = z.object({
  recipientId: z.string().uuid("ID destinataire invalide."),
  message: z.string().max(500).optional(),
});

router.post(
  "/request",
  requireAuth,
  requireFeature("community"),
  contactRequestLimiter,
  validateBody(contactRequestSchema),
  async (req, res, next) => {
    try {
      const { recipientId, message } = req.body;
      const result = await sendContactRequest(
        req.session.userId!,
        recipientId,
        message
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const contacts = await listAcceptedContacts(req.session.userId!);
      res.json(contacts);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/requests",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const requests = await listPendingRequests(req.session.userId!);
      res.json(requests);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/accept",
  requireAuth,
  requireFeature("community"),
  validateUuidParam("id"),
  async (req, res, next) => {
    try {
      await acceptContactRequest(req.params.id as string, req.session.userId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/reject",
  requireAuth,
  requireFeature("community"),
  validateUuidParam("id"),
  async (req, res, next) => {
    try {
      await rejectContactRequest(req.params.id as string, req.session.userId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
