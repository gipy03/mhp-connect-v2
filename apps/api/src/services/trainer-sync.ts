import { eq } from "drizzle-orm";
import { trainers, programOverrides } from "@mhp/shared";
import {
  getAllTrainers,
  getAllTrainingSessions,
  getAllProgramsWithParents,
  buildChildToRootMap,
  type DigiformaTrainer,
} from "@mhp/integrations/digiforma";
import { db } from "../db.js";
import { logger } from "../lib/logger.js";

export interface TrainerSyncResult {
  totalFetched: number;
  created: number;
  updated: number;
  programsLinked: number;
  errors: string[];
}

export async function syncTrainers(): Promise<TrainerSyncResult> {
  const result: TrainerSyncResult = {
    totalFetched: 0,
    created: 0,
    updated: 0,
    programsLinked: 0,
    errors: [],
  };

  logger.info("Trainer sync: fetching trainers from Digiforma");

  let digiformaTrainers: DigiformaTrainer[];
  try {
    digiformaTrainers = await getAllTrainers();
  } catch (err: any) {
    logger.error({ err }, "Trainer sync: failed to fetch from Digiforma");
    result.errors.push(`Fetch error: ${err.message}`);
    return result;
  }

  result.totalFetched = digiformaTrainers.length;
  logger.info({ count: digiformaTrainers.length }, "Trainer sync: trainers fetched");

  for (const t of digiformaTrainers) {
    try {
      const digiformaId = String(t.id);

      const [existing] = await db
        .select({ id: trainers.id })
        .from(trainers)
        .where(eq(trainers.digiformaId, digiformaId))
        .limit(1);

      const row = {
        digiformaId,
        firstName: t.firstname || "",
        lastName: t.lastname || "",
        email: t.email?.toLowerCase().trim() || null,
        phone: t.phone || null,
        role: t.role || (existing ? undefined : "Formateur"),
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      };

      if (existing) {
        await db
          .update(trainers)
          .set(row)
          .where(eq(trainers.id, existing.id));
        result.updated++;
      } else {
        await db.insert(trainers).values({
          ...row,
          role: row.role || "Formateur",
          active: true,
          createdAt: new Date(),
        });
        result.created++;
      }
    } catch (err: any) {
      result.errors.push(`Trainer ${t.id}: ${err.message}`);
    }
  }

  logger.info(
    { created: result.created, updated: result.updated, errors: result.errors.length },
    "Trainer sync complete"
  );

  try {
    const linked = await linkTrainersToPrograms();
    result.programsLinked = linked;
  } catch (err: any) {
    logger.warn({ err }, "Trainer sync: failed to link trainers to programs (non-fatal)");
    result.errors.push(`Linking error: ${err.message}`);
  }

  return result;
}

interface TrainerEntry {
  id?: string;
  name: string;
  role?: string;
  photoUrl?: string;
  profileUrl?: string;
  source?: "manual" | "digiforma";
}

function isTrainerEntryArray(val: unknown): val is TrainerEntry[] {
  if (!Array.isArray(val)) return false;
  return val.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).name === "string"
  );
}

async function linkTrainersToPrograms(): Promise<number> {
  const [sessions, allProgramsHierarchy, allTrainerRows] = await Promise.all([
    getAllTrainingSessions(),
    getAllProgramsWithParents(),
    db.select().from(trainers).where(eq(trainers.active, true)),
  ]);

  const childToRoot = buildChildToRootMap(allProgramsHierarchy);

  const trainerById = new Map(
    allTrainerRows.map((t) => [t.digiformaId, t])
  );

  const programTrainers = new Map<string, Map<string, TrainerEntry>>();

  for (const session of sessions) {
    const childCode = session.program?.code;
    if (!childCode) continue;
    const rootCode = childToRoot.get(childCode) ?? childCode;

    if (!programTrainers.has(rootCode)) {
      programTrainers.set(rootCode, new Map());
    }
    const trainerMap = programTrainers.get(rootCode)!;

    for (const inst of session.instructors ?? []) {
      const key = String(inst.id);
      if (trainerMap.has(key)) continue;

      const dbTrainer = trainerById.get(key);
      const name = dbTrainer
        ? `${dbTrainer.firstName} ${dbTrainer.lastName}`.trim()
        : `${inst.firstname} ${inst.lastname}`.trim();
      const role = dbTrainer?.role || undefined;
      const photoUrl = dbTrainer?.photoUrl || undefined;

      trainerMap.set(key, { id: key, name, role, photoUrl, source: "digiforma" });
    }
  }

  let linked = 0;
  for (const [programCode, trainerMap] of programTrainers) {
    if (trainerMap.size === 0) continue;

    const [override] = await db
      .select({ id: programOverrides.id, trainers: programOverrides.trainers })
      .from(programOverrides)
      .where(eq(programOverrides.programCode, programCode))
      .limit(1);

    if (!override) continue;

    const trainerList: TrainerEntry[] = Array.from(trainerMap.values());

    const existingTrainers = isTrainerEntryArray(override.trainers)
      ? override.trainers
      : null;

    const hasManualEntries =
      existingTrainers !== null &&
      existingTrainers.some((t) => t.source === "manual");

    if (hasManualEntries && existingTrainers) {
      const manualEntries = existingTrainers.filter((t) => t.source === "manual");
      const merged: TrainerEntry[] = [...manualEntries, ...trainerList];
      await db
        .update(programOverrides)
        .set({ trainers: merged, updatedAt: new Date() })
        .where(eq(programOverrides.id, override.id));
    } else {
      await db
        .update(programOverrides)
        .set({ trainers: trainerList, updatedAt: new Date() })
        .where(eq(programOverrides.id, override.id));
    }
    linked++;
  }

  logger.info({ linked }, "Trainer sync: linked trainers to programs");
  return linked;
}
