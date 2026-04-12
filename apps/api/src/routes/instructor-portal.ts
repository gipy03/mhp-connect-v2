import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  instructors,
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
    const specialties = Array.isArray(body.specialties)
      ? (body.specialties as unknown[]).filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 100)).slice(0, 20)
      : undefined;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (bio !== undefined) updates.bio = bio;
    if (photoUrl !== undefined) updates.photoUrl = photoUrl;
    if (specialties !== undefined) updates.specialties = specialties;
    if (phone !== undefined) updates.phone = phone;

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
