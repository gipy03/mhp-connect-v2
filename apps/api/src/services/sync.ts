import { eq } from "drizzle-orm";
import {
  userProfiles,
  users,
  syncState,
  programOverrides,
  digiformaSessions,
  type SyncState,
} from "@mhp/shared";
import {
  getAllTrainees,
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
