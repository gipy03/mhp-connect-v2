import { eq } from "drizzle-orm";
import { instructors, programOverrides } from "@mhp/shared";
import {
  getAllInstructors,
  getAllTrainingSessions,
  getAllProgramsWithParents,
  buildChildToRootMap,
  type DigiformaInstructor,
} from "@mhp/integrations/digiforma";
import { db } from "../db.js";
import { logger } from "../lib/logger.js";

export interface InstructorSyncResult {
  totalFetched: number;
  created: number;
  updated: number;
  programsLinked: number;
  errors: string[];
}

export async function syncInstructors(): Promise<InstructorSyncResult> {
  const result: InstructorSyncResult = {
    totalFetched: 0,
    created: 0,
    updated: 0,
    programsLinked: 0,
    errors: [],
  };

  logger.info("Instructor sync: fetching instructors from Digiforma");

  let digiformaInstructors: DigiformaInstructor[];
  try {
    digiformaInstructors = await getAllInstructors();
  } catch (err: any) {
    logger.error({ err }, "Instructor sync: failed to fetch from Digiforma");
    result.errors.push(`Fetch error: ${err.message}`);
    return result;
  }

  result.totalFetched = digiformaInstructors.length;
  logger.info({ count: digiformaInstructors.length }, "Instructor sync: instructors fetched");

  for (const t of digiformaInstructors) {
    try {
      const digiformaId = String(t.id);

      const [existing] = await db
        .select({ id: instructors.id })
        .from(instructors)
        .where(eq(instructors.digiformaId, digiformaId))
        .limit(1);

      const row = {
        digiformaId,
        firstName: t.firstname || "",
        lastName: t.lastname || "",
        email: t.email?.toLowerCase().trim() || null,
        phone: t.phone || null,
        bio: t.bio || null,
        role: existing ? undefined : "Formateur",
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      };

      if (existing) {
        await db
          .update(instructors)
          .set(row)
          .where(eq(instructors.id, existing.id));
        result.updated++;
      } else {
        await db.insert(instructors).values({
          ...row,
          role: row.role || "Formateur",
          active: true,
          createdAt: new Date(),
        });
        result.created++;
      }
    } catch (err: any) {
      result.errors.push(`Instructor ${t.id}: ${err.message}`);
    }
  }

  logger.info(
    { created: result.created, updated: result.updated, errors: result.errors.length },
    "Instructor sync complete"
  );

  try {
    const linked = await linkInstructorsToPrograms();
    result.programsLinked = linked;
  } catch (err: any) {
    logger.warn({ err }, "Instructor sync: failed to link instructors to programs (non-fatal)");
    result.errors.push(`Linking error: ${err.message}`);
  }

  return result;
}

interface InstructorEntry {
  id?: string;
  name: string;
  role?: string;
  photoUrl?: string;
  profileUrl?: string;
  source?: "manual" | "digiforma";
}

function isInstructorEntryArray(val: unknown): val is InstructorEntry[] {
  if (!Array.isArray(val)) return false;
  return val.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).name === "string"
  );
}

async function linkInstructorsToPrograms(): Promise<number> {
  const [sessions, allProgramsHierarchy, allInstructorRows] = await Promise.all([
    getAllTrainingSessions(),
    getAllProgramsWithParents(),
    db.select().from(instructors).where(eq(instructors.active, true)),
  ]);

  const childToRoot = buildChildToRootMap(allProgramsHierarchy);

  const instructorById = new Map(
    allInstructorRows.map((t) => [t.digiformaId, t])
  );

  const programInstructors = new Map<string, Map<string, InstructorEntry>>();

  for (const session of sessions) {
    const childCode = session.program?.code;
    if (!childCode) continue;
    const rootCode = childToRoot.get(childCode) ?? childCode;

    if (!programInstructors.has(rootCode)) {
      programInstructors.set(rootCode, new Map());
    }
    const instructorMap = programInstructors.get(rootCode)!;

    for (const inst of session.instructors ?? []) {
      const key = String(inst.id);
      if (instructorMap.has(key)) continue;

      const dbInstructor = instructorById.get(key);
      const name = dbInstructor
        ? `${dbInstructor.firstName} ${dbInstructor.lastName}`.trim()
        : `${inst.firstname} ${inst.lastname}`.trim();
      const role = dbInstructor?.role || undefined;
      const photoUrl = dbInstructor?.photoUrl || undefined;

      instructorMap.set(key, { id: key, name, role, photoUrl, source: "digiforma" });
    }
  }

  let linked = 0;
  for (const [programCode, instructorMap] of programInstructors) {
    if (instructorMap.size === 0) continue;

    const [override] = await db
      .select({ id: programOverrides.id, instructors: programOverrides.instructors })
      .from(programOverrides)
      .where(eq(programOverrides.programCode, programCode))
      .limit(1);

    if (!override) continue;

    const instructorList: InstructorEntry[] = Array.from(instructorMap.values());

    const existingInstructors = isInstructorEntryArray(override.instructors)
      ? override.instructors
      : null;

    const hasManualEntries =
      existingInstructors !== null &&
      existingInstructors.some((t) => t.source === "manual");

    if (hasManualEntries && existingInstructors) {
      const manualEntries = existingInstructors.filter((t) => t.source === "manual");
      const merged: InstructorEntry[] = [...manualEntries, ...instructorList];
      await db
        .update(programOverrides)
        .set({ instructors: merged, updatedAt: new Date() })
        .where(eq(programOverrides.id, override.id));
    } else {
      await db
        .update(programOverrides)
        .set({ instructors: instructorList, updatedAt: new Date() })
        .where(eq(programOverrides.id, override.id));
    }
    linked++;
  }

  logger.info({ linked }, "Instructor sync: linked instructors to programs");
  return linked;
}
