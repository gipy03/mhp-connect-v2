import { and, eq, desc, asc, sql, count, isNull, isNotNull, inArray } from "drizzle-orm";
import {
  channels,
  posts,
  comments,
  reactions,
  userProfiles,
  programOverrides,
  digiformaSessions,
} from "@mhp/shared";
import { db } from "../db.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export async function listChannels(includeArchived = false) {
  const conditions = includeArchived ? [] : [eq(channels.archived, false)];

  const rows = await db
    .select()
    .from(channels)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(channels.sortOrder), asc(channels.name));

  const channelIds = rows.map((r) => r.id);
  if (channelIds.length === 0) return rows.map((r) => ({ ...r, postCount: 0 }));

  const countRows = await db
    .select({
      channelId: posts.channelId,
      postCount: count(posts.id),
    })
    .from(posts)
    .where(inArray(posts.channelId, channelIds))
    .groupBy(posts.channelId);

  const countMap = new Map(countRows.map((r) => [r.channelId, Number(r.postCount)]));

  return rows.map((r) => ({
    ...r,
    postCount: countMap.get(r.id) ?? 0,
  }));
}

export async function getChannel(channelId: string, allowArchived = false) {
  const [channel] = await db
    .select()
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) throw new AppError("Canal introuvable.", 404);
  if (channel.archived && !allowArchived) {
    throw new AppError("Ce canal est archivé.", 403);
  }
  return channel;
}

export async function createChannel(data: {
  name: string;
  description?: string | null;
  programCode?: string | null;
  sessionId?: string | null;
  sortOrder?: number;
}) {
  const [channel] = await db
    .insert(channels)
    .values({
      name: data.name,
      description: data.description ?? null,
      programCode: data.programCode ?? null,
      sessionId: data.sessionId ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();

  return channel;
}

export async function updateChannel(
  channelId: string,
  data: {
    name?: string;
    description?: string | null;
    programCode?: string | null;
    sessionId?: string | null;
    sortOrder?: number;
    archived?: boolean;
  }
) {
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.programCode !== undefined) updates.programCode = data.programCode;
  if (data.sessionId !== undefined) updates.sessionId = data.sessionId;
  if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
  if (data.archived !== undefined) updates.archived = data.archived;

  if (Object.keys(updates).length === 0) {
    throw new AppError("Aucune donnée à mettre à jour.", 400);
  }

  const [updated] = await db
    .update(channels)
    .set(updates)
    .where(eq(channels.id, channelId))
    .returning();

  if (!updated) throw new AppError("Canal introuvable.", 404);
  return updated;
}

export async function reorderChannels(orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(channels)
      .set({ sortOrder: i })
      .where(eq(channels.id, orderedIds[i]));
  }
  return { ok: true };
}

export async function getChannelByProgramCode(programCode: string) {
  const [channel] = await db
    .select()
    .from(channels)
    .where(
      and(
        eq(channels.programCode, programCode),
        isNull(channels.sessionId),
        eq(channels.archived, false)
      )
    )
    .limit(1);

  return channel ?? null;
}

export async function getOrCreateProgramChannel(programCode: string) {
  const existing = await getChannelByProgramCode(programCode);
  if (existing) return existing;

  const [program] = await db
    .select({ programCode: programOverrides.programCode, displayName: programOverrides.displayName })
    .from(programOverrides)
    .where(eq(programOverrides.programCode, programCode))
    .limit(1);

  if (!program) {
    throw new AppError("Programme introuvable.", 404);
  }

  const name = program.displayName || program.programCode;

  const [channel] = await db
    .insert(channels)
    .values({
      name,
      description: `Discussion autour du programme ${name}`,
      programCode,
      sessionId: null,
      sortOrder: 100,
    })
    .onConflictDoNothing()
    .returning();

  if (channel) return channel;

  const created = await getChannelByProgramCode(programCode);
  if (!created) throw new AppError("Erreur lors de la création du canal.", 500);
  return created;
}

export async function getOrCreateSessionChannel(
  programCode: string,
  sessionDigiformaId: string,
  sessionName: string
) {
  const [existing] = await db
    .select()
    .from(channels)
    .where(
      and(
        eq(channels.programCode, programCode),
        eq(channels.sessionId, sessionDigiformaId),
        eq(channels.archived, false)
      )
    )
    .limit(1);

  if (existing) return existing;

  const [channel] = await db
    .insert(channels)
    .values({
      name: sessionName,
      description: `Discussion pour la session : ${sessionName}`,
      programCode,
      sessionId: sessionDigiformaId,
      sortOrder: 200,
    })
    .onConflictDoNothing()
    .returning();

  if (channel) return channel;

  const [created] = await db
    .select()
    .from(channels)
    .where(
      and(
        eq(channels.programCode, programCode),
        eq(channels.sessionId, sessionDigiformaId)
      )
    )
    .limit(1);

  return created ?? null;
}

const ALLOWED_CHANNEL_CATEGORIES = ["Formation de base", "Formations avancées"];

export async function cleanupNonAllowedChannels() {
  const allowedPrograms = await db
    .select({ programCode: programOverrides.programCode })
    .from(programOverrides)
    .where(inArray(programOverrides.category, ALLOWED_CHANNEL_CATEGORIES));
  const allowedSet = new Set(allowedPrograms.map((p) => p.programCode));

  const allActiveChannels = await db
    .select({
      id: channels.id,
      programCode: channels.programCode,
      sessionId: channels.sessionId,
      name: channels.name,
      createdAt: channels.createdAt,
    })
    .from(channels)
    .where(eq(channels.archived, false))
    .orderBy(asc(channels.createdAt));

  let archived = 0;
  const seenPrograms = new Set<string>();

  for (const ch of allActiveChannels) {
    let shouldArchive = false;

    if (!ch.programCode) {
      shouldArchive = true;
    } else if (!allowedSet.has(ch.programCode)) {
      shouldArchive = true;
    } else if (ch.sessionId) {
      shouldArchive = true;
    } else if (seenPrograms.has(ch.programCode)) {
      shouldArchive = true;
    } else {
      seenPrograms.add(ch.programCode);
    }

    if (shouldArchive) {
      try {
        await db
          .update(channels)
          .set({ archived: true })
          .where(eq(channels.id, ch.id));
        archived++;
        logger.info({ channelId: ch.id, name: ch.name, programCode: ch.programCode, sessionId: ch.sessionId }, "Archived non-allowed channel");
      } catch (err) {
        logger.warn({ channelId: ch.id, err }, "Failed to archive channel");
      }
    }
  }

  logger.info({ archived }, "cleanupNonAllowedChannels complete");
  return { archived };
}

export async function ensureIntroPostsForAllChannels() {
  const activeChannels = await db
    .select({ id: channels.id, name: channels.name })
    .from(channels)
    .where(
      and(
        isNotNull(channels.programCode),
        eq(channels.archived, false)
      )
    );

  let created = 0;
  for (const ch of activeChannels) {
    const existingIntro = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.channelId, ch.id), eq(posts.pinned, true)))
      .limit(1);
    if (existingIntro.length > 0) continue;

    const [adminUser] = await db
      .select({ id: userProfiles.userId })
      .from(userProfiles)
      .innerJoin(
        sql`users`,
        sql`users.id = ${userProfiles.userId} AND users.role = 'admin'`
      )
      .limit(1);

    if (!adminUser?.id) continue;

    try {
      await db.insert(posts).values({
        channelId: ch.id,
        authorId: adminUser.id,
        title: `Bienvenue dans le canal ${ch.name}`,
        body: `Bienvenue dans l'espace de discussion dédié au programme **${ch.name}** !\n\nCe canal est réservé aux échanges entre participants et formateurs autour de ce programme. N'hésitez pas à poser vos questions, partager vos expériences et interagir avec la communauté.\n\nBonne discussion !`,
        pinned: true,
      });
      created++;
    } catch (err) {
      logger.warn({ channelId: ch.id, err }, "Failed to backfill intro post");
    }
  }

  logger.info({ created }, "ensureIntroPostsForAllChannels complete");
  return { created };
}

export async function ensureChannelsForAllPrograms() {
  const allPrograms = await db
    .select({
      programCode: programOverrides.programCode,
      displayName: programOverrides.displayName,
      category: programOverrides.category,
    })
    .from(programOverrides)
    .where(inArray(programOverrides.category, ALLOWED_CHANNEL_CATEGORIES));

  const existingProgramChannels = await db
    .select({ programCode: channels.programCode })
    .from(channels)
    .where(
      and(isNotNull(channels.programCode), isNull(channels.sessionId))
    );
  const existingSet = new Set(existingProgramChannels.map((c) => c.programCode));

  let created = 0;
  for (const program of allPrograms) {
    if (existingSet.has(program.programCode)) continue;
    const name = program.displayName || program.programCode;
    try {
      const [inserted] = await db
        .insert(channels)
        .values({
          name,
          description: `Discussion autour du programme ${name}`,
          programCode: program.programCode,
          sessionId: null,
          sortOrder: 100,
        })
        .onConflictDoNothing()
        .returning({ id: channels.id });
      if (inserted) {
        created++;
        await createIntroPost(inserted.id, name);
      }
    } catch (err) {
      logger.warn({ programCode: program.programCode, err }, "Failed to create program channel");
    }
  }

  logger.info({ created, total: allPrograms.length }, "ensureChannelsForAllPrograms complete");
  return { created, total: allPrograms.length };
}

async function createIntroPost(channelId: string, programName: string) {
  const introTitle = `Bienvenue dans le canal ${programName}`;
  const introBody = `Bienvenue dans l'espace de discussion dédié au programme **${programName}** !\n\nCe canal est réservé aux échanges entre participants et formateurs autour de ce programme. N'hésitez pas à poser vos questions, partager vos expériences et interagir avec la communauté.\n\nBonne discussion !`;

  try {
    const existingIntro = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.channelId, channelId), eq(posts.pinned, true)))
      .limit(1);

    if (existingIntro.length > 0) return;

    const [adminUser] = await db
      .select({ id: userProfiles.userId })
      .from(userProfiles)
      .innerJoin(
        sql`users`,
        sql`users.id = ${userProfiles.userId} AND users.role = 'admin'`
      )
      .limit(1);

    const authorId = adminUser?.id;
    if (!authorId) {
      logger.warn({ channelId }, "No admin user found for intro post");
      return;
    }

    await db.insert(posts).values({
      channelId,
      authorId,
      title: introTitle,
      body: introBody,
      pinned: true,
    });
  } catch (err) {
    logger.warn({ channelId, err }, "Failed to create intro post");
  }
}

export async function ensureChannelsForAllSessions() {
  const allowedPrograms = await db
    .select({
      programCode: programOverrides.programCode,
      displayName: programOverrides.displayName,
      category: programOverrides.category,
    })
    .from(programOverrides)
    .where(inArray(programOverrides.category, ALLOWED_CHANNEL_CATEGORIES));

  const allowedProgramCodes = new Set(allowedPrograms.map((p) => p.programCode));
  const programNameMap = new Map(
    allowedPrograms.map((o) => [o.programCode, o.displayName ?? o.programCode])
  );

  const existingProgramChannels = await db
    .select({ programCode: channels.programCode })
    .from(channels)
    .where(
      and(isNotNull(channels.programCode), isNull(channels.sessionId))
    );
  const existingProgramSet = new Set(existingProgramChannels.map((c) => c.programCode));

  let programsCreated = 0;

  for (const program of allowedPrograms) {
    if (existingProgramSet.has(program.programCode)) continue;
    const name = program.displayName || program.programCode;
    try {
      const [inserted] = await db
        .insert(channels)
        .values({
          name,
          description: `Discussion autour du programme ${name}`,
          programCode: program.programCode,
          sessionId: null,
          sortOrder: 100,
        })
        .onConflictDoNothing()
        .returning({ id: channels.id });
      if (inserted) {
        programsCreated++;
        await createIntroPost(inserted.id, name);
      }
    } catch (err) {
      logger.warn({ programCode: program.programCode, err }, "Failed to create program channel");
    }
  }

  logger.info(
    { programsCreated, allowedCategories: ALLOWED_CHANNEL_CATEGORIES },
    "Channel auto-creation complete (filtered by category)"
  );
  return { programsCreated, sessionsCreated: 0 };
}

export async function listPosts(
  channelId: string,
  page = 1,
  limit = 20,
  userId?: string
) {
  const offset = (page - 1) * limit;

  const [totalRow] = await db
    .select({ total: count(posts.id) })
    .from(posts)
    .where(eq(posts.channelId, channelId));

  const total = totalRow?.total ?? 0;

  const rows = await db
    .select({
      id: posts.id,
      channelId: posts.channelId,
      authorId: posts.authorId,
      title: posts.title,
      body: posts.body,
      pinned: posts.pinned,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      authorFirstName: userProfiles.firstName,
      authorLastName: userProfiles.lastName,
    })
    .from(posts)
    .leftJoin(userProfiles, eq(userProfiles.userId, posts.authorId))
    .where(eq(posts.channelId, channelId))
    .orderBy(desc(posts.pinned), desc(posts.createdAt))
    .limit(limit)
    .offset(offset);

  const postIds = rows.map((r) => r.id);

  let commentCounts = new Map<string, number>();
  let reactionCounts = new Map<string, Map<string, number>>();
  let userReactions = new Map<string, Set<string>>();

  if (postIds.length > 0) {
    const commentRows = await db
      .select({
        postId: comments.postId,
        commentCount: count(comments.id),
      })
      .from(comments)
      .where(sql`${comments.postId} = ANY(${postIds})`)
      .groupBy(comments.postId);

    commentCounts = new Map(commentRows.map((r) => [r.postId, r.commentCount]));

    const reactionRows = await db
      .select({
        postId: reactions.postId,
        type: reactions.type,
        reactionCount: count(reactions.id),
      })
      .from(reactions)
      .where(
        and(
          sql`${reactions.postId} = ANY(${postIds})`,
          isNull(reactions.commentId)
        )
      )
      .groupBy(reactions.postId, reactions.type);

    for (const r of reactionRows) {
      if (!r.postId) continue;
      if (!reactionCounts.has(r.postId)) reactionCounts.set(r.postId, new Map());
      reactionCounts.get(r.postId)!.set(r.type, r.reactionCount);
    }

    if (userId) {
      const myReactions = await db
        .select({ postId: reactions.postId, type: reactions.type })
        .from(reactions)
        .where(
          and(
            sql`${reactions.postId} = ANY(${postIds})`,
            eq(reactions.userId, userId),
            isNull(reactions.commentId)
          )
        );

      for (const r of myReactions) {
        if (!r.postId) continue;
        if (!userReactions.has(r.postId)) userReactions.set(r.postId, new Set());
        userReactions.get(r.postId)!.add(r.type);
      }
    }
  }

  const items = rows.map((r) => ({
    id: r.id,
    channelId: r.channelId,
    authorId: r.authorId,
    title: r.title,
    body: r.body,
    pinned: r.pinned,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    author: {
      firstName: r.authorFirstName,
      lastName: r.authorLastName,
    },
    commentCount: commentCounts.get(r.id) ?? 0,
    reactions: Object.fromEntries(reactionCounts.get(r.id) ?? new Map()),
    myReactions: [...(userReactions.get(r.id) ?? [])],
  }));

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function resolvePostChannel(postId: string): Promise<{ postChannelId: string; archived: boolean }> {
  const [row] = await db
    .select({ channelId: posts.channelId, archived: channels.archived })
    .from(posts)
    .innerJoin(channels, eq(channels.id, posts.channelId))
    .where(eq(posts.id, postId))
    .limit(1);

  if (!row) throw new AppError("Discussion introuvable.", 404);
  return { postChannelId: row.channelId, archived: row.archived };
}

export async function resolveCommentChannel(commentId: string): Promise<{ archived: boolean }> {
  const [row] = await db
    .select({ archived: channels.archived })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .innerJoin(channels, eq(channels.id, posts.channelId))
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!row) throw new AppError("Commentaire introuvable.", 404);
  return { archived: row.archived };
}

export async function getPost(postId: string, userId?: string) {
  const [row] = await db
    .select({
      id: posts.id,
      channelId: posts.channelId,
      authorId: posts.authorId,
      title: posts.title,
      body: posts.body,
      pinned: posts.pinned,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      authorFirstName: userProfiles.firstName,
      authorLastName: userProfiles.lastName,
    })
    .from(posts)
    .leftJoin(userProfiles, eq(userProfiles.userId, posts.authorId))
    .where(eq(posts.id, postId))
    .limit(1);

  if (!row) throw new AppError("Discussion introuvable.", 404);

  const reactionRows = await db
    .select({
      type: reactions.type,
      reactionCount: count(reactions.id),
    })
    .from(reactions)
    .where(and(eq(reactions.postId, postId), isNull(reactions.commentId)))
    .groupBy(reactions.type);

  let myReactions: string[] = [];
  if (userId) {
    const my = await db
      .select({ type: reactions.type })
      .from(reactions)
      .where(
        and(
          eq(reactions.postId, postId),
          eq(reactions.userId, userId),
          isNull(reactions.commentId)
        )
      );
    myReactions = my.map((r) => r.type);
  }

  return {
    id: row.id,
    channelId: row.channelId,
    authorId: row.authorId,
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: {
      firstName: row.authorFirstName,
      lastName: row.authorLastName,
    },
    reactions: Object.fromEntries(
      reactionRows.map((r) => [r.type, r.reactionCount])
    ),
    myReactions,
  };
}

export async function createPost(data: {
  channelId: string;
  authorId: string;
  title: string;
  body: string;
}) {
  await getChannel(data.channelId);

  const [post] = await db
    .insert(posts)
    .values({
      channelId: data.channelId,
      authorId: data.authorId,
      title: data.title,
      body: data.body,
    })
    .returning();

  return post;
}

export async function updatePost(
  postId: string,
  userId: string,
  isAdmin: boolean,
  data: { title?: string; body?: string }
) {
  const [existing] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!existing) throw new AppError("Discussion introuvable.", 404);
  if (existing.authorId !== userId && !isAdmin) {
    throw new AppError("Non autorisé.", 403);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) updates.title = data.title;
  if (data.body !== undefined) updates.body = data.body;

  const [updated] = await db
    .update(posts)
    .set(updates)
    .where(eq(posts.id, postId))
    .returning();

  return updated;
}

export async function deletePost(
  postId: string,
  userId: string,
  isAdmin: boolean
) {
  const [existing] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!existing) throw new AppError("Discussion introuvable.", 404);
  if (existing.authorId !== userId && !isAdmin) {
    throw new AppError("Non autorisé.", 403);
  }

  await db.delete(posts).where(eq(posts.id, postId));
  return { ok: true };
}

export async function togglePin(postId: string) {
  const [existing] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!existing) throw new AppError("Discussion introuvable.", 404);

  const [updated] = await db
    .update(posts)
    .set({ pinned: !existing.pinned, updatedAt: new Date() })
    .where(eq(posts.id, postId))
    .returning();

  return updated;
}

export async function listComments(postId: string, userId?: string) {
  const rows = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      authorId: comments.authorId,
      body: comments.body,
      createdAt: comments.createdAt,
      authorFirstName: userProfiles.firstName,
      authorLastName: userProfiles.lastName,
    })
    .from(comments)
    .leftJoin(userProfiles, eq(userProfiles.userId, comments.authorId))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));

  const commentIds = rows.map((r) => r.id);
  let reactionCounts = new Map<string, Map<string, number>>();
  let userReactions = new Map<string, Set<string>>();

  if (commentIds.length > 0) {
    const reactionRows = await db
      .select({
        commentId: reactions.commentId,
        type: reactions.type,
        reactionCount: count(reactions.id),
      })
      .from(reactions)
      .where(sql`${reactions.commentId} = ANY(${commentIds})`)
      .groupBy(reactions.commentId, reactions.type);

    for (const r of reactionRows) {
      if (!r.commentId) continue;
      if (!reactionCounts.has(r.commentId))
        reactionCounts.set(r.commentId, new Map());
      reactionCounts.get(r.commentId)!.set(r.type, r.reactionCount);
    }

    if (userId) {
      const myReactions = await db
        .select({ commentId: reactions.commentId, type: reactions.type })
        .from(reactions)
        .where(
          and(
            sql`${reactions.commentId} = ANY(${commentIds})`,
            eq(reactions.userId, userId)
          )
        );

      for (const r of myReactions) {
        if (!r.commentId) continue;
        if (!userReactions.has(r.commentId))
          userReactions.set(r.commentId, new Set());
        userReactions.get(r.commentId)!.add(r.type);
      }
    }
  }

  return rows.map((r) => ({
    id: r.id,
    postId: r.postId,
    authorId: r.authorId,
    body: r.body,
    createdAt: r.createdAt,
    author: {
      firstName: r.authorFirstName,
      lastName: r.authorLastName,
    },
    reactions: Object.fromEntries(reactionCounts.get(r.id) ?? new Map()),
    myReactions: [...(userReactions.get(r.id) ?? [])],
  }));
}

export async function createComment(data: {
  postId: string;
  authorId: string;
  body: string;
}) {
  const [existing] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, data.postId))
    .limit(1);

  if (!existing) throw new AppError("Discussion introuvable.", 404);

  const [comment] = await db
    .insert(comments)
    .values({
      postId: data.postId,
      authorId: data.authorId,
      body: data.body,
    })
    .returning();

  return comment;
}

export async function updateComment(
  commentId: string,
  userId: string,
  isAdmin: boolean,
  body: string
) {
  const [existing] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!existing) throw new AppError("Commentaire introuvable.", 404);
  if (existing.authorId !== userId && !isAdmin) {
    throw new AppError("Non autorisé.", 403);
  }

  const [updated] = await db
    .update(comments)
    .set({ body })
    .where(eq(comments.id, commentId))
    .returning();

  return updated;
}

export async function deleteComment(
  commentId: string,
  userId: string,
  isAdmin: boolean
) {
  const [existing] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!existing) throw new AppError("Commentaire introuvable.", 404);
  if (existing.authorId !== userId && !isAdmin) {
    throw new AppError("Non autorisé.", 403);
  }

  await db.delete(comments).where(eq(comments.id, commentId));
  return { ok: true };
}

export async function toggleReaction(data: {
  userId: string;
  postId?: string;
  commentId?: string;
  type: string;
}) {
  if (!data.postId && !data.commentId) {
    throw new AppError("postId ou commentId requis.", 400);
  }
  if (data.postId && data.commentId) {
    throw new AppError("Un seul de postId ou commentId.", 400);
  }

  const conditions = [
    eq(reactions.userId, data.userId),
    eq(reactions.type, data.type),
  ];

  if (data.postId) {
    conditions.push(eq(reactions.postId, data.postId));
    conditions.push(isNull(reactions.commentId));
  } else {
    conditions.push(isNull(reactions.postId));
    conditions.push(eq(reactions.commentId, data.commentId!));
  }

  const [existing] = await db
    .select()
    .from(reactions)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    await db.delete(reactions).where(eq(reactions.id, existing.id));
    return { action: "removed" as const, type: data.type };
  }

  await db.insert(reactions).values({
    userId: data.userId,
    postId: data.postId ?? null,
    commentId: data.commentId ?? null,
    type: data.type,
  });

  return { action: "added" as const, type: data.type };
}
