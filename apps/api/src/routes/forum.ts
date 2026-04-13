import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { requireFeature } from "../middleware/featureAccess.js";
import {
  listChannels,
  getChannel,
  assertChannelAccess,
  createChannel,
  updateChannel,
  reorderChannels,
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  togglePin,
  listComments,
  createComment,
  updateComment,
  deleteComment,
  toggleReaction,
  getOrCreateProgramChannel,
  resolvePostChannel,
  resolveCommentChannel,
} from "../services/forum.js";

const router = Router();

router.get(
  "/channels",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const isAdmin = !!req.session.adminUserId;
      const includeArchived = isAdmin && req.query.includeArchived === "true";
      const result = await listChannels(
        includeArchived,
        req.session.userId!,
        isAdmin
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/channels/:channelId",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const isAdmin = !!req.session.adminUserId;
      await assertChannelAccess(req.params.channelId as string, req.session.userId!, isAdmin);
      const channel = await getChannel((req.params.channelId as string), isAdmin);
      res.json(channel);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/channels/:channelId/posts",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const isAdmin = !!req.session.adminUserId;
      await assertChannelAccess(req.params.channelId as string, req.session.userId!, isAdmin);
      await getChannel((req.params.channelId as string), isAdmin);
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const result = await listPosts(
        (req.params.channelId as string),
        page,
        limit,
        req.session.userId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/channels/:channelId/posts",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const isAdmin = !!req.session.adminUserId;
      await assertChannelAccess(req.params.channelId as string, req.session.userId!, isAdmin);
      await getChannel((req.params.channelId as string), false);
      const { title, body } = req.body as { title?: string; body?: string };
      if (!title?.trim() || !body?.trim()) {
        res.status(400).json({ error: "Titre et contenu requis." });
        return;
      }
      const post = await createPost({
        channelId: (req.params.channelId as string),
        authorId: req.session.userId!,
        title: title.trim(),
        body: body.trim(),
      });
      res.status(201).json(post);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/posts/:postId",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const isAdmin = !!req.session.adminUserId;
      const { postChannelId, archived } = await resolvePostChannel((req.params.postId as string));
      await assertChannelAccess(postChannelId, req.session.userId!, isAdmin);
      if (archived && !isAdmin) {
        res.status(403).json({ error: "Ce canal est archivé." });
        return;
      }
      const post = await getPost((req.params.postId as string), req.session.userId);
      res.json(post);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/posts/:postId",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const isAdmin = !!req.session.adminUserId;
      const { postChannelId, archived } = await resolvePostChannel((req.params.postId as string));
      await assertChannelAccess(postChannelId, req.session.userId!, isAdmin);
      if (archived) {
        res.status(403).json({ error: "Ce canal est archivé." });
        return;
      }
      const { title, body } = req.body as { title?: string; body?: string };
      const post = await updatePost(
        (req.params.postId as string),
        req.session.userId!,
        isAdmin,
        { title: title?.trim(), body: body?.trim() }
      );
      res.json(post);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/posts/:postId",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const isAdmin = !!req.session.adminUserId;
      const { postChannelId, archived } = await resolvePostChannel((req.params.postId as string));
      await assertChannelAccess(postChannelId, req.session.userId!, isAdmin);
      if (archived && !isAdmin) {
        res.status(403).json({ error: "Ce canal est archivé." });
        return;
      }
      await deletePost(
        (req.params.postId as string),
        req.session.userId!,
        isAdmin
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/posts/:postId/pin",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { archived } = await resolvePostChannel((req.params.postId as string));
      if (archived) {
        res.status(403).json({ error: "Ce canal est archivé." });
        return;
      }
      const post = await togglePin((req.params.postId as string));
      res.json(post);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/posts/:postId/comments",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const isAdmin = !!req.session.adminUserId;
      const { postChannelId, archived } = await resolvePostChannel((req.params.postId as string));
      await assertChannelAccess(postChannelId, req.session.userId!, isAdmin);
      if (archived && !isAdmin) {
        res.status(403).json({ error: "Ce canal est archivé." });
        return;
      }
      const result = await listComments((req.params.postId as string), req.session.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/posts/:postId/comments",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const isAdmin = !!req.session.adminUserId;
      const { postChannelId, archived } = await resolvePostChannel((req.params.postId as string));
      await assertChannelAccess(postChannelId, req.session.userId!, isAdmin);
      if (archived) {
        res.status(403).json({ error: "Ce canal est archivé." });
        return;
      }
      const { body } = req.body as { body?: string };
      if (!body?.trim()) {
        res.status(400).json({ error: "Contenu requis." });
        return;
      }
      const comment = await createComment({
        postId: (req.params.postId as string),
        authorId: req.session.userId!,
        body: body.trim(),
      });
      res.status(201).json(comment);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/comments/:commentId",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const isAdmin = !!req.session.adminUserId;
      const { channelId, archived } = await resolveCommentChannel((req.params.commentId as string));
      await assertChannelAccess(channelId, req.session.userId!, isAdmin);
      if (archived) {
        res.status(403).json({ error: "Ce canal est archivé." });
        return;
      }
      const { body } = req.body as { body?: string };
      if (!body?.trim()) {
        res.status(400).json({ error: "Contenu requis." });
        return;
      }
      const comment = await updateComment(
        (req.params.commentId as string),
        req.session.userId!,
        isAdmin,
        body.trim()
      );
      res.json(comment);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/comments/:commentId",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const isAdmin = !!req.session.adminUserId;
      const { channelId, archived } = await resolveCommentChannel((req.params.commentId as string));
      await assertChannelAccess(channelId, req.session.userId!, isAdmin);
      if (archived && !isAdmin) {
        res.status(403).json({ error: "Ce canal est archivé." });
        return;
      }
      await deleteComment(
        (req.params.commentId as string),
        req.session.userId!,
        isAdmin
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/reactions",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const isAdmin = !!req.session.adminUserId;
      const { postId, commentId, type } = req.body as {
        postId?: string;
        commentId?: string;
        type?: string;
      };
      if (!type?.trim()) {
        res.status(400).json({ error: "Type de réaction requis." });
        return;
      }
      if (postId) {
        const { postChannelId, archived } = await resolvePostChannel(postId);
        await assertChannelAccess(postChannelId, req.session.userId!, isAdmin);
        if (archived) {
          res.status(403).json({ error: "Ce canal est archivé." });
          return;
        }
      }
      if (commentId) {
        const { channelId, archived } = await resolveCommentChannel(commentId);
        await assertChannelAccess(channelId, req.session.userId!, isAdmin);
        if (archived) {
          res.status(403).json({ error: "Ce canal est archivé." });
          return;
        }
      }
      const result = await toggleReaction({
        userId: req.session.userId!,
        postId: postId || undefined,
        commentId: commentId || undefined,
        type: type.trim(),
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/admin/channels",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { name, description, programCode, sortOrder } = req.body as {
        name?: string;
        description?: string;
        programCode?: string;
        sortOrder?: number;
      };
      if (!name?.trim()) {
        res.status(400).json({ error: "Nom requis." });
        return;
      }
      const channel = await createChannel({
        name: name.trim(),
        description: description?.trim() || null,
        programCode: programCode?.trim() || null,
        sortOrder: sortOrder ?? 0,
      });
      res.status(201).json(channel);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/admin/channels/:channelId",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { name, description, programCode, sortOrder, archived } =
        req.body as {
          name?: string;
          description?: string;
          programCode?: string;
          sortOrder?: number;
          archived?: boolean;
        };
      const channel = await updateChannel((req.params.channelId as string), {
        name: name?.trim(),
        description: description !== undefined ? (description?.trim() || null) : undefined,
        programCode: programCode !== undefined ? (programCode?.trim() || null) : undefined,
        sortOrder,
        archived,
      });
      res.json(channel);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/admin/channels/reorder",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { orderedIds } = req.body as { orderedIds?: string[] };
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        res.status(400).json({ error: "Liste d'identifiants requise." });
        return;
      }
      const result = await reorderChannels(orderedIds);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/program-channel",
  requireAuth,
  requireFeature("community"),
  async (req, res, next) => {
    try {
      const { programCode } = req.body as {
        programCode?: string;
      };
      if (!programCode?.trim()) {
        res
          .status(400)
          .json({ error: "programCode requis." });
        return;
      }
      const channel = await getOrCreateProgramChannel(programCode.trim());
      res.json(channel);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
