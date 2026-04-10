import { and, desc, eq, gte, lt, lte, inArray, or } from "drizzle-orm";
import {
  notifications,
  notificationTemplates,
  users,
  userProfiles,
  sessionAssignments,
  programEnrollments,
  digiformaSessions,
  programOverrides,
  communityEvents,
  eventRsvps,
  type Notification,
  type NotificationTemplate,
} from "@mhp/shared";
import { sendEmail } from "@mhp/integrations/email";
import { db } from "../db.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

const MAX_RETRIES = 3;

function computeNextRetry(retryCount: number): Date {
  const delayMs = Math.pow(2, retryCount) * 30_000;
  return new Date(Date.now() + delayMs);
}

// ---------------------------------------------------------------------------
// queue — called at business-event time
// ---------------------------------------------------------------------------

export async function queue(
  eventType: string,
  recipientId: string,
  mergeData: Record<string, unknown>,
  channel: "email" | "internal" = "email"
): Promise<void> {
  const [template] = await db
    .select({ id: notificationTemplates.id })
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.eventType, eventType),
        eq(notificationTemplates.active, true)
      )
    )
    .limit(1);

  await db.insert(notifications).values({
    recipientId,
    templateId: template?.id ?? null,
    channel,
    status: "pending",
    mergeData,
  });
}

export async function queueBoth(
  eventType: string,
  recipientId: string,
  mergeData: Record<string, unknown>
): Promise<void> {
  const [template] = await db
    .select({ id: notificationTemplates.id })
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.eventType, eventType),
        eq(notificationTemplates.active, true)
      )
    )
    .limit(1);

  await db.insert(notifications).values([
    {
      recipientId,
      templateId: template?.id ?? null,
      channel: "email",
      status: "pending",
      mergeData,
    },
    {
      recipientId,
      templateId: template?.id ?? null,
      channel: "internal",
      status: "pending",
      mergeData,
    },
  ]);
}

// ---------------------------------------------------------------------------
// processPending — background worker (called every ~30 seconds)
// ---------------------------------------------------------------------------

export async function processPending(batchSize = 50): Promise<void> {
  const now = new Date();

  const rows = await db
    .select({
      notification: notifications,
      recipientEmail: users.email,
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.recipientId, users.id))
    .where(
      or(
        eq(notifications.status, "pending"),
        and(
          eq(notifications.status, "failed"),
          lt(notifications.retryCount, MAX_RETRIES),
          lte(notifications.nextRetryAt, now)
        )
      )
    )
    .limit(batchSize);

  for (const { notification, recipientEmail } of rows) {
    try {
      if (notification.channel === "email") {
        const { subject, html } = await renderNotification(notification);
        await sendEmail(recipientEmail, subject, html);
      }

      await db
        .update(notifications)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(notifications.id, notification.id));
    } catch (err) {
      const newRetryCount = notification.retryCount + 1;
      const reachedMax = newRetryCount >= MAX_RETRIES;

      logger.error({ err, notificationId: notification.id, retryCount: newRetryCount }, "Notification processing failed");

      await db
        .update(notifications)
        .set({
          status: "failed",
          retryCount: newRetryCount,
          nextRetryAt: reachedMax ? null : computeNextRetry(newRetryCount),
        })
        .where(eq(notifications.id, notification.id))
        .catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// getForUser — internal bell icon (channel = "internal")
// ---------------------------------------------------------------------------

export async function getForUser(userId: string, limit = 50): Promise<Notification[]> {
  return db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, userId),
        eq(notifications.channel, "internal")
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

// ---------------------------------------------------------------------------
// markRead
// ---------------------------------------------------------------------------

export async function markRead(
  notificationId: string,
  userId: string
): Promise<void> {
  const [updated] = await db
    .update(notifications)
    .set({ status: "read" })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.recipientId, userId)
      )
    )
    .returning({ id: notifications.id });

  if (!updated) throw new AppError("Notification introuvable.", 404);
}

// ---------------------------------------------------------------------------
// Admin: template management
// ---------------------------------------------------------------------------

export async function getTemplates(): Promise<NotificationTemplate[]> {
  return db.select().from(notificationTemplates);
}

export async function testSendTemplate(
  templateId: string,
  recipientEmail: string
): Promise<void> {
  const [template] = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.id, templateId))
    .limit(1);

  if (!template) throw new AppError("Modèle de notification introuvable.", 404);

  const placeholderData: Record<string, string> = {
    firstName: "Jean",
    lastName: "Dupont",
    email: recipientEmail,
    programName: "OMNI Praticien",
    programCode: "OMNI-PRACT",
    sessionId: "SES-001",
    sessionDate: new Date().toLocaleDateString("fr-CH"),
    enrolledAt: new Date().toLocaleDateString("fr-CH"),
    documentNr: "INV-2026-001",
    amount: "490.00",
    credentialName: "OMNI Praticien Certifié",
    issuedAt: new Date().toLocaleDateString("fr-CH"),
    badgeUrl: "",
    certificateUrl: "",
    refundStatus: "approved",
    adminNote: "Test de l'envoi.",
    mentionedBy: "Marie Martin",
    channelName: "Général",
    postUrl: "#",
    oldSessionId: "SES-000",
    newSessionId: "SES-002",
  };

  const subject = renderMergeTags(
    template.subject ?? "Test — mhp | connect",
    placeholderData
  );
  const html = renderMergeTags(template.body ?? "", placeholderData);

  await sendEmail(recipientEmail, `[TEST] ${subject}`, html);
}

export async function updateTemplate(
  id: string,
  subject: string | null,
  body: string | null,
  active: boolean
): Promise<NotificationTemplate> {
  const [updated] = await db
    .update(notificationTemplates)
    .set({ subject, body, active, updatedAt: new Date() })
    .where(eq(notificationTemplates.id, id))
    .returning();

  if (!updated) throw new AppError("Modèle de notification introuvable.", 404);
  return updated;
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

async function renderNotification(
  notification: Notification
): Promise<{ subject: string; html: string }> {
  const defaultSubject = "Notification — mhp | connect";
  const mergeData = (notification.mergeData as Record<string, unknown>) ?? {};

  if (!notification.templateId) {
    return { subject: defaultSubject, html: "" };
  }

  const [template] = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.id, notification.templateId))
    .limit(1);

  if (!template) return { subject: defaultSubject, html: "" };

  return {
    subject: renderMergeTags(template.subject ?? defaultSubject, mergeData),
    html: renderMergeTags(template.body ?? "", mergeData),
  };
}

function renderMergeTags(
  template: string,
  data: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = data[key];
    return val != null ? String(val) : "";
  });
}

// ---------------------------------------------------------------------------
// Session reminder — queues notifications for sessions starting in 6-8 days
// ---------------------------------------------------------------------------

export async function processSessionReminders(): Promise<void> {
  const now = new Date();
  const windowStartDate = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
  const windowEndDate = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
  const windowStart = windowStartDate.toISOString().split("T")[0]!;
  const windowEnd = new Date(
    windowEndDate.getFullYear(),
    windowEndDate.getMonth(),
    windowEndDate.getDate() + 1
  )
    .toISOString()
    .split("T")[0]!;

  const upcomingSessions = await db
    .select()
    .from(digiformaSessions)
    .where(
      and(
        gte(digiformaSessions.startDate, windowStart),
        lt(digiformaSessions.startDate, windowEnd)
      )
    );

  if (upcomingSessions.length === 0) return;

  const sessionIds = upcomingSessions.map((s) => s.digiformaId);

  const assignments = await db
    .select({
      userId: programEnrollments.userId,
      sessionId: sessionAssignments.sessionId,
      programCode: programEnrollments.programCode,
    })
    .from(sessionAssignments)
    .innerJoin(
      programEnrollments,
      eq(sessionAssignments.enrollmentId, programEnrollments.id)
    )
    .where(
      and(
        inArray(sessionAssignments.sessionId, sessionIds),
        eq(sessionAssignments.status, "assigned")
      )
    );

  if (assignments.length === 0) return;

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [reminderTemplate] = await db
    .select({ id: notificationTemplates.id })
    .from(notificationTemplates)
    .where(eq(notificationTemplates.eventType, "session_reminder"))
    .limit(1);

  const alreadySent = new Set<string>();
  if (reminderTemplate) {
    const existing = await db
      .select({ recipientId: notifications.recipientId, mergeData: notifications.mergeData })
      .from(notifications)
      .where(
        and(
          eq(notifications.channel, "email"),
          eq(notifications.templateId, reminderTemplate.id),
          gte(notifications.createdAt, sevenDaysAgo)
        )
      );

    for (const n of existing) {
      const md = n.mergeData as Record<string, unknown> | null;
      if (md?.sessionId) {
        alreadySent.add(`${n.recipientId}:${md.sessionId}`);
      }
    }
  }

  const sessionMap = new Map(upcomingSessions.map((s) => [s.digiformaId, s]));

  const userIds = [...new Set(assignments.map((a) => a.userId))];
  const profiles = await db
    .select({
      userId: userProfiles.userId,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
    })
    .from(userProfiles)
    .where(inArray(userProfiles.userId, userIds));
  const profileMap = new Map(profiles.map((p) => [p.userId, p]));

  const programCodes = [...new Set(assignments.map((a) => a.programCode))];
  const overrides = await db
    .select({
      programCode: programOverrides.programCode,
      displayName: programOverrides.displayName,
    })
    .from(programOverrides)
    .where(inArray(programOverrides.programCode, programCodes));
  const overrideMap = new Map(overrides.map((o) => [o.programCode, o]));

  let queued = 0;
  for (const assignment of assignments) {
    const session = sessionMap.get(assignment.sessionId);
    if (!session) continue;

    const dedupeKey = `${assignment.userId}:${assignment.sessionId}`;
    if (alreadySent.has(dedupeKey)) continue;

    const profile = profileMap.get(assignment.userId);
    const override = overrideMap.get(assignment.programCode);

    const startDate = session.startDate
      ? new Date(session.startDate).toLocaleDateString("fr-CH")
      : "";

    await queue("session_reminder", assignment.userId, {
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      programName: override?.displayName ?? session.programName ?? assignment.programCode,
      sessionDate: startDate,
      sessionId: assignment.sessionId,
      place: session.placeName ?? session.place ?? "",
    });
    queued++;
  }

  logger.info({ queued, windowStart, windowEnd }, "Session reminders processed");
}

// ---------------------------------------------------------------------------
// Event reminder — queues notifications for community events (24h and 1h before)
// ---------------------------------------------------------------------------

export async function processEventReminders(): Promise<void> {
  const now = new Date();

  const windows = [
    { label: "24h", offsetMs: 24 * 60 * 60 * 1000, toleranceMs: 15 * 60 * 1000 },
    { label: "1h", offsetMs: 1 * 60 * 60 * 1000, toleranceMs: 15 * 60 * 1000 },
  ];

  for (const { label, offsetMs, toleranceMs } of windows) {
    const windowStart = new Date(now.getTime() + offsetMs - toleranceMs);
    const windowEnd = new Date(now.getTime() + offsetMs + toleranceMs);

    const upcomingEvents = await db
      .select()
      .from(communityEvents)
      .where(
        and(
          eq(communityEvents.published, true),
          gte(communityEvents.startAt, windowStart),
          lt(communityEvents.startAt, windowEnd)
        )
      );

    if (upcomingEvents.length === 0) continue;

    const eventIds = upcomingEvents.map((e) => e.id);

    const rsvps = await db
      .select({
        userId: eventRsvps.userId,
        eventId: eventRsvps.eventId,
      })
      .from(eventRsvps)
      .where(
        and(
          inArray(eventRsvps.eventId, eventIds),
          inArray(eventRsvps.status, ["attending", "maybe"])
        )
      );

    if (rsvps.length === 0) continue;

    const [reminderTemplate] = await db
      .select({ id: notificationTemplates.id })
      .from(notificationTemplates)
      .where(eq(notificationTemplates.eventType, "event_reminder"))
      .limit(1);

    const alreadySent = new Set<string>();
    if (reminderTemplate) {
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const existing = await db
        .select({ recipientId: notifications.recipientId, mergeData: notifications.mergeData })
        .from(notifications)
        .where(
          and(
            eq(notifications.channel, "email"),
            eq(notifications.templateId, reminderTemplate.id),
            gte(notifications.createdAt, twoDaysAgo)
          )
        );

      for (const n of existing) {
        const md = n.mergeData as Record<string, unknown> | null;
        if (md?.eventId && md?.reminderType) {
          alreadySent.add(`${n.recipientId}:${md.eventId}:${md.reminderType}`);
        }
      }
    }

    const eventMap = new Map(upcomingEvents.map((e) => [e.id, e]));

    const userIds = [...new Set(rsvps.map((r) => r.userId))];
    const profiles = await db
      .select({
        userId: userProfiles.userId,
        firstName: userProfiles.firstName,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, userIds));
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    let queued = 0;
    for (const rsvp of rsvps) {
      const event = eventMap.get(rsvp.eventId);
      if (!event) continue;

      const dedupeKey = `${rsvp.userId}:${rsvp.eventId}:${label}`;
      if (alreadySent.has(dedupeKey)) continue;

      const profile = profileMap.get(rsvp.userId);

      await queue("event_reminder", rsvp.userId, {
        firstName: profile?.firstName ?? "",
        eventTitle: event.title,
        eventId: event.id,
        reminderType: label,
        eventDate: event.startAt.toLocaleDateString("fr-CH"),
        eventTime: event.startAt.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" }),
        location: event.location ?? (event.isRemote ? "En ligne" : ""),
      });
      queued++;
    }

    if (queued > 0) {
      logger.info({ queued, label }, "Event reminders processed");
    }
  }
}
