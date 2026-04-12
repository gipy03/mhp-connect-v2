import { and, eq, or, sql, inArray, desc } from "drizzle-orm";
import { userContacts, userProfiles, users } from "@mhp/shared";
import { db } from "../db.js";
import { AppError } from "../lib/errors.js";
import { queueBoth } from "./notification.js";
import { logger } from "../lib/logger.js";

export interface ContactListItem {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  createdAt: string | null;
}

export interface ContactRequestItem {
  id: string;
  requesterId: string;
  requesterFirstName: string | null;
  requesterLastName: string | null;
  message: string | null;
  createdAt: string | null;
}

export async function sendContactRequest(
  requesterId: string,
  recipientId: string,
  message?: string
): Promise<{ id: string }> {
  if (requesterId === recipientId) {
    throw new AppError("Impossible de vous ajouter vous-même.", 400);
  }

  const [recipientExists] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, recipientId))
    .limit(1);

  if (!recipientExists) {
    throw new AppError("Utilisateur introuvable.", 404);
  }

  const [existing] = await db
    .select({ id: userContacts.id, status: userContacts.status })
    .from(userContacts)
    .where(
      or(
        and(
          eq(userContacts.requesterId, requesterId),
          eq(userContacts.recipientId, recipientId)
        ),
        and(
          eq(userContacts.requesterId, recipientId),
          eq(userContacts.recipientId, requesterId)
        )
      )
    )
    .limit(1);

  if (existing) {
    if (existing.status === "accepted") {
      throw new AppError("Ce contact existe déjà.", 400);
    }
    if (existing.status === "pending") {
      throw new AppError("Une demande de contact est déjà en cours.", 400);
    }
    if (existing.status === "rejected") {
      await db
        .update(userContacts)
        .set({
          requesterId,
          recipientId,
          status: "pending",
          message: message?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(userContacts.id, existing.id));

      await notifyContactRequest(requesterId, recipientId);
      return { id: existing.id };
    }
  }

  const [contact] = await db
    .insert(userContacts)
    .values({
      requesterId,
      recipientId,
      status: "pending",
      message: message?.trim() || null,
    })
    .returning({ id: userContacts.id });

  await notifyContactRequest(requesterId, recipientId);

  return { id: contact.id };
}

async function notifyContactRequest(requesterId: string, recipientId: string) {
  try {
    const [requesterProfile] = await db
      .select({ firstName: userProfiles.firstName, lastName: userProfiles.lastName })
      .from(userProfiles)
      .where(eq(userProfiles.userId, requesterId))
      .limit(1);

    const senderName = [requesterProfile?.firstName, requesterProfile?.lastName]
      .filter(Boolean)
      .join(" ") || "Un membre";

    await queueBoth("contact_request", recipientId, { senderName });
  } catch (err) {
    logger.warn({ requesterId, recipientId, err }, "Failed to queue contact request notification");
  }
}

export async function listAcceptedContacts(userId: string): Promise<ContactListItem[]> {
  const rows = await db.execute(sql`
    SELECT
      uc.id,
      CASE WHEN uc.requester_id = ${userId} THEN uc.recipient_id ELSE uc.requester_id END AS "userId",
      up.first_name AS "firstName",
      up.last_name AS "lastName",
      uc.status,
      uc.created_at AS "createdAt"
    FROM user_contacts uc
    LEFT JOIN user_profiles up ON up.user_id = CASE WHEN uc.requester_id = ${userId} THEN uc.recipient_id ELSE uc.requester_id END
    WHERE (uc.requester_id = ${userId} OR uc.recipient_id = ${userId})
      AND uc.status = 'accepted'
    ORDER BY up.first_name ASC, up.last_name ASC
  `);

  return (rows.rows as unknown as ContactListItem[]).map((r) => ({
    ...r,
    createdAt: r.createdAt ? String(r.createdAt) : null,
  }));
}

export async function listPendingRequests(userId: string): Promise<ContactRequestItem[]> {
  const rows = await db.execute(sql`
    SELECT
      uc.id,
      uc.requester_id AS "requesterId",
      up.first_name AS "requesterFirstName",
      up.last_name AS "requesterLastName",
      uc.message,
      uc.created_at AS "createdAt"
    FROM user_contacts uc
    LEFT JOIN user_profiles up ON up.user_id = uc.requester_id
    WHERE uc.recipient_id = ${userId}
      AND uc.status = 'pending'
    ORDER BY uc.created_at DESC
  `);

  return (rows.rows as unknown as ContactRequestItem[]).map((r) => ({
    ...r,
    createdAt: r.createdAt ? String(r.createdAt) : null,
  }));
}

export async function acceptContactRequest(contactId: string, userId: string): Promise<void> {
  const [contact] = await db
    .select()
    .from(userContacts)
    .where(eq(userContacts.id, contactId))
    .limit(1);

  if (!contact) throw new AppError("Demande introuvable.", 404);
  if (contact.recipientId !== userId) throw new AppError("Non autorisé.", 403);
  if (contact.status !== "pending") throw new AppError("Cette demande n'est plus en attente.", 400);

  await db
    .update(userContacts)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(userContacts.id, contactId));
}

export async function rejectContactRequest(contactId: string, userId: string): Promise<void> {
  const [contact] = await db
    .select()
    .from(userContacts)
    .where(eq(userContacts.id, contactId))
    .limit(1);

  if (!contact) throw new AppError("Demande introuvable.", 404);
  if (contact.recipientId !== userId) throw new AppError("Non autorisé.", 403);
  if (contact.status !== "pending") throw new AppError("Cette demande n'est plus en attente.", 400);

  await db
    .update(userContacts)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(userContacts.id, contactId));
}

export async function hasAcceptedContact(userId1: string, userId2: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userContacts.id })
    .from(userContacts)
    .where(
      and(
        or(
          and(
            eq(userContacts.requesterId, userId1),
            eq(userContacts.recipientId, userId2)
          ),
          and(
            eq(userContacts.requesterId, userId2),
            eq(userContacts.recipientId, userId1)
          )
        ),
        eq(userContacts.status, "accepted")
      )
    )
    .limit(1);

  return !!row;
}

export async function getContactStatus(
  userId: string,
  otherUserId: string
): Promise<{ status: string | null; contactId: string | null }> {
  const [row] = await db
    .select({ id: userContacts.id, status: userContacts.status, requesterId: userContacts.requesterId })
    .from(userContacts)
    .where(
      or(
        and(
          eq(userContacts.requesterId, userId),
          eq(userContacts.recipientId, otherUserId)
        ),
        and(
          eq(userContacts.requesterId, otherUserId),
          eq(userContacts.recipientId, userId)
        )
      )
    )
    .limit(1);

  if (!row) return { status: null, contactId: null };
  return { status: row.status, contactId: row.id };
}

export async function getContactStatusBulk(
  userId: string,
  otherUserIds: string[]
): Promise<Map<string, { status: string; contactId: string }>> {
  if (otherUserIds.length === 0) return new Map();

  const rows = await db
    .select({
      id: userContacts.id,
      requesterId: userContacts.requesterId,
      recipientId: userContacts.recipientId,
      status: userContacts.status,
    })
    .from(userContacts)
    .where(
      or(
        and(
          eq(userContacts.requesterId, userId),
          inArray(userContacts.recipientId, otherUserIds)
        ),
        and(
          eq(userContacts.recipientId, userId),
          inArray(userContacts.requesterId, otherUserIds)
        )
      )
    );

  const map = new Map<string, { status: string; contactId: string }>();
  for (const row of rows) {
    const otherUserId = row.requesterId === userId ? row.recipientId : row.requesterId;
    map.set(otherUserId, { status: row.status, contactId: row.id });
  }

  return map;
}
