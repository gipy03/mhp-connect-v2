import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { instructors, instructorFiles } from "@mhp/shared";
import { db } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";
import { syncInstructors } from "../services/instructor-sync.js";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { v4 as uuidv4 } from "uuid";

const PHOTO_DIR = path.resolve(process.cwd(), ".data", "uploads", "instructors");
const DEPOSIT_DIR = path.resolve(process.cwd(), ".data", "uploads", "instructor-deposits");

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Seuls les fichiers JPEG, PNG et WebP sont autorisés."));
    }
  },
});

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
        website: instructors.website,
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
    const { bio, photoUrl, specialties, role, active, website } = req.body as {
      bio?: string;
      photoUrl?: string;
      specialties?: string[];
      role?: string;
      active?: boolean;
      website?: string;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (bio !== undefined) updates.bio = bio;
    if (photoUrl !== undefined) updates.photoUrl = photoUrl;
    if (specialties !== undefined) updates.specialties = specialties;
    if (role !== undefined) updates.role = role;
    if (active !== undefined) updates.active = active;
    if (website !== undefined) updates.website = website || null;

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

router.post("/:id/photo", photoUpload.single("photo"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      res.status(400).json({ error: "Aucun fichier fourni." });
      return;
    }

    await fs.mkdir(PHOTO_DIR, { recursive: true });
    const ext = path.extname(req.file.originalname) || ".jpg";
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(PHOTO_DIR, filename);
    await fs.writeFile(filePath, req.file.buffer);

    const photoUrl = `/api/uploads/instructors/${filename}`;
    const [updated] = await db
      .update(instructors)
      .set({ photoUrl, updatedAt: new Date() })
      .where(eq(instructors.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Formateur introuvable." });
      return;
    }

    res.json({ photoUrl });
  } catch (err) {
    logger.error({ err }, "Upload instructor photo error");
    res.status(500).json({ error: "Erreur lors de l'upload." });
  }
});

router.get("/:id/files", async (req, res) => {
  try {
    const { id } = req.params;
    const files = await db
      .select()
      .from(instructorFiles)
      .where(eq(instructorFiles.instructorId, id))
      .orderBy(desc(instructorFiles.createdAt));

    res.json(files);
  } catch (err) {
    logger.error({ err }, "List instructor files error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.get("/files/:fileId/download", async (req, res) => {
  try {
    const { fileId } = req.params;
    const [file] = await db
      .select()
      .from(instructorFiles)
      .where(eq(instructorFiles.id, fileId))
      .limit(1);

    if (!file) {
      res.status(404).json({ error: "Fichier introuvable." });
      return;
    }

    const filePath = path.join(DEPOSIT_DIR, path.basename(file.storageKey));
    const buffer = await fs.readFile(filePath);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.originalName}"`);
    res.send(buffer);
  } catch (err) {
    logger.error({ err }, "Download instructor file error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.delete("/files/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const [file] = await db
      .select()
      .from(instructorFiles)
      .where(eq(instructorFiles.id, fileId))
      .limit(1);

    if (!file) {
      res.status(404).json({ error: "Fichier introuvable." });
      return;
    }

    const filePath = path.join(DEPOSIT_DIR, path.basename(file.storageKey));
    await fs.unlink(filePath).catch(() => {});
    await db.delete(instructorFiles).where(eq(instructorFiles.id, fileId));

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Delete instructor file error");
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
