import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { db } from "../db.js";
import { eq, sql, and } from "drizzle-orm";
import { accredibleCredentials, users, userProfiles } from "@mhp/shared";
import { logger } from "../lib/logger.js";

const router = Router();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? null;

function verifyHmac(rawBody: Buffer | string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

router.all("/:channel", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel } = req.params;
    const method = req.method;

    if (WEBHOOK_SECRET) {
      const sig = (req.headers["x-webhook-signature"] ?? req.headers["x-hook-secret"]) as string | undefined;

      if (!sig) {
        res.status(401).json({ error: "Missing webhook signature header" });
        return;
      }

      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
      const bodyForVerification = rawBody ?? (typeof req.body === "string" ? Buffer.from(req.body) : Buffer.from(JSON.stringify(req.body ?? {})));

      if (!verifyHmac(bodyForVerification, sig, WEBHOOK_SECRET)) {
        res.status(401).json({ error: "Invalid webhook signature" });
        return;
      }
    }

    const payload = method === "GET" ? req.query : req.body;

    logger.info({ channel, method, payloadKeys: Object.keys(payload ?? {}) }, "Webhook received");

    try {
      await db.execute(sql`
        INSERT INTO webhook_log (channel, method, headers, payload)
        VALUES (${channel}, ${method}, ${JSON.stringify(pickHeaders(req))}::jsonb, ${JSON.stringify(payload ?? {})}::jsonb)
      `);
    } catch (err) {
      logger.warn({ err }, "webhook_log table missing — skipping log persistence");
    }

    if (channel === "credentials" && method === "POST" && payload) {
      try {
        await processCredentialWebhook(payload);
      } catch (err) {
        logger.error({ err }, "Failed to process credential webhook");
      }
    }

    res.json({ ok: true, channel, method, received: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

interface CredentialPayload {
  id?: string;
  accredible_internal_id?: string;
  uuid?: string;
  name?: string;
  recipient_name?: string;
  recipient_email?: string;
  credential_url?: string;
  course_link?: string;
  issued_on?: string;
  start_date?: string;
  end_date?: string;
  issuer_name?: string;
  field_of_study?: string;
  badge_url?: string;
  badge_image?: string;
  certificate_url?: string;
  certificate_image?: string;
  credential_id?: string;
  group_id?: string;
  group_name?: string;
  description?: string;
  trainer_name?: string;
  training_duration?: string;
  training_location?: string;
  participation_modality?: string;
}

async function processCredentialWebhook(raw: unknown) {
  const payload = raw as CredentialPayload;

  const credentialName = payload.name || payload.field_of_study || "Credential";
  const recipientName = payload.recipient_name ?? null;
  const recipientEmail = payload.recipient_email ?? null;
  const credentialUrl = payload.credential_url ?? null;
  const badgeUrl = payload.badge_image ?? payload.badge_url ?? null;
  const certificateUrl = payload.certificate_image ?? payload.certificate_url ?? credentialUrl;
  const issuedOn = payload.issued_on ? new Date(payload.issued_on) : null;
  const accredibleId = payload.id ?? payload.accredible_internal_id ?? payload.credential_id ?? null;
  const groupName = payload.group_name ?? payload.issuer_name ?? null;
  const description = payload.description ?? payload.field_of_study ?? null;

  if (!recipientName && !recipientEmail) {
    logger.warn("Credential webhook missing both recipient_name and recipient_email — cannot match user");
    return;
  }

  let userId: string | null = null;

  if (recipientEmail) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, recipientEmail.toLowerCase()))
      .limit(1);
    if (user) userId = user.id;
  }

  if (!userId && recipientName) {
    const nameParts = recipientName.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");

      const matches = await db
        .select({ userId: userProfiles.userId })
        .from(userProfiles)
        .where(
          and(
            sql`lower(${userProfiles.firstName}) = lower(${firstName})`,
            sql`lower(${userProfiles.lastName}) = lower(${lastName})`
          )
        )
        .limit(2);

      if (matches.length === 1) {
        userId = matches[0].userId;
      } else if (matches.length > 1) {
        logger.warn({ recipientName, matchCount: matches.length }, "Multiple users match credential recipient name — skipping auto-link");
      }
    }
  }

  const emailForRecord = recipientEmail ?? `${(recipientName ?? "unknown").toLowerCase().replace(/\s+/g, ".")}@webhook.placeholder`;

  if (accredibleId) {
    const [existing] = await db
      .select({ id: accredibleCredentials.id })
      .from(accredibleCredentials)
      .where(eq(accredibleCredentials.accredibleCredentialId, accredibleId))
      .limit(1);

    if (existing) {
      await db
        .update(accredibleCredentials)
        .set({
          recipientEmail: recipientEmail ?? undefined,
          recipientName: recipientName ?? undefined,
          groupName: groupName ?? undefined,
          credentialName,
          description: description ?? undefined,
          issuedAt: issuedOn ?? undefined,
          badgeUrl: badgeUrl ?? undefined,
          certificateUrl: certificateUrl ?? undefined,
          url: credentialUrl ?? undefined,
          userId: userId ?? undefined,
        })
        .where(eq(accredibleCredentials.id, existing.id));

      logger.info({ accredibleId, id: existing.id }, "Credential updated from webhook");
      return;
    }
  }

  if (credentialUrl) {
    const [existingByUrl] = await db
      .select({ id: accredibleCredentials.id })
      .from(accredibleCredentials)
      .where(eq(accredibleCredentials.url, credentialUrl))
      .limit(1);

    if (existingByUrl) {
      await db
        .update(accredibleCredentials)
        .set({
          accredibleCredentialId: accredibleId ?? undefined,
          recipientEmail: recipientEmail ?? undefined,
          recipientName: recipientName ?? undefined,
          groupName: groupName ?? undefined,
          credentialName,
          description: description ?? undefined,
          issuedAt: issuedOn ?? undefined,
          badgeUrl: badgeUrl ?? undefined,
          certificateUrl: certificateUrl ?? undefined,
          userId: userId ?? undefined,
        })
        .where(eq(accredibleCredentials.id, existingByUrl.id));

      logger.info({ credentialUrl, id: existingByUrl.id }, "Credential updated by URL from webhook");
      return;
    }
  }

  const [inserted] = await db
    .insert(accredibleCredentials)
    .values({
      accredibleCredentialId: accredibleId,
      recipientEmail: emailForRecord,
      recipientName: recipientName,
      groupName: groupName,
      credentialName: credentialName,
      description: description,
      issuedAt: issuedOn,
      badgeUrl: badgeUrl,
      certificateUrl: certificateUrl,
      url: credentialUrl,
      userId: userId,
    })
    .returning({ id: accredibleCredentials.id });

  logger.info(
    { credentialId: inserted.id, credentialName, recipientName, userId: userId ?? "unlinked" },
    "Credential saved from webhook"
  );
}

function pickHeaders(req: Request): Record<string, string> {
  const picked: Record<string, string> = {};
  const keep = ["content-type", "user-agent", "x-webhook-signature", "x-hook-secret", "x-zapier-event"];
  for (const k of keep) {
    const v = req.headers[k];
    if (typeof v === "string") picked[k] = v;
  }
  return picked;
}

router.get("/", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    endpoints: {
      "POST /api/webhooks/:channel": "Receive webhook payload",
      "GET /api/webhooks/:channel": "Receive webhook payload (GET)",
      "PUT /api/webhooks/:channel": "Receive webhook payload (PUT)",
    },
    authentication: WEBHOOK_SECRET
      ? "HMAC-SHA256 via x-webhook-signature header"
      : "No secret configured (open)",
  });
});

export default router;
