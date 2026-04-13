import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { db } from "../db.js";
import { sql } from "drizzle-orm";
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

    res.json({ ok: true, channel, method, received: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

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
