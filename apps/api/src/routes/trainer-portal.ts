import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  trainers,
  digiformaSessions,
  programOverrides,
  sessionAssignments,
  programEnrollments,
  users,
  userProfiles,
} from "@mhp/shared";
import { db } from "../db.js";
import { requireTrainer } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";
import { pushTrainerProfileChanges } from "../services/sync.js";

const router = Router();

router.use(requireTrainer);

router.get("/profile", async (req, res) => {
  try {
    const [trainer] = await db
      .select()
      .from(trainers)
      .where(eq(trainers.id, req.trainerId!))
      .limit(1);

    if (!trainer) {
      res.status(404).json({ error: "Profil formateur introuvable." });
      return;
    }

    res.json(trainer);
  } catch (err) {
    logger.error({ err }, "Trainer portal: get profile error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.patch("/profile", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;

    const bio = typeof body.bio === "string" ? body.bio.slice(0, 5000) : undefined;
    const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.slice(0, 2000) : undefined;
    const phone = typeof body.phone === "string" ? body.phone.slice(0, 50) : undefined;
    const specialties = Array.isArray(body.specialties)
      ? (body.specialties as unknown[]).filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 100)).slice(0, 20)
      : undefined;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (bio !== undefined) updates.bio = bio;
    if (photoUrl !== undefined) updates.photoUrl = photoUrl;
    if (specialties !== undefined) updates.specialties = specialties;
    if (phone !== undefined) updates.phone = phone;

    const [updated] = await db
      .update(trainers)
      .set(updates)
      .where(eq(trainers.id, req.trainerId!))
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
      pushTrainerProfileChanges(req.trainerId!, changedFields).catch(() => {});
    }
  } catch (err) {
    logger.error({ err }, "Trainer portal: update profile error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

router.get("/sessions", async (req, res) => {
  try {
    const trainerProgramCodes = await getTrainerProgramCodes(req.trainerId!);

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
        if (s.programCode && trainerProgramCodes.has(s.programCode)) return true;
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
    logger.error({ err }, "Trainer portal: get sessions error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

async function getTrainerProgramCodes(trainerId: string): Promise<Set<string>> {
  const [trainer] = await db
    .select({
      id: trainers.id,
      digiformaId: trainers.digiformaId,
    })
    .from(trainers)
    .where(eq(trainers.id, trainerId))
    .limit(1);

  if (!trainer) return new Set();

  const overrides = await db
    .select({
      programCode: programOverrides.programCode,
      trainersJson: programOverrides.trainers,
    })
    .from(programOverrides);

  const codes = new Set<string>();
  for (const ov of overrides) {
    if (!ov.trainersJson) continue;
    const trainerList = ov.trainersJson as Array<{ id?: string; name?: string }>;
    if (Array.isArray(trainerList)) {
      for (const t of trainerList) {
        if (t.id === trainer.id || t.id === trainer.digiformaId) {
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

    const authorizedCodes = await getTrainerProgramCodes(req.trainerId!);
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
    logger.error({ err }, "Trainer portal: get participants error");
    res.status(500).json({ error: "Erreur interne." });
  }
});

export default router;
