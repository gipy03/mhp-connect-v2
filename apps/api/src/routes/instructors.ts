import { Router } from "express";
import { eq } from "drizzle-orm";
import { instructors } from "@mhp/shared";
import { db } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";
import { syncInstructors } from "../services/instructor-sync.js";

const router = Router();

router.get("/public", async (_req, res) => {
  try {
    const list = await db
      .select({
        id: instructors.id,
        firstName: instructors.firstName,
        lastName: instructors.lastName,
        bio: instructors.bio,
        photoUrl: instructors.photoUrl,
        specialties: instructors.specialties,
        role: instructors.role,
      })
      .from(instructors)
      .where(eq(instructors.active, true))
      .orderBy(instructors.lastName);

    res.json(list);
  } catch (err) {
    logger.error({ err }, "List public instructors error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const list = await db
      .select()
      .from(instructors)
      .orderBy(instructors.lastName);

    res.json(list);
  } catch (err) {
    logger.error({ err }, "List instructors error");
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
      .update(instructors)
      .set(updates)
      .where(eq(instructors.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Formateur introuvable." });
      return;
    }

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Update instructor error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.post("/sync", async (_req, res) => {
  try {
    const result = await syncInstructors();
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Instructor sync error");
    res.status(500).json({ error: "Erreur lors de la synchronisation." });
  }
});

export default router;
