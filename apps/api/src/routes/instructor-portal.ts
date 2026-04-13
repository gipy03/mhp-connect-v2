import { Router } from "express";
import { eq, and, inArray, desc } from "drizzle-orm";
import {
  instructors,
  instructorFiles,
  digiformaSessions,
  programOverrides,
  sessionAssignments,
  programEnrollments,
  users,
  userProfiles,
} from "@mhp/shared";
import { db } from "../db.js";
import { requireInstructor } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";
import { pushInstructorProfileChanges } from "../services/sync.js";
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
      cb(new Error("Seuls JPEG, PNG et WebP sont autorisés."));
    }
  },
});

const DEPOSIT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/zip",
  "application/x-zip-compressed",
]);

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (DEPOSIT_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non autorisé."));
    }
  },
});

const router = Router();

router.use(requireInstructor);

router.get("/profile", async (req, res) => {
  try {
    const [instructor] = await db
      .select()
      .from(instructors)
      .where(eq(instructors.id, req.trainerId!))
      .limit(1);

    if (!instructor) {
      res.status(404).json({ error: "Profil formateur introuvable." });
      return;
    }

    res.json(instructor);
  } catch (err) {
    logger.error({ err }, "Instructor portal: get profile error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.patch("/profile", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;

    const bio = typeof body.bio === "string" ? body.bio.slice(0, 5000) : undefined;
    const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.slice(0, 2000) : undefined;
    const phone = typeof body.phone === "string" ? body.phone.slice(0, 50) : undefined;
    const website = typeof body.website === "string" ? body.website.slice(0, 2000) : undefined;
    const specialties = Array.isArray(body.specialties)
      ? (body.specialties as unknown[]).filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 100)).slice(0, 20)
      : undefined;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (bio !== undefined) updates.bio = bio;
    if (photoUrl !== undefined) updates.photoUrl = photoUrl;
    if (specialties !== undefined) updates.specialties = specialties;
    if (phone !== undefined) updates.phone = phone;
    if (website !== undefined) updates.website = website || null;

    const [updated] = await db
      .update(instructors)
      .set(updates)
      .where(eq(instructors.id, req.trainerId!))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Profil formateur introuvable." });
      return;
    }

    res.json(updated);

    const pushableKeys = ["phone"];
    const changedFields: Record<string, unknown> = {};
    for (const key of pushableKeys) {
      if (updates[key] !== undefined) {
        changedFields[key] = updates[key];
      }
    }
    if (Object.keys(changedFields).length > 0) {
      pushInstructorProfileChanges(req.trainerId!, changedFields).catch(() => {});
    }
  } catch (err) {
    logger.error({ err }, "Instructor portal: update profile error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.post("/photo", photoUpload.single("photo"), async (req, res) => {
  try {
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
      .where(eq(instructors.id, req.trainerId!))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Profil introuvable." });
      return;
    }

    res.json({ photoUrl });
  } catch (err) {
    logger.error({ err }, "Instructor portal: upload photo error");
    res.status(500).json({ error: "Erreur lors de l'upload." });
  }
});

router.get("/files", async (req, res) => {
  try {
    const files = await db
      .select()
      .from(instructorFiles)
      .where(eq(instructorFiles.instructorId, req.trainerId!))
      .orderBy(desc(instructorFiles.createdAt));

    res.json(files);
  } catch (err) {
    logger.error({ err }, "Instructor portal: list files error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.post("/files", fileUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Aucun fichier fourni." });
      return;
    }

    await fs.mkdir(DEPOSIT_DIR, { recursive: true });
    const ext = path.extname(req.file.originalname);
    const storageFilename = `${uuidv4()}${ext}`;
    const filePath = path.join(DEPOSIT_DIR, storageFilename);
    await fs.writeFile(filePath, req.file.buffer);

    const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 1000) : null;

    const [file] = await db
      .insert(instructorFiles)
      .values({
        instructorId: req.trainerId!,
        fileName: storageFilename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        storageKey: storageFilename,
        note,
      })
      .returning();

    res.json(file);
  } catch (err) {
    logger.error({ err }, "Instructor portal: upload file error");
    res.status(500).json({ error: "Erreur lors de l'upload." });
  }
});

router.delete("/files/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const [file] = await db
      .select()
      .from(instructorFiles)
      .where(
        and(
          eq(instructorFiles.id, fileId),
          eq(instructorFiles.instructorId, req.trainerId!)
        )
      )
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
    logger.error({ err }, "Instructor portal: delete file error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.get("/files/:fileId/download", async (req, res) => {
  try {
    const { fileId } = req.params;
    const [file] = await db
      .select()
      .from(instructorFiles)
      .where(
        and(
          eq(instructorFiles.id, fileId),
          eq(instructorFiles.instructorId, req.trainerId!)
        )
      )
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
    logger.error({ err }, "Instructor portal: download file error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.get("/sessions", async (req, res) => {
  try {
    const instructorProgramCodes = await getInstructorProgramCodes(req.trainerId!);

    const overrides = await db
      .select({
        programCode: programOverrides.programCode,
        displayName: programOverrides.displayName,
      })
      .from(programOverrides);

    const allSessions = await db
      .select()
      .from(digiformaSessions)
      .orderBy(digiformaSessions.startDate);

    const assignmentCounts = await db
      .select({
        sessionId: sessionAssignments.sessionId,
      })
      .from(sessionAssignments)
      .where(eq(sessionAssignments.status, "assigned"));

    const countMap = new Map<string, number>();
    for (const a of assignmentCounts) {
      countMap.set(a.sessionId, (countMap.get(a.sessionId) || 0) + 1);
    }

    const results = allSessions
      .filter((s) => {
        if (s.programCode && instructorProgramCodes.has(s.programCode)) return true;
        return false;
      })
      .map((s) => {
        const override = overrides.find((o) => o.programCode === s.programCode);
        return {
          id: s.id,
          digiformaId: s.digiformaId,
          name: s.name,
          code: s.code,
          programCode: s.programCode,
          programName: override?.displayName || s.programName || s.name,
          startDate: s.startDate,
          endDate: s.endDate,
          place: s.place,
          placeName: s.placeName,
          remote: s.remote,
          inter: s.inter,
          dates: s.dates,
          participantCount: countMap.get(s.digiformaId) || 0,
        };
      });

    res.json(results);
  } catch (err) {
    logger.error({ err }, "Instructor portal: get sessions error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

async function getInstructorProgramCodes(instructorId: string): Promise<Set<string>> {
  const [instructor] = await db
    .select({
      id: instructors.id,
      digiformaId: instructors.digiformaId,
    })
    .from(instructors)
    .where(eq(instructors.id, instructorId))
    .limit(1);

  if (!instructor) return new Set();

  const overrides = await db
    .select({
      programCode: programOverrides.programCode,
      instructorsJson: programOverrides.instructors,
    })
    .from(programOverrides);

  const codes = new Set<string>();
  for (const ov of overrides) {
    if (!ov.instructorsJson) continue;
    const instructorList = ov.instructorsJson as Array<{ id?: string; name?: string }>;
    if (Array.isArray(instructorList)) {
      for (const t of instructorList) {
        if (t.id === instructor.id || t.id === instructor.digiformaId) {
          codes.add(ov.programCode);
        }
      }
    }
  }
  return codes;
}

router.get("/sessions/:sessionId/participants", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const [session] = await db
      .select({
        id: digiformaSessions.id,
        digiformaId: digiformaSessions.digiformaId,
        programCode: digiformaSessions.programCode,
      })
      .from(digiformaSessions)
      .where(eq(digiformaSessions.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "Session introuvable." });
      return;
    }

    const authorizedCodes = await getInstructorProgramCodes(req.trainerId!);
    if (!session.programCode || !authorizedCodes.has(session.programCode)) {
      res.status(403).json({ error: "Vous n'êtes pas assigné(e) à cette session." });
      return;
    }

    const assignments = await db
      .select({
        assignmentId: sessionAssignments.id,
        status: sessionAssignments.status,
        participationMode: sessionAssignments.participationMode,
        enrollmentId: sessionAssignments.enrollmentId,
      })
      .from(sessionAssignments)
      .where(eq(sessionAssignments.sessionId, session.digiformaId));

    if (assignments.length === 0) {
      res.json([]);
      return;
    }

    const enrollmentIds = assignments.map((a) => a.enrollmentId);

    const enrollments = await db
      .select({
        id: programEnrollments.id,
        userId: programEnrollments.userId,
        status: programEnrollments.status,
      })
      .from(programEnrollments)
      .where(inArray(programEnrollments.id, enrollmentIds));

    const userIds = enrollments.map((e) => e.userId);

    const userList = await db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .where(inArray(users.id, userIds));

    const profiles = await db
      .select({
        userId: userProfiles.userId,
        firstName: userProfiles.firstName,
        lastName: userProfiles.lastName,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, userIds));

    const userMap = new Map(userList.map((u) => [u.id, u]));
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));
    const enrollmentMap = new Map(enrollments.map((e) => [e.id, e]));

    const participants = assignments.map((a) => {
      const enrollment = enrollmentMap.get(a.enrollmentId);
      const user = enrollment ? userMap.get(enrollment.userId) : null;
      const profile = enrollment ? profileMap.get(enrollment.userId) : null;

      return {
        assignmentId: a.assignmentId,
        firstName: profile?.firstName ?? null,
        lastName: profile?.lastName ?? null,
        email: user?.email ?? null,
        enrollmentStatus: enrollment?.status ?? null,
        assignmentStatus: a.status,
        participationMode: a.participationMode,
      };
    });

    res.json(participants);
  } catch (err) {
    logger.error({ err }, "Instructor portal: get participants error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

export default router;
