import { Router, type Request } from "express";
import { and, eq } from "drizzle-orm";
import { trainers, adminUsers } from "@mhp/shared";
import { requireTrainer } from "../middleware/auth.js";
import * as authService from "../services/auth.js";
import { db } from "../db.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.use(requireTrainer);

async function resolveEmail(req: Request): Promise<string | null> {
  if (req.session.userId) {
    const user = await authService.getUserById(req.session.userId);
    return user?.email?.toLowerCase() ?? null;
  }
  if (req.session.adminUserId) {
    const [admin] = await db
      .select({ email: adminUsers.email })
      .from(adminUsers)
      .where(eq(adminUsers.id, req.session.adminUserId))
      .limit(1);
    return admin?.email?.toLowerCase() ?? null;
  }
  return null;
}

router.get("/me", async (req, res) => {
  try {
    const email = await resolveEmail(req);
    if (!email) {
      res.status(401).json({ error: "Session invalide." });
      return;
    }

    const [trainer] = await db
      .select()
      .from(trainers)
      .where(and(eq(trainers.email, email), eq(trainers.active, true)))
      .limit(1);

    if (!trainer) {
      res.status(404).json({ error: "Profil formateur introuvable." });
      return;
    }

    res.json(trainer);
  } catch (err) {
    logger.error({ err }, "Trainer /me error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

export default router;
