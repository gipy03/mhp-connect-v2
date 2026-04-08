import express, { type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { sql } from "drizzle-orm";
import { validateEnv } from "@mhp/integrations/env";
import { db, pool } from "./db.js";
import { AppError } from "./lib/errors.js";
import authRouter from "./routes/auth.js";
import programsRouter from "./routes/programs.js";
import enrollmentRouter from "./routes/enrollment.js";

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

app.use(express.json());

const PgStore = connectPg(session);

app.use(
  session({
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
app.use("/api/programs", programsRouter);
app.use("/api/enrollments", enrollmentRouter);

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Erreur interne du serveur." });
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
// Start
// ---------------------------------------------------------------------------

app.listen(port, () => {
  console.log(`mhp | connect API listening on port ${port}`);
});

export default app;
