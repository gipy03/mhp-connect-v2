import { Router } from "express";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../middleware/featureAccess.js";
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

const router = Router();

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
  async (req, res, next) => {
    try {
      const q = (req.query.q as string)?.trim();
      if (!q || q.length < 2) {
        res.json([]);
        return;
      }
      const pattern = `%${q}%`;
      interface SearchRow { userId: string; firstName: string | null; lastName: string | null }
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
      res.json(result.rows as unknown as SearchRow[]);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const { participantIds, title } = req.body as {
        participantIds?: string[];
        title?: string;
      };
      if (!Array.isArray(participantIds) || participantIds.length === 0) {
        res.status(400).json({ error: "Au moins un participant requis." });
        return;
      }
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
  async (req, res, next) => {
    try {
      const cursor = req.query.cursor as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
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
  async (req, res, next) => {
    try {
      const { body } = req.body as { body?: string };
      if (!body?.trim()) {
        res.status(400).json({ error: "Contenu du message requis." });
        return;
      }
      const msg = await sendMessage(
        req.params.conversationId as string,
        req.session.userId!,
        body.trim()
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
  async (req, res, next) => {
    try {
      const { userIds } = req.body as { userIds?: string[] };
      if (!Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({ error: "Liste d'utilisateurs requise." });
        return;
      }
      await addParticipants(
        req.params.conversationId as string,
        req.session.userId!,
        userIds
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
