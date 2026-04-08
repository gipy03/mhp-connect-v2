import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  setPasswordSchema,
  type UserRole,
} from "@mhp/shared";
import { deriveBaseUrl } from "@mhp/integrations/email";
import * as authService from "../services/auth.js";

const router = Router();

// ---------------------------------------------------------------------------
// Rate limiting — applied specifically to login
// ---------------------------------------------------------------------------

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,                 // max 10 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Trop de tentatives de connexion. Réessayez dans 15 minutes.",
  },
});

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function handleError(err: unknown, res: Response): void {
  if (err instanceof authService.AuthError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error("[auth]", err);
  res.status(500).json({ error: "Une erreur interne est survenue." });
}

// Promisify session callbacks — session methods are callback-based
function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve()))
  );
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve) => req.session.destroy(() => resolve()));
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

router.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides.", issues: parsed.error.issues });
    return;
  }

  try {
    const user = await authService.register(parsed.data);
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.role = user.role as UserRole;
    res.status(201).json({ user });
  } catch (err) {
    handleError(err, res);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides.", issues: parsed.error.issues });
    return;
  }

  try {
    const user = await authService.login(
      parsed.data.email,
      parsed.data.password
    );
    // Regenerate session ID after successful login to prevent session fixation
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.role = user.role as UserRole;
    res.json({ user });
  } catch (err) {
    handleError(err, res);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

router.post("/logout", async (req: Request, res: Response) => {
  await destroySession(req);
  res.clearCookie("connect.sid");
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

router.get("/me", async (req: Request, res: Response) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  try {
    const user = await authService.getUserById(req.session.userId);
    if (!user) {
      // Session references a deleted user — clean it up
      await destroySession(req);
      res.status(401).json({ error: "Session invalide." });
      return;
    }
    res.json({ user });
  } catch (err) {
    handleError(err, res);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------------------

router.post("/forgot-password", async (req: Request, res: Response) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Adresse email invalide." });
    return;
  }

  try {
    await authService.forgotPassword(
      parsed.data.email,
      deriveBaseUrl(req)
    );
  } catch (err) {
    // Log but never surface — don't reveal whether the email is registered
    console.error("[auth] forgot-password:", err);
  }

  // Always return 200 regardless of outcome
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------------------------

router.post("/reset-password", async (req: Request, res: Response) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides.", issues: parsed.error.issues });
    return;
  }

  try {
    await authService.resetPassword(parsed.data.token, parsed.data.password);
    res.json({ success: true });
  } catch (err) {
    handleError(err, res);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/set-password  (admin-created accounts, 24h token)
// ---------------------------------------------------------------------------

router.post("/set-password", async (req: Request, res: Response) => {
  const parsed = setPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides.", issues: parsed.error.issues });
    return;
  }

  try {
    await authService.setPassword(parsed.data.token, parsed.data.password);
    res.json({ success: true });
  } catch (err) {
    handleError(err, res);
  }
});

export default router;
