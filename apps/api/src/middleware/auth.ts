import { and, eq } from "drizzle-orm";
import { trainers, adminUsers } from "@mhp/shared";
import type { Request, Response, NextFunction } from "express";
import { db } from "../db.js";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }
  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.session.adminUserId) {
    next();
    return;
  }
  if (!req.session.userId) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "Accès non autorisé." });
    return;
  }
  next();
}

export function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.session.adminUserId) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }
  next();
}

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.session.adminUserId) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }
  if (!req.session.isSuperAdmin) {
    res.status(403).json({ error: "Accès réservé au super-administrateur." });
    return;
  }
  next();
}

export function requireTrainer(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.session.userId && !req.session.adminUserId) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  (async () => {
    try {
      let email: string | null = null;

      if (req.session.userId) {
        const authModule = await import("../services/auth.js");
        const user = await authModule.getUserById(req.session.userId);
        email = user?.email?.toLowerCase() ?? null;
      } else if (req.session.adminUserId) {
        const [admin] = await db
          .select({ email: adminUsers.email })
          .from(adminUsers)
          .where(eq(adminUsers.id, req.session.adminUserId))
          .limit(1);
        email = admin?.email?.toLowerCase() ?? null;
      }

      if (!email) {
        res.status(401).json({ error: "Session invalide." });
        return;
      }

      const [trainer] = await db
        .select({ id: trainers.id })
        .from(trainers)
        .where(and(eq(trainers.email, email), eq(trainers.active, true)))
        .limit(1);

      if (!trainer) {
        res.status(403).json({ error: "Accès réservé aux formateurs." });
        return;
      }

      next();
    } catch {
      res.status(500).json({ error: "Erreur interne." });
    }
  })();
}
