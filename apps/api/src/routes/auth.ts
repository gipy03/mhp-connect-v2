import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { and, eq } from "drizzle-orm";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  setPasswordSchema,
  userProfiles,
  adminUsers,
  trainers,
  users,
  type UserRole,
} from "@mhp/shared";
import { deriveBaseUrl } from "@mhp/integrations/email";
import * as authService from "../services/auth.js";
import { resolveUserFeatures } from "../middleware/featureAccess.js";
import { resolveTrainerId } from "../middleware/auth.js";
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
// Helper: compute available portals for a given email
// ---------------------------------------------------------------------------

async function computeAvailablePortals(email: string): Promise<string[]> {
  const portals: string[] = [];
  const normalizedEmail = email.toLowerCase().trim();

  const [memberRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (memberRow) {
    portals.push("member");
  }

  const [trainerRow] = await db
    .select({ id: trainers.id })
    .from(trainers)
    .where(and(eq(trainers.email, normalizedEmail), eq(trainers.active, true)))
    .limit(1);

  if (trainerRow) {
    portals.push("trainer");
  }

  const [adminRow] = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, normalizedEmail))
    .limit(1);

  if (adminRow) {
    portals.push("admin");
  }

  return portals;
}

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
    req.session.activePortal = "member";
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
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.role = user.role as UserRole;
    req.session.activePortal = "member";
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
// Helper: build full auth response payload
// ---------------------------------------------------------------------------

async function buildAuthPayload(req: Request) {
  const activePortal = req.session.activePortal ?? (req.session.adminUserId ? "admin" : "member");

  if (req.session.adminUserId && (!req.session.userId || activePortal === "admin")) {
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

    if (!admin) return null;

    const availablePortals = await computeAvailablePortals(admin.email);

    return {
      user: {
        id: admin.id,
        email: admin.email,
        role: "admin" as const,
        emailVerified: true,
        createdAt: null,
        updatedAt: null,
      },
      features: ["community", "directory", "supervision", "offers"],
      impersonating: false,
      firstName: admin.displayName?.split(" ")[0] ?? "Admin",
      adminUser: admin,
      availablePortals,
      activePortal,
    };
  }

  if (!req.session.userId) return null;

  const user = await authService.getUserById(req.session.userId);
  if (!user) {
    if (req.session.impersonatedBy) {
      return {
        user: {
          id: req.session.userId,
          email: "(utilisateur supprimé)",
          role: (req.session.role ?? "member") as string,
          emailVerified: false,
          createdAt: null,
          updatedAt: null,
        },
        features: [] as string[],
        impersonating: true,
        firstName: null,
        availablePortals: ["member"],
        activePortal,
      };
    }
    return null;
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

  const availablePortals = await computeAvailablePortals(user.email);

  let adminUser = null;
  if (req.session.adminUserId) {
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
    adminUser = admin ?? null;
  }

  const trainerId = await resolveTrainerId(req.session.userId);

  return {
    user,
    features: [...featureSet],
    impersonating: !!req.session.impersonatedBy,
    firstName: profile[0]?.firstName ?? null,
    adminUser,
    availablePortals,
    activePortal,
    isTrainer: !!trainerId,
  };
}

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

router.get("/me", async (req: Request, res: Response) => {
  if (!req.session.userId && !req.session.adminUserId) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  try {
    const payload = await buildAuthPayload(req);
    if (!payload) {
      await destroySession(req);
      res.status(401).json({ error: "Session invalide." });
      return;
    }
    res.json(payload);
  } catch (err) {
    handleError(err, res);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/switch-portal
// ---------------------------------------------------------------------------

router.post("/switch-portal", async (req: Request, res: Response) => {
  const userId = req.session.userId;
  const adminUserId = req.session.adminUserId;

  if (!userId && !adminUserId) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  const { portal } = req.body as { portal?: string };
  if (!portal || !["member", "trainer", "admin"].includes(portal)) {
    res.status(400).json({ error: "Portail invalide." });
    return;
  }

  try {
    let email: string | null = null;

    if (adminUserId) {
      const [admin] = await db
        .select({ email: adminUsers.email })
        .from(adminUsers)
        .where(eq(adminUsers.id, adminUserId))
        .limit(1);
      email = admin?.email ?? null;
    }

    if (!email && userId) {
      const user = await authService.getUserById(userId);
      email = user?.email ?? null;
    }

    if (!email) {
      res.status(401).json({ error: "Session invalide." });
      return;
    }

    const availablePortals = await computeAvailablePortals(email);

    if (!availablePortals.includes(portal)) {
      res.status(403).json({ error: "Vous n'avez pas accès à ce portail." });
      return;
    }

    req.session.activePortal = portal as "member" | "trainer" | "admin";

    const normalizedEmail = email.toLowerCase().trim();

    if (portal === "admin" && !adminUserId && userId) {
      const [adminRow] = await db
        .select({ id: adminUsers.id, isSuperAdmin: adminUsers.isSuperAdmin })
        .from(adminUsers)
        .where(eq(adminUsers.email, normalizedEmail))
        .limit(1);

      if (!adminRow) {
        res.status(409).json({ error: "Aucun compte admin associé à cet email." });
        return;
      }

      req.session.adminUserId = adminRow.id;
      req.session.isSuperAdmin = adminRow.isSuperAdmin ?? false;
    }

    if (portal === "member" && !userId && adminUserId) {
      const [linkedUser] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (!linkedUser) {
        res.status(409).json({ error: "Aucun compte membre associé à cet email." });
        return;
      }

      req.session.userId = linkedUser.id;
      req.session.role = linkedUser.role as UserRole;
    }

    if (portal === "trainer" && !userId && adminUserId) {
      const [linkedUser] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (linkedUser) {
        req.session.userId = linkedUser.id;
        req.session.role = linkedUser.role as UserRole;
      }
    }

    const payload = await buildAuthPayload(req);
    if (!payload) {
      res.status(500).json({ error: "Erreur lors du changement de portail." });
      return;
    }

    res.json(payload);
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
    logger.error({ err }, "forgot-password error");
  }

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
