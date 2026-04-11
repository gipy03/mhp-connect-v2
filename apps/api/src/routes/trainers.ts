import { Router } from "express";
import { eq } from "drizzle-orm";
import { trainers } from "@mhp/shared";
import { db } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";
import { syncTrainers } from "../services/trainer-sync.js";

const router = Router();

router.get("/public", async (_req, res) => {
  try {
    const list = await db
      .select({
        id: trainers.id,
        firstName: trainers.firstName,
        lastName: trainers.lastName,
        bio: trainers.bio,
        photoUrl: trainers.photoUrl,
        specialties: trainers.specialties,
        role: trainers.role,
      })
      .from(trainers)
      .where(eq(trainers.active, true))
      .orderBy(trainers.lastName);

    res.json(list);
  } catch (err) {
    logger.error({ err }, "List public trainers error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const list = await db
      .select()
      .from(trainers)
      .orderBy(trainers.lastName);

    res.json(list);
  } catch (err) {
    logger.error({ err }, "List trainers error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { bio, photoUrl, specialties, role, active } = req.body as {
      bio?: string;
      photoUrl?: string;
      specialties?: string[];
      role?: string;
      active?: boolean;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (bio !== undefined) updates.bio = bio;
    if (photoUrl !== undefined) updates.photoUrl = photoUrl;
    if (specialties !== undefined) updates.specialties = specialties;
    if (role !== undefined) updates.role = role;
    if (active !== undefined) updates.active = active;

    const [updated] = await db
      .update(trainers)
      .set(updates)
      .where(eq(trainers.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Formateur introuvable." });
      return;
    }

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Update trainer error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.post("/sync", async (_req, res) => {
  try {
    const result = await syncTrainers();
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Trainer sync error");
    res.status(500).json({ error: "Erreur lors de la synchronisation." });
  }
});

export default router;
