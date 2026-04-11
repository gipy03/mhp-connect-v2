import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  setPasswordSchema,
  userProfiles,
  adminUsers,
  type UserRole,
} from "@mhp/shared";
import { deriveBaseUrl } from "@mhp/integrations/email";
import * as authService from "../services/auth.js";
import { resolveUserFeatures } from "../middleware/featureAccess.js";
import { db } from "../db.js";
import { logger } from "../lib/logger.js";

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
  logger.error({ err }, "Auth error");
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
// Rate limiting — applied to register
// ---------------------------------------------------------------------------

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,                  // max 5 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Trop de tentatives d'inscription. Réessayez dans 1 heure.",
  },
});

// ---------------------------------------------------------------------------
// Rate limiting — applied to forgot-password
// ---------------------------------------------------------------------------

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,                  // max 5 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Trop de demandes de réinitialisation. Réessayez dans 15 minutes.",
  },
});

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

router.post("/register", registerLimiter, async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides.", issues: parsed.error.issues });
    return;
  }

  try {
    const result = await authService.register(parsed.data, deriveBaseUrl(req));
    await regenerateSession(req);
    req.session.userId = result.user.id;
    req.session.role = result.user.role as UserRole;
    res.status(201).json({ user: result.user });
  } catch (err) {
    if (
      err instanceof authService.AuthError &&
      err.statusCode === 202
    ) {
      res.status(202).json({ activationSent: true });
      return;
    }
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
  if (req.session.adminUserId) {
    try {
      const [admin] = await db
        .select({
          id: adminUsers.id,
          email: adminUsers.email,
          displayName: adminUsers.displayName,
          isSuperAdmin: adminUsers.isSuperAdmin,
        })
        .from(adminUsers)
        .where(eq(adminUsers.id, req.session.adminUserId))
        .limit(1);

      if (!admin) {
        await destroySession(req);
        res.status(401).json({ error: "Session invalide." });
        return;
      }

      res.json({
        user: {
          id: admin.id,
          email: admin.email,
          role: "admin",
          emailVerified: true,
          createdAt: null,
          updatedAt: null,
        },
        features: ["community", "directory", "supervision", "offers"],
        impersonating: false,
        firstName: admin.displayName?.split(" ")[0] ?? "Admin",
        adminUser: admin,
      });
      return;
    } catch (err) {
      handleError(err, res);
      return;
    }
  }

  if (!req.session.userId) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  try {
    const user = await authService.getUserById(req.session.userId);
    if (!user) {
      await destroySession(req);
      res.status(401).json({ error: "Session invalide." });
      return;
    }

    const featureSet =
      req.session.role === "admin"
        ? new Set(["community", "directory", "supervision", "offers"])
        : await resolveUserFeatures(req.session.userId);

    const profile = await db
      .select({ firstName: userProfiles.firstName })
      .from(userProfiles)
      .where(eq(userProfiles.userId, req.session.userId))
      .limit(1);

    res.json({
      user,
      features: [...featureSet],
      impersonating: !!req.session.impersonatedBy,
      firstName: profile[0]?.firstName ?? null,
    });
  } catch (err) {
    handleError(err, res);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/change-password
// ---------------------------------------------------------------------------

router.post("/change-password", async (req: Request, res: Response) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  const { currentPassword, newPassword } = req.body as {
    currentPassword: unknown;
    newPassword: unknown;
  };

  if (typeof currentPassword !== "string" || !currentPassword) {
    res.status(400).json({ error: "Mot de passe actuel requis." });
    return;
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "Le nouveau mot de passe doit comporter au moins 8 caractères." });
    return;
  }

  try {
    await authService.changePassword(req.session.userId, currentPassword, newPassword);
    res.json({ success: true });
  } catch (err) {
    handleError(err, res);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------------------

router.post("/forgot-password", forgotPasswordLimiter, async (req: Request, res: Response) => {
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
    logger.error({ err }, "forgot-password error");
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
