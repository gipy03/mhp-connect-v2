import { Router } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../middleware/featureAccess.js";
import { validateUuidParam, validateBody } from "../middleware/validate.js";
import { db } from "../db.js";
import {
  listConversations,
  createConversation,
  getMessages,
  sendMessage,
  markConversationRead,
  addParticipants,
  removeParticipant,
  leaveConversation,
  getTotalUnreadCount,
} from "../services/messaging.js";
import { getContactStatusBulk } from "../services/contacts.js";

const router = Router();

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Trop de messages. Réessayez dans une minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Trop de recherches. Réessayez dans une minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

const createConversationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Trop de conversations créées. Réessayez plus tard." },
  standardHeaders: true,
  legacyHeaders: false,
});

const createConversationSchema = z.object({
  participantIds: z.array(z.string().uuid()).min(1, "Au moins un participant requis."),
  title: z.string().max(200).optional(),
});

const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "Contenu du message requis.").max(10000),
});

const addParticipantsSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, "Liste d'utilisateurs requise."),
});

router.get(
  "/",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const result = await listConversations(req.session.userId!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/unread-count",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const count = await getTotalUnreadCount(req.session.userId!);
      res.json({ count });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/search-users",
  requireAuth,
  requireFeature("community"),
  searchLimiter,
  async (req, res, next) => {
    try {
      const q = (req.query.q as string)?.trim();
      if (!q || q.length < 2) {
        res.json([]);
        return;
      }
      const pattern = `%${q}%`;
      interface SearchRow { userId: string; firstName: string | null; lastName: string | null; contactStatus: string | null; contactId: string | null }
      const result = await db.execute(sql`
        SELECT DISTINCT up.user_id AS "userId", up.first_name AS "firstName", up.last_name AS "lastName"
        FROM user_profiles up
        INNER JOIN program_enrollments pe ON pe.user_id = up.user_id
          AND pe.status IN ('active', 'completed')
        INNER JOIN program_feature_grants pfg ON pfg.program_code = pe.program_code
          AND pfg.feature_key = 'community'
          AND (pfg.credential_required = false OR pe.status = 'completed')
        WHERE up.user_id != ${req.session.userId}
          AND (up.first_name ILIKE ${pattern} OR up.last_name ILIKE ${pattern})
        LIMIT 20
      `);

      const users = result.rows as unknown as { userId: string; firstName: string | null; lastName: string | null }[];
      const userIds = users.map((u) => u.userId);
      const contactMap = await getContactStatusBulk(req.session.userId!, userIds);

      const enriched: SearchRow[] = users.map((u) => {
        const contact = contactMap.get(u.userId);
        return {
          ...u,
          contactStatus: contact?.status ?? null,
          contactId: contact?.contactId ?? null,
        };
      });

      res.json(enriched);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/",
  requireAuth,
  requireFeature("community"),
  createConversationLimiter,
  validateBody(createConversationSchema),
  async (req, res, next) => {
    try {
      const { participantIds, title } = req.body;
      const result = await createConversation(
        req.session.userId!,
        participantIds,
        title
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:conversationId/messages",
  requireAuth,
  requireFeature("community"),
  validateUuidParam("conversationId"),
  async (req, res, next) => {
    try {
      const cursor = req.query.cursor as string | undefined;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const result = await getMessages(
        req.params.conversationId as string,
        req.session.userId!,
        cursor,
        limit
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:conversationId/messages",
  requireAuth,
  requireFeature("community"),
  messageLimiter,
  validateUuidParam("conversationId"),
  validateBody(sendMessageSchema),
  async (req, res, next) => {
    try {
      const msg = await sendMessage(
        req.params.conversationId as string,
        req.session.userId!,
        req.body.body
      );
      res.status(201).json(msg);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:conversationId/read",
  requireAuth,
  requireFeature("community"),
  validateUuidParam("conversationId"),
  async (req, res, next) => {
    try {
      await markConversationRead(
        req.params.conversationId as string,
        req.session.userId!
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:conversationId/participants",
  requireAuth,
  requireFeature("community"),
  validateUuidParam("conversationId"),
  validateBody(addParticipantsSchema),
  async (req, res, next) => {
    try {
      await addParticipants(
        req.params.conversationId as string,
        req.session.userId!,
        req.body.userIds
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/:conversationId/participants/:userId",
  requireAuth,
  requireFeature("community"),
  validateUuidParam("conversationId", "userId"),
  async (req, res, next) => {
    try {
      await removeParticipant(
        req.params.conversationId as string,
        req.session.userId!,
        req.params.userId as string
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:conversationId/leave",
  requireAuth,
  requireFeature("community"),
  validateUuidParam("conversationId"),
  async (req, res, next) => {
    try {
      await leaveConversation(
        req.params.conversationId as string,
        req.session.userId!
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
