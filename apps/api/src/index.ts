import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { eq, sql } from "drizzle-orm";
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
import { processPending, processSessionReminders } from "./services/notification.js";
import { runIncrementalSync } from "./services/sync.js";
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

// Preserve raw body for webhook signature verification (Accredible HMAC-SHA256).
// The Buffer is attached to req.rawBody and available to all downstream handlers.
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
// Background workers
// ---------------------------------------------------------------------------

// Notification processor — runs every 30 seconds
setInterval(() => {
  processPending().catch((err) =>
    logger.error({ err }, "Notification processor error")
  );
}, 30_000);

// DigiForma incremental sync — runs every hour
setInterval(() => {
  runIncrementalSync().catch((err) =>
    logger.error({ err }, "DigiForma sync error")
  );
}, 60 * 60 * 1000);

// Session reminders — runs daily at midnight (check every hour, deduplicate in queue)
setInterval(() => {
  processSessionReminders().catch((err) =>
    logger.error({ err }, "Session reminder error")
  );
}, 60 * 60 * 1000);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(port, () => {
  logger.info({ port }, "mhp | connect API listening");
});

export default app;
