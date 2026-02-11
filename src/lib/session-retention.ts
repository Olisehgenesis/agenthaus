/**
 * Session Message Retention
 *
 * Session messages are stored in the database for conversation continuity.
 * By default, messages older than 30 days are auto-deleted.
 *
 * Configure via env:
 *   SESSION_MESSAGE_RETENTION_DAYS — default 30, set to 0 to disable auto-delete
 */

import { prisma } from "@/lib/db";

const DEFAULT_RETENTION_DAYS = 30;

export function getSessionRetentionDays(): number {
  const env = process.env.SESSION_MESSAGE_RETENTION_DAYS;
  if (env === undefined || env === "") return DEFAULT_RETENTION_DAYS;
  const n = parseInt(env, 10);
  if (isNaN(n) || n < 0) return DEFAULT_RETENTION_DAYS;
  return n;
}

/**
 * Delete SessionMessages older than the configured retention period.
 * Called from cron tick and optionally after saveSessionMessages.
 */
export async function pruneExpiredSessionMessages(): Promise<number> {
  const retentionDays = getSessionRetentionDays();
  if (retentionDays === 0) return 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await prisma.sessionMessage.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return result.count;
}
