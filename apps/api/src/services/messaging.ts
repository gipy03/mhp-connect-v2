import { and, eq, desc, lt, isNull, inArray, sql, ne } from "drizzle-orm";
import {
  conversations,
  conversationParticipants,
  messages,
  users,
  userProfiles,
} from "@mhp/shared";
import { db } from "../db.js";
import { AppError } from "../lib/errors.js";
import { queue } from "./notification.js";
import { resolveUserFeatures } from "../middleware/featureAccess.js";
import { hasAcceptedContact } from "./contacts.js";

interface LastMsgRow {
  conversation_id: string;
  body: string;
  sender_id: string;
  created_at: Date | null;
  first_name: string | null;
  last_name: string | null;
}

interface UnreadRow {
  conversation_id: string;
  cnt: number;
}

interface TotalUnreadRow {
  total: number;
}

export interface ConversationListItem {
  id: string;
  title: string | null;
  isGroup: boolean;
  createdBy: string | null;
  lastMessageAt: string | null;
  createdAt: string | null;
  lastMessage: {
    body: string;
    senderId: string;
    senderName: string;
    createdAt: string | null;
  } | null;
  participants: {
    userId: string;
    firstName: string | null;
    lastName: string | null;
  }[];
  unreadCount: number;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  senderFirstName: string | null;
  senderLastName: string | null;
  body: string;
  createdAt: string | null;
}

async function assertParticipant(conversationId: string, userId: string) {
  const [row] = await db
    .select({ id: conversationParticipants.id })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
        isNull(conversationParticipants.leftAt)
      )
    )
    .limit(1);
  if (!row) throw new AppError("Vous ne faites pas partie de cette conversation.", 403);
}

export async function listConversations(userId: string): Promise<ConversationListItem[]> {
  const myConvIds = await db
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.userId, userId),
        isNull(conversationParticipants.leftAt)
      )
    );

  if (myConvIds.length === 0) return [];

  const ids = myConvIds.map((r) => r.conversationId);

  const convRows = await db
    .select()
    .from(conversations)
    .where(inArray(conversations.id, ids))
    .orderBy(desc(conversations.lastMessageAt));

  const allParticipants = await db
    .select({
      conversationId: conversationParticipants.conversationId,
      userId: conversationParticipants.userId,
      lastReadAt: conversationParticipants.lastReadAt,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
    })
    .from(conversationParticipants)
    .leftJoin(userProfiles, eq(conversationParticipants.userId, userProfiles.userId))
    .where(
      and(
        inArray(conversationParticipants.conversationId, ids),
        isNull(conversationParticipants.leftAt)
      )
    );

  const lastMsgRows = await db.execute(sql`
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.body,
      m.sender_id,
      m.created_at,
      up.first_name,
      up.last_name
    FROM messages m
    LEFT JOIN user_profiles up ON m.sender_id = up.user_id
    WHERE m.conversation_id = ANY(${ids})
    ORDER BY m.conversation_id, m.created_at DESC
  `);

  const lastMsgMap = new Map<string, { body: string; senderId: string; createdAt: Date | null; firstName: string | null; lastName: string | null }>();
  for (const row of lastMsgRows.rows as unknown as LastMsgRow[]) {
    lastMsgMap.set(row.conversation_id, {
      body: row.body,
      senderId: row.sender_id,
      createdAt: row.created_at,
      firstName: row.first_name,
      lastName: row.last_name,
    });
  }

  const participantMap = new Map<string, typeof allParticipants>();
  for (const p of allParticipants) {
    const list = participantMap.get(p.conversationId) ?? [];
    list.push(p);
    participantMap.set(p.conversationId, list);
  }

  const unreadRows = await db.execute(sql`
    SELECT m.conversation_id, count(*)::int AS cnt
    FROM messages m
    INNER JOIN conversation_participants cp
      ON cp.conversation_id = m.conversation_id
      AND cp.user_id = ${userId}
      AND cp.left_at IS NULL
    WHERE m.conversation_id = ANY(${ids})
      AND m.sender_id != ${userId}
      AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
    GROUP BY m.conversation_id
  `);

  const unreadMap = new Map<string, number>();
  for (const row of unreadRows.rows as unknown as UnreadRow[]) {
    unreadMap.set(row.conversation_id, row.cnt);
  }

  const result: ConversationListItem[] = [];

  for (const conv of convRows) {
    const parts = participantMap.get(conv.id) ?? [];
    const lastMsg = lastMsgMap.get(conv.id);

    result.push({
      id: conv.id,
      title: conv.title,
      isGroup: conv.isGroup,
      createdBy: conv.createdBy,
      lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
      createdAt: conv.createdAt?.toISOString() ?? null,
      lastMessage: lastMsg
        ? {
            body: lastMsg.body,
            senderId: lastMsg.senderId,
            senderName: [lastMsg.firstName, lastMsg.lastName].filter(Boolean).join(" ") || "Membre",
            createdAt: lastMsg.createdAt?.toISOString() ?? null,
          }
        : null,
      participants: parts.map((p) => ({
        userId: p.userId,
        firstName: p.firstName,
        lastName: p.lastName,
      })),
      unreadCount: unreadMap.get(conv.id) ?? 0,
    });
  }

  return result;
}

export async function createConversation(
  creatorId: string,
  participantIds: string[],
  title?: string
): Promise<{ id: string }> {
  const allIds = [...new Set([creatorId, ...participantIds])];

  if (allIds.length < 2) {
    throw new AppError("Au moins un autre participant est requis.", 400);
  }

  const existingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, allIds));

  if (existingUsers.length !== allIds.length) {
    throw new AppError("Un ou plusieurs utilisateurs introuvables.", 400);
  }

  const otherIds = allIds.filter((id) => id !== creatorId);
  for (const uid of otherIds) {
    const features = await resolveUserFeatures(uid);
    if (!features.has("community")) {
      throw new AppError("Un ou plusieurs utilisateurs n'ont pas accès à la communauté.", 403);
    }
  }

  const isGroup = allIds.length > 2;

  if (!isGroup) {
    const otherId = allIds.find((id) => id !== creatorId)!;

    const isContact = await hasAcceptedContact(creatorId, otherId);
    if (!isContact) {
      throw new AppError(
        "Vous devez d'abord être en contact avec cette personne pour lui envoyer un message.",
        403
      );
    }

    const existing = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.userId, creatorId),
          isNull(conversationParticipants.leftAt)
        )
      );

    if (existing.length > 0) {
      const convIds = existing.map((e) => e.conversationId);
      const otherParticipant = await db
        .select({ conversationId: conversationParticipants.conversationId })
        .from(conversationParticipants)
        .innerJoin(conversations, eq(conversationParticipants.conversationId, conversations.id))
        .where(
          and(
            inArray(conversationParticipants.conversationId, convIds),
            eq(conversationParticipants.userId, otherId),
            isNull(conversationParticipants.leftAt),
            eq(conversations.isGroup, false)
          )
        )
        .limit(1);

      if (otherParticipant.length > 0) {
        return { id: otherParticipant[0].conversationId };
      }
    }
  }

  const [conv] = await db
    .insert(conversations)
    .values({
      title: isGroup ? (title?.trim() || null) : null,
      isGroup,
      createdBy: creatorId,
    })
    .returning({ id: conversations.id });

  await db.insert(conversationParticipants).values(
    allIds.map((uid) => ({
      conversationId: conv.id,
      userId: uid,
    }))
  );

  return { id: conv.id };
}

export async function getMessages(
  conversationId: string,
  userId: string,
  cursor?: string,
  limit = 50
): Promise<{ items: MessageItem[]; hasMore: boolean }> {
  await assertParticipant(conversationId, userId);

  const safeLimit = Math.min(Math.max(limit, 1), 100);

  let query = db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      senderFirstName: userProfiles.firstName,
      senderLastName: userProfiles.lastName,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .leftJoin(userProfiles, eq(messages.senderId, userProfiles.userId))
    .where(
      cursor
        ? and(
            eq(messages.conversationId, conversationId),
            lt(messages.createdAt, new Date(cursor))
          )
        : eq(messages.conversationId, conversationId)
    )
    .orderBy(desc(messages.createdAt))
    .limit(safeLimit + 1);

  const rows = await query;
  const hasMore = rows.length > safeLimit;
  const items = rows.slice(0, safeLimit).map((r) => ({
    ...r,
    createdAt: r.createdAt?.toISOString() ?? null,
  }));

  return { items, hasMore };
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<MessageItem> {
  await assertParticipant(conversationId, senderId);

  const now = new Date();

  const [msg] = await db
    .insert(messages)
    .values({ conversationId, senderId, body })
    .returning();

  await db
    .update(conversations)
    .set({ lastMessageAt: now })
    .where(eq(conversations.id, conversationId));

  await db
    .update(conversationParticipants)
    .set({ lastReadAt: now })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, senderId)
      )
    );

  const [profile] = await db
    .select({ firstName: userProfiles.firstName, lastName: userProfiles.lastName })
    .from(userProfiles)
    .where(eq(userProfiles.userId, senderId))
    .limit(1);

  const senderName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Membre";

  const otherParticipants = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        ne(conversationParticipants.userId, senderId),
        isNull(conversationParticipants.leftAt)
      )
    );

  for (const p of otherParticipants) {
    await queue("new_message", p.userId, {
      senderName,
      messagePreview: body.length > 100 ? body.slice(0, 100) + "..." : body,
      conversationId,
    }, "internal");
  }

  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    senderFirstName: profile?.firstName ?? null,
    senderLastName: profile?.lastName ?? null,
    body: msg.body,
    createdAt: msg.createdAt?.toISOString() ?? null,
  };
}

export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<void> {
  await assertParticipant(conversationId, userId);

  await db
    .update(conversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      )
    );
}

export async function addParticipants(
  conversationId: string,
  requesterId: string,
  userIds: string[]
): Promise<void> {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conv) throw new AppError("Conversation introuvable.", 404);
  if (!conv.isGroup) throw new AppError("Impossible d'ajouter des participants à une conversation privée.", 400);
  if (conv.createdBy !== requesterId) throw new AppError("Seul le créateur peut ajouter des participants.", 403);

  await assertParticipant(conversationId, requesterId);

  const existingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, userIds));

  const validIds = existingUsers.map((u) => u.id);
  if (validIds.length === 0) return;

  for (const uid of validIds) {
    const features = await resolveUserFeatures(uid);
    if (!features.has("community")) {
      throw new AppError("Un ou plusieurs utilisateurs n'ont pas accès à la communauté.", 403);
    }
  }

  for (const uid of validIds) {
    const [existing] = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, uid)
        )
      )
      .limit(1);

    if (existing && !existing.leftAt) continue;

    if (existing) {
      await db
        .update(conversationParticipants)
        .set({ leftAt: null, joinedAt: new Date() })
        .where(eq(conversationParticipants.id, existing.id));
    } else {
      await db.insert(conversationParticipants).values({
        conversationId,
        userId: uid,
      });
    }
  }
}

export async function removeParticipant(
  conversationId: string,
  requesterId: string,
  targetUserId: string
): Promise<void> {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conv) throw new AppError("Conversation introuvable.", 404);
  if (!conv.isGroup) throw new AppError("Impossible de retirer des participants d'une conversation privée.", 400);
  if (conv.createdBy !== requesterId) throw new AppError("Seul le créateur peut retirer des participants.", 403);
  if (targetUserId === requesterId) throw new AppError("Utilisez la route de départ pour quitter.", 400);

  await assertParticipant(conversationId, requesterId);

  await db
    .update(conversationParticipants)
    .set({ leftAt: new Date() })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, targetUserId),
        isNull(conversationParticipants.leftAt)
      )
    );
}

export async function leaveConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conv) throw new AppError("Conversation introuvable.", 404);
  if (!conv.isGroup) throw new AppError("Impossible de quitter une conversation privée.", 400);

  await db
    .update(conversationParticipants)
    .set({ leftAt: new Date() })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
        isNull(conversationParticipants.leftAt)
      )
    );
}

export async function getTotalUnreadCount(userId: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(unread.cnt), 0)::int AS total
    FROM (
      SELECT count(*) AS cnt
      FROM messages m
      INNER JOIN conversation_participants cp
        ON cp.conversation_id = m.conversation_id
        AND cp.user_id = ${userId}
        AND cp.left_at IS NULL
      WHERE m.sender_id != ${userId}
        AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
    ) unread
  `);

  const row = result.rows[0] as unknown as TotalUnreadRow | undefined;
  return row?.total ?? 0;
}
