import { activityLogs } from "@mhp/shared";
import { db } from "../db.js";
import { logger } from "../lib/logger.js";

export interface LogActivityOptions {
  userId?: string | null;
  adminEmail?: string | null;
  action: string;
  detail?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
}

export async function logActivity(opts: LogActivityOptions): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      userId: opts.userId ?? null,
      adminEmail: opts.adminEmail ?? null,
      action: opts.action,
      detail: opts.detail ?? null,
      targetType: opts.targetType ?? null,
      targetId: opts.targetId ?? null,
      ipAddress: opts.ipAddress ?? null,
    });
  } catch (err) {
    logger.warn({ err, action: opts.action }, "Failed to log activity (non-fatal)");
  }
}
