import { and, desc, eq } from "drizzle-orm";
import {
  notifications,
  notificationTemplates,
  users,
  type Notification,
  type NotificationTemplate,
} from "@mhp/shared";
import { sendEmail } from "@mhp/integrations/email";
import { db } from "../db.js";
import { AppError } from "../lib/errors.js";

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

// Queue email + internal notification for the same event (e.g. credential_issued)
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
  const rows = await db
    .select({
      notification: notifications,
      recipientEmail: users.email,
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.recipientId, users.id))
    .where(eq(notifications.status, "pending"))
    .limit(batchSize);

  for (const { notification, recipientEmail } of rows) {
    try {
      if (notification.channel === "email") {
        const { subject, html } = await renderNotification(notification);
        await sendEmail(recipientEmail, subject, html);
      }
      // internal channel: just flip to "sent" — frontend polls getForUser()

      await db
        .update(notifications)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(notifications.id, notification.id));
    } catch (err) {
      console.error(
        `Notification ${notification.id} processing failed:`,
        err
      );
      await db
        .update(notifications)
        .set({ status: "failed" })
        .where(eq(notifications.id, notification.id))
        .catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// getForUser — internal bell icon (channel = "internal")
// ---------------------------------------------------------------------------

export async function getForUser(userId: string): Promise<Notification[]> {
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
    .limit(50);
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
