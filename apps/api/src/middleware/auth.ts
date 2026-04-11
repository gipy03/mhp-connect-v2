import type { Request, Response, NextFunction } from "express";

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
