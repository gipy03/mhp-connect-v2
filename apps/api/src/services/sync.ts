import { desc, eq } from "drizzle-orm";
import {
  userProfiles,
  users,
  syncState,
  syncPushLog,
  programOverrides,
  digiformaSessions,
  programEnrollments,
  sessionAssignments,
  trainers,
  type SyncState,
  type SyncPushLog,
} from "@mhp/shared";
import {
  getAllTrainees,
  getAllTraineesWithSessions,
  getAllPrograms,
  getAllTrainingSessions,
  getAllProgramsWithParents,
  buildChildToRootMap,
  updateTrainee,
  updateTrainer,
  type DigiformaTrainee,
  type DigiformaProgram,
  type DigiformaCalendarSession,
} from "@mhp/integrations/digiforma";
import { updateContact } from "@mhp/integrations/bexio";
import { db } from "../db.js";
import { logger } from "../lib/logger.js";

const DIGIFORMA_SERVICE = "digiforma";

let syncLock = false;

export interface SyncResult {
  syncState: SyncState;
  programs: { created: number; updated: number; skipped: number };
  sessions: { created: number; updated: number; skipped: number };
  users: { created: number; updated: number; skipped: number };
}

// ---------------------------------------------------------------------------
// runIncrementalSync — hourly cron
// ---------------------------------------------------------------------------

export async function runIncrementalSync(): Promise<SyncResult> {
  const [state] = await db
    .select()
    .from(syncState)
    .where(eq(syncState.service, DIGIFORMA_SERVICE))
    .limit(1);

  const since = state?.lastSyncAt;
  if (since) {
    logger.info(
      { since: since.toISOString() },
      "DigiForma sync: incremental"
    );
  }

  return runSync("incremental");
}

// ---------------------------------------------------------------------------
// runFullSync — admin-triggered
// ---------------------------------------------------------------------------

export async function runFullSync(): Promise<SyncResult> {
  logger.info("DigiForma sync: full sync triggered");
  return runSync("full");
}

// ---------------------------------------------------------------------------
// getSyncStatus
// ---------------------------------------------------------------------------

export async function getSyncStatus(): Promise<SyncState | null> {
  const [state] = await db
    .select()
    .from(syncState)
    .where(eq(syncState.service, DIGIFORMA_SERVICE))
    .limit(1);

  return state ?? null;
}

// ---------------------------------------------------------------------------
// Core sync logic
// ---------------------------------------------------------------------------

async function runSync(mode: "incremental" | "full"): Promise<SyncResult> {
  if (syncLock) {
    throw new Error("DigiForma sync is already in progress");
  }
  syncLock = true;

  const startedAt = new Date();
  let programStats = { created: 0, updated: 0, skipped: 0 };
  let sessionStats = { created: 0, updated: 0, skipped: 0 };
  let userStats = { created: 0, updated: 0, skipped: 0 };
  let errorLog: string | null = null;

  try {
    const [programs, sessions, trainees] = await Promise.all([
      getAllPrograms(),
      getAllTrainingSessions(),
      getAllTrainees(),
    ]);

    await db.transaction(async (tx) => {
      programStats = await syncPrograms(tx, programs);
      sessionStats = await syncSessions(tx, sessions);
      userStats = await upsertTrainees(tx, trainees);
    });

    logger.info(
      {
        mode,
        programs: programStats,
        sessions: sessionStats,
        users: userStats,
      },
      "DigiForma sync completed"
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "DigiForma sync failed");
    errorLog = message;

    const totalCreated = programStats.created + sessionStats.created + userStats.created;
    const totalUpdated = programStats.updated + sessionStats.updated + userStats.updated;
    const totalSkipped = programStats.skipped + sessionStats.skipped + userStats.skipped;

    const state = await persistSyncState("error", totalCreated, totalUpdated, totalSkipped, errorLog, startedAt);
    return { syncState: state, programs: programStats, sessions: sessionStats, users: userStats };
  } finally {
    syncLock = false;
  }

  const totalCreated = programStats.created + sessionStats.created + userStats.created;
  const totalUpdated = programStats.updated + sessionStats.updated + userStats.updated;
  const totalSkipped = programStats.skipped + sessionStats.skipped + userStats.skipped;

  const state = await persistSyncState("success", totalCreated, totalUpdated, totalSkipped, null, startedAt);

  try {
    const { ensureChannelsForAllSessions } = await import("./forum.js");
    await ensureChannelsForAllSessions();
  } catch (err) {
    logger.warn({ err }, "Channel auto-creation after sync failed (non-fatal)");
  }

  return { syncState: state, programs: programStats, sessions: sessionStats, users: userStats };
}

// ---------------------------------------------------------------------------
// Programs sync
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function syncPrograms(tx: Tx, programs: DigiformaProgram[]): Promise<{
  created: number;
  updated: number;
  skipped: number;
}> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const program of programs) {
    const code = program.code;
    if (!code) {
      skipped++;
      continue;
    }

    const [existing] = await tx
      .select({
        id: programOverrides.id,
        displayName: programOverrides.displayName,
        description: programOverrides.description,
        imageUrl: programOverrides.imageUrl,
        category: programOverrides.category,
      })
      .from(programOverrides)
      .where(eq(programOverrides.programCode, code))
      .limit(1);

    const description = program.description || program.subtitle || null;
    const imageUrl = program.image?.url || null;
    const category = program.category?.name || null;

    if (!existing) {
      await tx.insert(programOverrides).values({
        programCode: code,
        published: true,
        displayName: program.name,
        description,
        imageUrl,
        category,
      });
      created++;
    } else {
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (!existing.displayName) patch.displayName = program.name;
      if (!existing.description) patch.description = description;
      if (!existing.imageUrl) patch.imageUrl = imageUrl;
      if (!existing.category) patch.category = category;

      if (Object.keys(patch).length > 1) {
        await tx
          .update(programOverrides)
          .set(patch)
          .where(eq(programOverrides.id, existing.id));
        updated++;
      } else {
        skipped++;
      }
    }
  }

  return { created, updated, skipped };
}

// ---------------------------------------------------------------------------
// Sessions sync
// ---------------------------------------------------------------------------

async function syncSessions(tx: Tx, sessions: DigiformaCalendarSession[]): Promise<{
  created: number;
  updated: number;
  skipped: number;
}> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const session of sessions) {
    const digiformaId = String(session.id);

    const [existing] = await tx
      .select({ id: digiformaSessions.id })
      .from(digiformaSessions)
      .where(eq(digiformaSessions.digiformaId, digiformaId))
      .limit(1);

    const values = {
      name: session.name || null,
      code: session.code || null,
      programCode: session.program?.code || null,
      programName: session.program?.name || null,
      startDate: session.startDate || null,
      endDate: session.endDate || null,
      place: session.place || null,
      placeName: session.placeName || null,
      remote: session.remote ?? false,
      inter: session.inter ?? false,
      imageUrl: session.image?.url || null,
      dates: session.dates || null,
    };

    if (!existing) {
      await tx.insert(digiformaSessions).values({
        digiformaId,
        ...values,
      });
      created++;
    } else {
      await tx
        .update(digiformaSessions)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(digiformaSessions.id, existing.id));
      updated++;
    }
  }

  return { created, updated, skipped };
}

// ---------------------------------------------------------------------------
// Trainees/Users sync
// ---------------------------------------------------------------------------

async function upsertTrainees(tx: Tx, trainees: DigiformaTrainee[]): Promise<{
  created: number;
  updated: number;
  skipped: number;
}> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const trainee of trainees) {
    if (!trainee.email) {
      skipped++;
      continue;
    }

    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, trainee.email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      skipped++;
      continue;
    }

    const [profile] = await tx
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    if (!profile) {
      skipped++;
      continue;
    }

    const needsUpdate = profile.digiformaId !== trainee.id;
    const shouldBackfill = !profile.digiformaId;

    if (!needsUpdate && !shouldBackfill) {
      skipped++;
      continue;
    }

    const patch: Partial<typeof userProfiles.$inferSelect> = {
      digiformaId: trainee.id,
      updatedAt: new Date(),
    };

    if (shouldBackfill) {
      if (!profile.firstName && trainee.firstname) patch.firstName = trainee.firstname;
      if (!profile.lastName && trainee.lastname) patch.lastName = trainee.lastname;
      if (!profile.phone && trainee.phone) patch.phone = trainee.phone;
      if (!profile.roadAddress && trainee.roadAddress) patch.roadAddress = trainee.roadAddress;
      if (!profile.city && trainee.city) patch.city = trainee.city;
      if (!profile.cityCode && trainee.cityCode) patch.cityCode = trainee.cityCode;
      if (!profile.country && trainee.country) patch.country = trainee.country;
      if (!profile.countryCode && trainee.countryCode) patch.countryCode = trainee.countryCode;
      if (!profile.birthdate && trainee.birthdate) patch.birthdate = trainee.birthdate;
      if (!profile.nationality && trainee.nationality) patch.nationality = trainee.nationality;
      if (!profile.profession && trainee.profession) patch.profession = trainee.profession;
      created++;
    } else {
      updated++;
    }

    await tx
      .update(userProfiles)
      .set(patch)
      .where(eq(userProfiles.userId, user.id));
  }

  return { created, updated, skipped };
}

// ---------------------------------------------------------------------------
// Persist sync state
// ---------------------------------------------------------------------------

async function persistSyncState(
  status: "success" | "partial" | "error",
  recordsCreated: number,
  recordsUpdated: number,
  recordsSkipped: number,
  errorLog: string | null,
  startedAt: Date
): Promise<SyncState> {
  const now = new Date();

  const [existing] = await db
    .select({ id: syncState.id })
    .from(syncState)
    .where(eq(syncState.service, DIGIFORMA_SERVICE))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(syncState)
      .set({
        lastSyncAt: startedAt,
        lastSyncStatus: status,
        recordsCreated,
        recordsUpdated,
        recordsSkipped,
        errorLog,
        updatedAt: now,
      })
      .where(eq(syncState.id, existing.id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(syncState)
    .values({
      service: DIGIFORMA_SERVICE,
      lastSyncAt: startedAt,
      lastSyncStatus: status,
      recordsCreated,
      recordsUpdated,
      recordsSkipped,
      errorLog,
    })
    .returning();
  return created!;
}

// ---------------------------------------------------------------------------
// Bulk import — one-time: create user accounts from DigiForma trainees
// ---------------------------------------------------------------------------

export interface BulkImportResult {
  usersCreated: number;
  profilesCreated: number;
  enrollmentsCreated: number;
  sessionsAssigned: number;
  skipped: number;
  errors: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function bulkImportTrainees(): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    usersCreated: 0,
    profilesCreated: 0,
    enrollmentsCreated: 0,
    sessionsAssigned: 0,
    skipped: 0,
    errors: [],
  };

  logger.info("Bulk import: fetching all trainees with sessions from DigiForma");
  const trainees = await getAllTraineesWithSessions();
  logger.info({ count: trainees.length }, "Bulk import: trainees fetched");

  for (const trainee of trainees) {
    const rawEmail = trainee.email?.toLowerCase().trim();
    if (!rawEmail || !EMAIL_RE.test(rawEmail)) {
      result.skipped++;
      continue;
    }

    try {
      await db.transaction(async (tx) => {
        const userId = await ensureUser(tx, trainee, rawEmail, result);
        await ensureEnrollments(tx, trainee, userId, result);
      });
    } catch (err) {
      const msg = `Trainee ${rawEmail}: ${err instanceof Error ? err.message : String(err)}`;
      logger.error({ err, email: rawEmail }, "Bulk import error");
      result.errors.push(msg);
    }
  }

  logger.info(
    {
      usersCreated: result.usersCreated,
      profilesCreated: result.profilesCreated,
      enrollmentsCreated: result.enrollmentsCreated,
      sessionsAssigned: result.sessionsAssigned,
      skipped: result.skipped,
      errors: result.errors.length,
    },
    "Bulk import complete"
  );

  return result;
}

function buildProfileData(trainee: DigiformaTrainee) {
  return {
    digiformaId: String(trainee.id),
    firstName: trainee.firstname || null,
    lastName: trainee.lastname || null,
    phone: trainee.phone || null,
    phoneSecondary: trainee.phoneSecondary || null,
    roadAddress: trainee.roadAddress || null,
    city: trainee.city || null,
    cityCode: trainee.cityCode || null,
    country: trainee.country || null,
    countryCode: trainee.countryCode || null,
    birthdate: trainee.birthdate || null,
    nationality: trainee.nationality || null,
    profession: trainee.profession || null,
  };
}

function backfillOnly(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (value != null && (existing[key] == null || existing[key] === "")) {
      updates[key] = value;
    }
  }
  return updates;
}

async function ensureUser(
  tx: Tx,
  trainee: DigiformaTrainee,
  email: string,
  result: BulkImportResult
): Promise<string> {
  const [existingUser] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    const [existingProfile] = await tx
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, existingUser.id))
      .limit(1);

    if (existingProfile) {
      if (!existingProfile.digiformaId) {
        const incoming = buildProfileData(trainee);
        const updates = backfillOnly(existingProfile as unknown as Record<string, unknown>, incoming);
        if (Object.keys(updates).length > 0) {
          await tx
            .update(userProfiles)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(userProfiles.id, existingProfile.id));
        }
      }
    } else {
      await tx.insert(userProfiles).values({
        userId: existingUser.id,
        ...buildProfileData(trainee),
      });
      result.profilesCreated++;
    }
    return existingUser.id;
  }

  const [newUser] = await tx
    .insert(users)
    .values({
      email,
      passwordHash: null,
      role: "member",
      emailVerified: false,
    })
    .returning({ id: users.id });

  result.usersCreated++;

  await tx.insert(userProfiles).values({
    userId: newUser!.id,
    ...buildProfileData(trainee),
  });
  result.profilesCreated++;

  return newUser!.id;
}

async function ensureEnrollments(
  tx: Tx,
  trainee: DigiformaTrainee,
  userId: string,
  result: BulkImportResult
): Promise<void> {
  if (!trainee.trainingSessions || trainee.trainingSessions.length === 0) return;

  const sessionsByProgram = new Map<string, typeof trainee.trainingSessions>();
  for (const session of trainee.trainingSessions) {
    const programCode = session.program?.code;
    if (!programCode) continue;
    if (!sessionsByProgram.has(programCode)) {
      sessionsByProgram.set(programCode, []);
    }
    sessionsByProgram.get(programCode)!.push(session);
  }

  const userEnrollments = await tx
    .select({ id: programEnrollments.id, programCode: programEnrollments.programCode })
    .from(programEnrollments)
    .where(eq(programEnrollments.userId, userId));

  for (const [programCode, sessions] of sessionsByProgram) {
    let enrollment = userEnrollments.find((e) => e.programCode === programCode);

    if (!enrollment) {
      const [created] = await tx
        .insert(programEnrollments)
        .values({
          userId,
          programCode,
          status: "active",
        })
        .returning({ id: programEnrollments.id, programCode: programEnrollments.programCode });
      enrollment = created!;
      result.enrollmentsCreated++;
    }

    const existingAssignments = await tx
      .select({ sessionId: sessionAssignments.sessionId })
      .from(sessionAssignments)
      .where(eq(sessionAssignments.enrollmentId, enrollment.id));

    const assignedSessionIds = new Set(existingAssignments.map((a) => a.sessionId));

    for (const session of sessions) {
      const sessionId = String(session.id);
      if (assignedSessionIds.has(sessionId)) continue;

      await tx.insert(sessionAssignments).values({
        enrollmentId: enrollment.id,
        sessionId,
        status: "assigned",
      });
      result.sessionsAssigned++;
    }
  }
}

// ---------------------------------------------------------------------------
// Remap enrollment program codes from child→root
// ---------------------------------------------------------------------------

export interface RemapResult {
  remapped: number;
  merged: number;
  skipped: number;
  errors: string[];
}

export async function remapEnrollmentCodes(): Promise<RemapResult> {
  const result: RemapResult = { remapped: 0, merged: 0, skipped: 0, errors: [] };

  logger.info("Remap: fetching program hierarchy from DigiForma");
  const allPrograms = await getAllProgramsWithParents();
  const childToRoot = buildChildToRootMap(allPrograms);
  logger.info({ mappings: childToRoot.size }, "Remap: code mappings built");

  const enrollments = await db.select().from(programEnrollments);

  for (const enrollment of enrollments) {
    const rootCode = childToRoot.get(enrollment.programCode);
    if (!rootCode || rootCode === enrollment.programCode) {
      result.skipped++;
      continue;
    }

    try {
      await db.transaction(async (tx) => {
        const userEnrollments = await tx
          .select()
          .from(programEnrollments)
          .where(eq(programEnrollments.userId, enrollment.userId));

        const existingRoot = userEnrollments.find(
          (e) => e.programCode === rootCode && e.id !== enrollment.id
        );

        if (existingRoot) {
          const childAssignments = await tx
            .select()
            .from(sessionAssignments)
            .where(eq(sessionAssignments.enrollmentId, enrollment.id));

          const rootAssignments = await tx
            .select()
            .from(sessionAssignments)
            .where(eq(sessionAssignments.enrollmentId, existingRoot.id));

          const rootSessionIds = new Set(rootAssignments.map((a) => a.sessionId));

          for (const assignment of childAssignments) {
            if (rootSessionIds.has(assignment.sessionId)) {
              await tx.delete(sessionAssignments).where(eq(sessionAssignments.id, assignment.id));
            } else {
              await tx
                .update(sessionAssignments)
                .set({ enrollmentId: existingRoot.id })
                .where(eq(sessionAssignments.id, assignment.id));
            }
          }

          await tx.delete(programEnrollments).where(eq(programEnrollments.id, enrollment.id));
          result.merged++;
        } else {
          await tx
            .update(programEnrollments)
            .set({ programCode: rootCode, updatedAt: new Date() })
            .where(eq(programEnrollments.id, enrollment.id));
          result.remapped++;
        }
      });
    } catch (err) {
      const msg = `Enrollment ${enrollment.id}: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
    }
  }

  logger.info(
    {
      remapped: result.remapped,
      merged: result.merged,
      skipped: result.skipped,
      errors: result.errors.length,
    },
    "Remap complete"
  );
  return result;
}

// ---------------------------------------------------------------------------
// Outbound push — fire-and-forget sync to DigiForma & Bexio
// ---------------------------------------------------------------------------

async function logPush(entry: {
  targetService: string;
  entityType: string;
  entityId: string;
  status: string;
  fieldsPushed: string[];
  errorDetail?: string;
}) {
  try {
    await db.insert(syncPushLog).values({
      targetService: entry.targetService,
      entityType: entry.entityType,
      entityId: entry.entityId,
      status: entry.status,
      fieldsPushed: entry.fieldsPushed,
      errorDetail: entry.errorDetail ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to write sync push log");
  }
}

export async function pushMemberProfileChanges(
  userId: string,
  changedFields: Record<string, unknown>
) {
  try {
    const [profile] = await db
      .select({
        digiformaId: userProfiles.digiformaId,
        bexioContactId: userProfiles.bexioContactId,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (!profile) return;

    const digiformaFields: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      firstName: "firstname",
      lastName: "lastname",
      phone: "phone",
      roadAddress: "roadAddress",
      city: "city",
      cityCode: "cityCode",
      countryCode: "countryCode",
      birthdate: "birthdate",
      nationality: "nationality",
      profession: "profession",
    };
    for (const [local, remote] of Object.entries(fieldMap)) {
      if (local in changedFields) {
        digiformaFields[remote] = changedFields[local];
      }
    }

    const bexioFields: Record<string, unknown> = {};
    const bexioMap: Record<string, string> = {
      lastName: "name_1",
      firstName: "name_2",
      phone: "phone_fixed",
      roadAddress: "address",
      cityCode: "postcode",
      city: "city",
    };
    for (const [local, remote] of Object.entries(bexioMap)) {
      if (local in changedFields) {
        bexioFields[remote] = changedFields[local];
      }
    }

    const promises: Promise<void>[] = [];

    if (profile.digiformaId && Object.keys(digiformaFields).length > 0) {
      promises.push(
        (async () => {
          try {
            const result = await updateTrainee(profile.digiformaId!, digiformaFields as Parameters<typeof updateTrainee>[1]);
            await logPush({
              targetService: "digiforma",
              entityType: "member",
              entityId: userId,
              status: result === null ? "skipped" : "success",
              fieldsPushed: Object.keys(digiformaFields),
              errorDetail: result === null ? "Mutation not supported by DigiForma plan" : undefined,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error({ err, userId, service: "digiforma", fields: Object.keys(digiformaFields) }, "Push to DigiForma failed");
            await logPush({
              targetService: "digiforma",
              entityType: "member",
              entityId: userId,
              status: "failed",
              fieldsPushed: Object.keys(digiformaFields),
              errorDetail: message,
            });
          }
        })()
      );
    }

    if (profile.bexioContactId && Object.keys(bexioFields).length > 0) {
      promises.push(
        (async () => {
          try {
            await updateContact(Number(profile.bexioContactId), bexioFields as Parameters<typeof updateContact>[1]);
            await logPush({
              targetService: "bexio",
              entityType: "member",
              entityId: userId,
              status: "success",
              fieldsPushed: Object.keys(bexioFields),
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error({ err, userId, service: "bexio", fields: Object.keys(bexioFields) }, "Push to Bexio failed");
            await logPush({
              targetService: "bexio",
              entityType: "member",
              entityId: userId,
              status: "failed",
              fieldsPushed: Object.keys(bexioFields),
              errorDetail: message,
            });
          }
        })()
      );
    }

    await Promise.allSettled(promises);
  } catch (err) {
    logger.error({ err, userId }, "pushMemberProfileChanges failed");
  }
}

export async function pushTrainerProfileChanges(
  trainerId: string,
  changedFields: Record<string, unknown>
) {
  try {
    const [trainer] = await db
      .select({ digiformaId: trainers.digiformaId })
      .from(trainers)
      .where(eq(trainers.id, trainerId))
      .limit(1);

    if (!trainer?.digiformaId) return;

    const digiformaFields: Record<string, unknown> = {};
    if ("phone" in changedFields) digiformaFields.phone = changedFields.phone;

    if (Object.keys(digiformaFields).length === 0) return;

    try {
      const result = await updateTrainer(trainer.digiformaId, digiformaFields as Parameters<typeof updateTrainer>[1]);
      await logPush({
        targetService: "digiforma",
        entityType: "trainer",
        entityId: trainerId,
        status: result === null ? "skipped" : "success",
        fieldsPushed: Object.keys(digiformaFields),
        errorDetail: result === null ? "Mutation not supported by DigiForma plan" : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, trainerId, service: "digiforma", fields: Object.keys(digiformaFields) }, "Push trainer to DigiForma failed");
      await logPush({
        targetService: "digiforma",
        entityType: "trainer",
        entityId: trainerId,
        status: "failed",
        fieldsPushed: Object.keys(digiformaFields),
        errorDetail: message,
      });
    }
  } catch (err) {
    logger.error({ err, trainerId }, "pushTrainerProfileChanges failed");
  }
}

export async function getRecentPushLogs(limit = 50): Promise<SyncPushLog[]> {
  return db
    .select()
    .from(syncPushLog)
    .orderBy(desc(syncPushLog.createdAt))
    .limit(limit);
}
