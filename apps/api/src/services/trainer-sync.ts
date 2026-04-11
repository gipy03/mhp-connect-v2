import { eq } from "drizzle-orm";
import { trainers } from "@mhp/shared";
import { getAllTrainers, type DigiformaTrainer } from "@mhp/integrations/digiforma";
import { db } from "../db.js";
import { logger } from "../lib/logger.js";

export interface TrainerSyncResult {
  totalFetched: number;
  created: number;
  updated: number;
  errors: string[];
}

export async function syncTrainers(): Promise<TrainerSyncResult> {
  const result: TrainerSyncResult = {
    totalFetched: 0,
    created: 0,
    updated: 0,
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

  return result;
}
