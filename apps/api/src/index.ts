import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import helmet from "helmet";
import cors from "cors";
import { eq, sql } from "drizzle-orm";
import { workerConfig } from "@mhp/shared";
import { validateEnv } from "@mhp/integrations/env";
import { db, pool } from "./db.js";
import { AppError } from "./lib/errors.js";
import authRouter from "./routes/auth.js";
import profileRouter from "./routes/profile.js";
import programsRouter from "./routes/programs.js";
import enrollmentRouter from "./routes/enrollment.js";
import directoryRouter from "./routes/directory.js";
import notificationsRouter from "./routes/notifications.js";
import adminRouter from "./routes/admin.js";
import ssrDirectoryRouter from "./ssr/directory.js";
import ssrCatalogueRouter from "./ssr/catalogue.js";
import { generatePractitionerSlug, getBaseUrl } from "./ssr/html-shell.js";
import forumRouter from "./routes/forum.js";
import offersRouter from "./routes/offers.js";
import messagingRouter from "./routes/messaging.js";
import contactsRouter from "./routes/contacts.js";
import eventsRouter from "./routes/events.js";
import filesRouter from "./routes/files.js";
import invoicesRouter from "./routes/invoices.js";
import adminAuthRouter from "./routes/admin-auth.js";
import instructorsRouter from "./routes/instructors.js";
import instructorPortalRouter from "./routes/instructor-portal.js";
import wishlistRouter from "./routes/wishlist.js";
import webhooksRouter from "./routes/webhooks.js";
import { processPending, processSessionReminders, processEventReminders } from "./services/notification.js";
import { runIncrementalSync } from "./services/sync.js";
import { syncInstructors } from "./services/instructor-sync.js";
import { logger, httpLogger } from "./lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Environment — validated at startup, process.exit(1) if invalid
// ---------------------------------------------------------------------------

const env = validateEnv();
const port = parseInt(env.PORT, 10);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();

// Trust the first proxy hop (Replit, Railway, etc.) so that
// req.ip and secure cookies work correctly behind a reverse proxy.
app.set("trust proxy", 1);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(httpLogger);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const allowedOrigins = env.NODE_ENV === "production"
  ? [`https://${process.env.REPLIT_DEV_DOMAIN || "mhp-connect.replit.app"}`]
  : undefined;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(
  express.json({
    verify: (_req, _res, buf) => {
      (_req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);

const PgStore = connectPg(session as any);

app.use(
  (session as any)({
    store: new PgStore({
      pool,
      tableName: "session",       // matches pgSessions table in schema
      createTableIfMissing: false, // managed by drizzle migrations
    }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    proxy: env.NODE_ENV === "production",
  })
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/programs", programsRouter);
app.use("/api/enrollments", enrollmentRouter);
app.use("/api/directory", directoryRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/forum", forumRouter);
app.use("/api/offers", offersRouter);
app.use("/api/messages", messagingRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/events", eventsRouter);
app.use("/api/files", filesRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/admin-auth", adminAuthRouter);
app.use("/api/instructors", instructorsRouter);
app.use("/api/instructor", instructorPortalRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/webhooks", webhooksRouter);

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Erreur interne du serveur." });
});

// ---------------------------------------------------------------------------
// SSR routes — served BEFORE the SPA catch-all so crawlers get full HTML
// ---------------------------------------------------------------------------

app.use(ssrDirectoryRouter);
app.use(ssrCatalogueRouter);

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

app.get("/robots.txt", (_req, res) => {
  const baseUrl = getBaseUrl();
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /user/",
    "Disallow: /admin/",
    "Disallow: /api/",
    "",
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ].join("\n");
  res.set("Content-Type", "text/plain");
  res.send(body);
});

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

app.get("/sitemap.xml", async (_req, res) => {
  try {
    const { programOverrides: po, userProfiles: up } = await import("@mhp/shared");
    const programs = await db
      .select({
        programCode: po.programCode,
        published: po.published,
        updatedAt: po.updatedAt,
      })
      .from(po)
      .where(eq(po.published, true));

    const practitioners = await db
      .select({
        slugId: up.slugId,
        firstName: up.firstName,
        lastName: up.lastName,
        city: up.city,
        updatedAt: up.updatedAt,
      })
      .from(up)
      .where(eq(up.directoryVisibility, "public"));

    const baseUrl = getBaseUrl();
    const now = new Date().toISOString().split("T")[0];

    type SitemapEntry = { loc: string; lastmod: string; changefreq: string };
    const urls: SitemapEntry[] = [
      { loc: `${baseUrl}/catalogue`, lastmod: now, changefreq: "weekly" },
      { loc: `${baseUrl}/annuaire`, lastmod: now, changefreq: "weekly" },
      { loc: `${baseUrl}/agenda`, lastmod: now, changefreq: "daily" },
    ];

    for (const p of programs) {
      const lastmod = p.updatedAt
        ? new Date(p.updatedAt).toISOString().split("T")[0]
        : now;
      urls.push({
        loc: `${baseUrl}/catalogue/${p.programCode}`,
        lastmod,
        changefreq: "weekly",
      });
    }

    for (const pr of practitioners) {
      const slug = generatePractitionerSlug(
        pr.firstName,
        pr.lastName,
        pr.city,
        pr.slugId
      );
      const lastmod = pr.updatedAt
        ? new Date(pr.updatedAt).toISOString().split("T")[0]
        : now;
      urls.push({
        loc: `${baseUrl}/annuaire/${slug}`,
        lastmod,
        changefreq: "monthly",
      });
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map(
        (u) =>
          `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n  </url>`
      ),
      "</urlset>",
    ].join("\n");

    res.set("Content-Type", "application/xml");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    logger.error({ err }, "Sitemap generation error");
    res.status(500).send("Sitemap generation error");
  }
});

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/readyz", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "error", message: "Database unavailable" });
  }
});

// ---------------------------------------------------------------------------
// Static file serving — production only
// In production the built Vite frontend is served from the API process.
// ---------------------------------------------------------------------------

if (env.NODE_ENV === "production") {
  const clientDist = path.resolve(__dirname, "../../web/dist");
  app.use(express.static(clientDist, { index: false, maxAge: "1y", immutable: true }));
  app.get("/{*splat}", (req, res, next) => {
    const skip = ["/api", "/healthz", "/readyz", "/sitemap.xml", "/robots.txt"];
    if (skip.some((p) => req.path.startsWith(p) || req.path === p)) {
      res.status(404).json({ error: "Route introuvable." });
      return;
    }
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// ---------------------------------------------------------------------------
// Background workers — intervals loaded from worker_config table
// ---------------------------------------------------------------------------

const WORKER_DEFAULTS: Record<string, { intervalMs: number; fn: () => Promise<void>; label: string }> = {
  notification_processor: { intervalMs: 30_000, fn: async () => { await processPending(); }, label: "Notification processor" },
  digiforma_sync: { intervalMs: 60 * 60 * 1000, fn: async () => { await runIncrementalSync(); }, label: "DigiForma sync" },
  session_reminders: { intervalMs: 60 * 60 * 1000, fn: async () => { await processSessionReminders(); }, label: "Session reminders" },
  event_reminders: { intervalMs: 15 * 60 * 1000, fn: async () => { await processEventReminders(); }, label: "Event reminders" },
  instructor_sync: { intervalMs: 6 * 60 * 60 * 1000, fn: async () => { await syncInstructors(); }, label: "Instructor sync" },
};

const workerTimers = new Map<string, ReturnType<typeof setInterval>>();

async function ensureWorkerDefaults() {
  try {
    for (const [key, def] of Object.entries(WORKER_DEFAULTS)) {
      const [existing] = await db.select({ id: workerConfig.id }).from(workerConfig).where(eq(workerConfig.key, key)).limit(1);
      if (!existing) {
        await db.insert(workerConfig).values({
          key,
          intervalMs: def.intervalMs,
          enabled: true,
          label: def.label,
        });
        logger.info({ key }, `Created default worker config for ${key}`);
      }
    }
  } catch (err) {
    logger.warn({ err }, "Failed to ensure worker defaults (non-fatal)");
  }
}

async function getWorkerInterval(key: string): Promise<{ intervalMs: number; enabled: boolean }> {
  try {
    const [row] = await db.select().from(workerConfig).where(eq(workerConfig.key, key)).limit(1);
    if (row) return { intervalMs: row.intervalMs, enabled: row.enabled };
  } catch (err) {
    logger.warn({ err, key }, "Failed to load worker config from DB, using defaults");
  }
  const def = WORKER_DEFAULTS[key];
  return { intervalMs: def?.intervalMs ?? 60_000, enabled: true };
}

async function recordLastRun(key: string) {
  try {
    await db.update(workerConfig).set({ lastRunAt: new Date() }).where(eq(workerConfig.key, key));
  } catch {}
}

async function scheduleWorker(key: string, def: { fn: () => Promise<void>; label: string; intervalMs: number }) {
  const { intervalMs, enabled } = await getWorkerInterval(key);
  if (!enabled) {
    const timer = setTimeout(() => scheduleWorker(key, def).catch(() => {}), 30_000);
    workerTimers.set(key, timer);
    return;
  }
  const timer = setTimeout(async () => {
    try {
      const conf = await getWorkerInterval(key);
      if (conf.enabled) {
        await def.fn();
        await recordLastRun(key);
      }
    } catch (err) {
      logger.error({ err }, `${def.label} error`);
    }
    scheduleWorker(key, def).catch(() => {});
  }, intervalMs);
  workerTimers.set(key, timer);
}

async function startWorkers() {
  for (const [key, def] of Object.entries(WORKER_DEFAULTS)) {
    const { intervalMs, enabled } = await getWorkerInterval(key);
    logger.info({ key, intervalMs, enabled }, `Starting worker ${key}`);
    await scheduleWorker(key, def);
  }
}

syncInstructors().catch((err) =>
  logger.error({ err }, "Instructor sync (startup) error")
);

ensureWorkerDefaults()
  .then(() => startWorkers())
  .catch((err) => logger.error({ err }, "Failed to start workers"));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(port, () => {
  logger.info({ port }, "mhp | connect API listening");
});

export default app;
