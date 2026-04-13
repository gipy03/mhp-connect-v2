import { and, eq } from "drizzle-orm";
import { instructors, adminUsers } from "@mhp/shared";
import type { Request, Response, NextFunction } from "express";
import { db } from "../db.js";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.session.userId && !req.session.adminUserId) {
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
  res.status(403).json({ error: "Accès non autorisé." });
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

export async function requireInstructor(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.session.userId && !req.session.adminUserId) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

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

    const [instructor] = await db
      .select({ id: instructors.id })
      .from(instructors)
      .where(and(eq(instructors.email, email), eq(instructors.active, true)))
      .limit(1);

    if (!instructor) {
      res.status(403).json({ error: "Accès réservé aux formateurs." });
      return;
    }

    req.trainerId = instructor.id;
    next();
  } catch {
    res.status(500).json({ error: "Erreur interne." });
  }
}

export async function resolveInstructorId(userId: string): Promise<string | null> {
  const authModule = await import("../services/auth.js");
  const user = await authModule.getUserById(userId);

  if (!user?.email) return null;

  const [instructor] = await db
    .select({ id: instructors.id })
    .from(instructors)
    .where(and(eq(instructors.email, user.email.toLowerCase().trim()), eq(instructors.active, true)))
    .limit(1);

  return instructor?.id ?? null;
}
