import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { adminUsers } from "@mhp/shared";
import { db } from "../db.js";
import { requireAdminAuth, requireSuperAdmin } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();
const BCRYPT_ROUNDS = 12;

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives. Réessayez dans 15 minutes." },
});

router.post("/login", adminLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email et mot de passe requis." });
      return;
    }

    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email.toLowerCase().trim()))
      .limit(1);

    if (!admin || !admin.passwordHash) {
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    await db
      .update(adminUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(adminUsers.id, admin.id));

    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve()))
    );
    req.session.adminUserId = admin.id;
    req.session.role = "admin";
    req.session.isSuperAdmin = admin.isSuperAdmin;
    res.json({
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
        isSuperAdmin: admin.isSuperAdmin,
      },
    });
  } catch (err) {
    logger.error({ err }, "Admin login error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

if (process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_CREDS === "true") {
  router.get("/dev-creds", (req, res) => {
    const host = req.hostname;
    if (host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".replit.dev")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json({
      email: "admin@mhp-hypnose.com",
      password: process.env.ADMIN_PASSWORD || "",
    });
  });
}

router.get("/me", requireAdminAuth, async (req, res) => {
  try {
    const [admin] = await db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        displayName: adminUsers.displayName,
        isSuperAdmin: adminUsers.isSuperAdmin,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, req.session.adminUserId!))
      .limit(1);

    if (!admin) {
      res.status(401).json({ error: "Non authentifié." });
      return;
    }

    res.json({ admin, role: "admin" });
  } catch (err) {
    logger.error({ err }, "Admin /me error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error({ err }, "Admin logout error");
    }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

router.get("/users", requireAdminAuth, async (_req, res) => {
  try {
    const list = await db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        displayName: adminUsers.displayName,
        isSuperAdmin: adminUsers.isSuperAdmin,
        lastLoginAt: adminUsers.lastLoginAt,
        createdAt: adminUsers.createdAt,
      })
      .from(adminUsers)
      .orderBy(adminUsers.createdAt);

    res.json(list);
  } catch (err) {
    logger.error({ err }, "List admin users error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.post("/users", requireSuperAdmin, async (req, res) => {
  try {
    const { email, password, displayName, isSuperAdmin } = req.body as {
      email: string;
      password: string;
      displayName?: string;
      isSuperAdmin?: boolean;
    };

    if (!email || !password) {
      res.status(400).json({ error: "Email et mot de passe requis." });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [existing] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.email, normalizedEmail))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "Un administrateur avec cet email existe déjà." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [created] = await db
      .insert(adminUsers)
      .values({
        email: normalizedEmail,
        passwordHash,
        displayName: displayName?.trim() || null,
        isSuperAdmin: isSuperAdmin ?? false,
      })
      .returning({
        id: adminUsers.id,
        email: adminUsers.email,
        displayName: adminUsers.displayName,
        isSuperAdmin: adminUsers.isSuperAdmin,
        createdAt: adminUsers.createdAt,
      });

    logger.info({ adminEmail: normalizedEmail }, "Admin user created");
    res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "Create admin user error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.patch("/users/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, isSuperAdmin, password } = req.body as {
      displayName?: string;
      isSuperAdmin?: boolean;
      password?: string;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (displayName !== undefined) updates.displayName = displayName.trim() || null;
    if (isSuperAdmin !== undefined) updates.isSuperAdmin = isSuperAdmin;
    if (password) {
      if (password.length < 8) {
        res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
        return;
      }
      updates.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    }

    const [updated] = await db
      .update(adminUsers)
      .set(updates)
      .where(eq(adminUsers.id, id))
      .returning({
        id: adminUsers.id,
        email: adminUsers.email,
        displayName: adminUsers.displayName,
        isSuperAdmin: adminUsers.isSuperAdmin,
      });

    if (!updated) {
      res.status(404).json({ error: "Administrateur introuvable." });
      return;
    }

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Update admin user error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.delete("/users/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.session.adminUserId) {
      res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte." });
      return;
    }

    const [deleted] = await db
      .delete(adminUsers)
      .where(eq(adminUsers.id, id))
      .returning({ id: adminUsers.id });

    if (!deleted) {
      res.status(404).json({ error: "Administrateur introuvable." });
      return;
    }

    res.status(204).end();
  } catch (err) {
    logger.error({ err }, "Delete admin user error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

export default router;
