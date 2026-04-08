import { eq } from "drizzle-orm";
import {
  userProfiles,
  users,
  syncState,
  programOverrides,
  digiformaSessions,
  programEnrollments,
  sessionAssignments,
  type SyncState,
} from "@mhp/shared";
import {
  getAllTrainees,
  getAllTraineesWithSessions,
  getAllPrograms,
  getAllTrainingSessions,
  type DigiformaTrainee,
  type DigiformaProgram,
  type DigiformaCalendarSession,
} from "@mhp/integrations/digiforma";
import { db } from "../db.js";

const DIGIFORMA_SERVICE = "digiforma";

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
    console.log(
      `DigiForma sync: incremental since ${since.toISOString()}`
    );
  }

  return runSync("incremental");
}

// ---------------------------------------------------------------------------
// runFullSync — admin-triggered
// ---------------------------------------------------------------------------

export async function runFullSync(): Promise<SyncResult> {
  console.log("DigiForma sync: full sync triggered");
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

    programStats = await syncPrograms(programs);
    sessionStats = await syncSessions(sessions);
    userStats = await upsertTrainees(trainees);

    console.log(
      `DigiForma sync (${mode}): programs=${programStats.created}c/${programStats.updated}u/${programStats.skipped}s ` +
      `sessions=${sessionStats.created}c/${sessionStats.updated}u/${sessionStats.skipped}s ` +
      `users=${userStats.created}c/${userStats.updated}u/${userStats.skipped}s`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("DigiForma sync failed:", err);
    errorLog = message;

    const totalCreated = programStats.created + sessionStats.created + userStats.created;
    const totalUpdated = programStats.updated + sessionStats.updated + userStats.updated;
    const totalSkipped = programStats.skipped + sessionStats.skipped + userStats.skipped;

    const state = await persistSyncState("error", totalCreated, totalUpdated, totalSkipped, errorLog, startedAt);
    return { syncState: state, programs: programStats, sessions: sessionStats, users: userStats };
  }

  const totalCreated = programStats.created + sessionStats.created + userStats.created;
  const totalUpdated = programStats.updated + sessionStats.updated + userStats.updated;
  const totalSkipped = programStats.skipped + sessionStats.skipped + userStats.skipped;

  const state = await persistSyncState("success", totalCreated, totalUpdated, totalSkipped, null, startedAt);
  return { syncState: state, programs: programStats, sessions: sessionStats, users: userStats };
}

// ---------------------------------------------------------------------------
// Programs sync
// ---------------------------------------------------------------------------

async function syncPrograms(programs: DigiformaProgram[]): Promise<{
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

    const [existing] = await db
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
      await db.insert(programOverrides).values({
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
        await db
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

async function syncSessions(sessions: DigiformaCalendarSession[]): Promise<{
  created: number;
  updated: number;
  skipped: number;
}> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const session of sessions) {
    const digiformaId = String(session.id);

    const [existing] = await db
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
      await db.insert(digiformaSessions).values({
        digiformaId,
        ...values,
      });
      created++;
    } else {
      await db
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

async function upsertTrainees(trainees: DigiformaTrainee[]): Promise<{
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

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, trainee.email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      skipped++;
      continue;
    }

    const [profile] = await db
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

    await db
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

  console.log("Bulk import: fetching all trainees with sessions from DigiForma...");
  const trainees = await getAllTraineesWithSessions();
  console.log(`Bulk import: ${trainees.length} trainees fetched`);

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
      console.error("Bulk import error:", msg);
      result.errors.push(msg);
    }
  }

  console.log(
    `Bulk import complete: ${result.usersCreated} users, ${result.profilesCreated} profiles, ` +
    `${result.enrollmentsCreated} enrollments, ${result.sessionsAssigned} sessions, ` +
    `${result.skipped} skipped, ${result.errors.length} errors`
  );

  return result;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
