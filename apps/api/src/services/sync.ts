import { eq } from "drizzle-orm";
import {
  userProfiles,
  users,
  syncState,
  type SyncState,
} from "@mhp/shared";
import { getAllTrainees, type DigiformaTrainee } from "@mhp/integrations/digiforma";
import { db } from "../db.js";

const DIGIFORMA_SERVICE = "digiforma";

// ---------------------------------------------------------------------------
// runIncrementalSync — hourly cron
// ---------------------------------------------------------------------------

export async function runIncrementalSync(): Promise<SyncState> {
  // For the incremental path we fetch all trainees and diff against DB.
  // When/if DigiForma adds an updatedSince filter, pass lastSyncAt here.
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

export async function runFullSync(): Promise<SyncState> {
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

async function runSync(mode: "incremental" | "full"): Promise<SyncState> {
  const startedAt = new Date();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errorLog: string | null = null;

  try {
    const trainees = await getAllTrainees();
    const result = await upsertTrainees(trainees);
    created = result.created;
    updated = result.updated;
    skipped = result.skipped;

    console.log(
      `DigiForma sync (${mode}): created=${created} updated=${updated} skipped=${skipped}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("DigiForma sync failed:", err);
    errorLog = message;
    return persistSyncState("error", 0, 0, 0, errorLog, startedAt);
  }

  return persistSyncState("success", created, updated, skipped, null, startedAt);
}

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

    // Find matching user by email
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, trainee.email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      // No local user — trainee exists in DigiForma but hasn't registered on the portal
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

    // Build update payload — only fill empty local fields from DigiForma
    const patch: Partial<typeof userProfiles.$inferSelect> = {
      digiformaId: trainee.id,
      updatedAt: new Date(),
    };

    if (shouldBackfill) {
      // Backfill profile fields only when we're creating the link for the first time
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
