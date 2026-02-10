/**
 * In-Process Cron Scheduler
 *
 * Checks all agents' enabled cron jobs, finds which are due, and executes
 * them concurrently via processMessage(). No external dependencies — runs
 * entirely inside the Next.js process.
 *
 * Trigger: POST /api/cron/tick (called every minute by Vercel Cron,
 * external service, or client-side setInterval)
 *
 * Cron format: standard 5-field (min hour dom month dow)
 *   "* /5 * * * *" = every 5 minutes
 *   "0 * * * *"    = every hour
 *   "0 9 * * *"    = daily at 9 AM
 */

import { prisma } from "@/lib/db";
import { processMessage } from "@/lib/openclaw/manager";
import type { CronJobDef } from "./types";

// ─── Cron Expression Parser ─────────────────────────────────────────────────

/**
 * Check if a cron expression matches a given date.
 * Supports: *, specific values, ranges (1-5), steps (* /5), lists (1,3,5)
 */
function cronMatches(cronExpr: string, date: Date): boolean {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minField, hourField, domField, monField, dowField] = parts;
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1; // 1-indexed
  const dayOfWeek = date.getDay(); // 0=Sunday

  return (
    fieldMatches(minField, minute, 0, 59) &&
    fieldMatches(hourField, hour, 0, 23) &&
    fieldMatches(domField, dayOfMonth, 1, 31) &&
    fieldMatches(monField, month, 1, 12) &&
    fieldMatches(dowField, dayOfWeek, 0, 7) // 7 also = Sunday
  );
}

function fieldMatches(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;

  // Handle lists: "1,3,5"
  const parts = field.split(",");
  for (const part of parts) {
    if (singleFieldMatches(part.trim(), value, min, max)) return true;
  }
  return false;
}

function singleFieldMatches(part: string, value: number, min: number, max: number): boolean {
  // Step: "*/5" or "1-10/2"
  const stepMatch = part.match(/^(.+)\/(\d+)$/);
  if (stepMatch) {
    const step = parseInt(stepMatch[2]);
    const base = stepMatch[1];
    if (base === "*") {
      return value % step === 0;
    }
    // Range with step: "1-10/2"
    const rangeMatch = base.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      const end = parseInt(rangeMatch[2]);
      return value >= start && value <= end && (value - start) % step === 0;
    }
    return false;
  }

  // Range: "1-5"
  const rangeMatch = part.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    return value >= start && value <= end;
  }

  // Exact value
  const num = parseInt(part);
  if (!isNaN(num)) {
    return value === num;
  }

  return false;
}

// ─── Job Execution ──────────────────────────────────────────────────────────

/**
 * Check and execute all due cron jobs across all agents.
 * Called once per minute by /api/cron/tick.
 *
 * Returns summary of executed jobs.
 */
export async function tickCronJobs(): Promise<{
  checked: number;
  executed: number;
  errors: number;
  results: { agentId: string; jobId: string; jobName: string; success: boolean; error?: string }[];
}> {
  const now = new Date();
  const results: { agentId: string; jobId: string; jobName: string; success: boolean; error?: string }[] = [];

  // Fetch all active agents with cron jobs
  const agents = await prisma.agent.findMany({
    where: {
      status: "active",
      cronJobs: { not: null },
    },
    select: {
      id: true,
      cronJobs: true,
    },
  });

  let checked = 0;
  const jobPromises: Promise<void>[] = [];

  for (const agent of agents) {
    if (!agent.cronJobs) continue;

    let jobs: CronJobDef[];
    try {
      jobs = JSON.parse(agent.cronJobs) as CronJobDef[];
    } catch {
      continue;
    }

    for (const job of jobs) {
      if (!job.enabled) continue;
      checked++;

      // Check if this job is due now
      if (!cronMatches(job.cron, now)) continue;

      // Check if already ran this minute (prevent double-execution)
      if (job.lastRun) {
        const lastRun = new Date(job.lastRun);
        const diffMs = now.getTime() - lastRun.getTime();
        if (diffMs < 55_000) continue; // Ran less than 55s ago
      }

      // Execute concurrently
      const promise = executeCronJob(agent.id, job, jobs).then((result) => {
        results.push(result);
      });
      jobPromises.push(promise);
    }
  }

  // Wait for all jobs to complete (concurrently)
  await Promise.allSettled(jobPromises);

  return {
    checked,
    executed: results.filter((r) => r.success).length,
    errors: results.filter((r) => !r.success).length,
    results,
  };
}

/**
 * Execute a single cron job by sending its skillPrompt through processMessage.
 */
async function executeCronJob(
  agentId: string,
  job: CronJobDef,
  allJobs: CronJobDef[]
): Promise<{ agentId: string; jobId: string; jobName: string; success: boolean; error?: string }> {
  try {
    const response = await processMessage(
      agentId,
      `[SCHEDULED TASK: ${job.name}] ${job.skillPrompt}`,
      [] // no conversation history for cron jobs
    );

    // Update lastRun in the agent's cronJobs JSON
    const updated = allJobs.map((j) =>
      j.id === job.id
        ? { ...j, lastRun: new Date().toISOString(), lastResult: response.slice(0, 200) }
        : j
    );
    await prisma.agent.update({
      where: { id: agentId },
      data: { cronJobs: JSON.stringify(updated) },
    });

    // Log success
    await prisma.activityLog.create({
      data: {
        agentId,
        type: "action",
        message: `⏰ Cron "${job.name}" executed`,
        metadata: JSON.stringify({
          jobId: job.id,
          prompt: job.skillPrompt.slice(0, 100),
          responseLength: response.length,
        }),
      },
    });

    return { agentId, jobId: job.id, jobName: job.name, success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    await prisma.activityLog.create({
      data: {
        agentId,
        type: "error",
        message: `⏰ Cron "${job.name}" failed: ${msg.slice(0, 200)}`,
      },
    });

    return { agentId, jobId: job.id, jobName: job.name, success: false, error: msg };
  }
}

// ─── Cron Job CRUD ──────────────────────────────────────────────────────────

export async function getCronJobs(agentId: string): Promise<CronJobDef[]> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { cronJobs: true },
  });
  if (!agent?.cronJobs) return [];
  try {
    return JSON.parse(agent.cronJobs) as CronJobDef[];
  } catch {
    return [];
  }
}

export async function saveCronJobs(agentId: string, jobs: CronJobDef[]): Promise<void> {
  await prisma.agent.update({
    where: { id: agentId },
    data: { cronJobs: JSON.stringify(jobs) },
  });
}

/**
 * Default cron jobs for each template type.
 */
export function getDefaultCronJobs(templateType: string): Omit<CronJobDef, "id" | "agentId" | "lastRun" | "lastResult">[] {
  switch (templateType) {
    case "forex":
      return [
        { name: "Rate Monitor", cron: "*/5 * * * *", skillPrompt: "Check all current CELO exchange rates. If any rate has moved more than 2% from the last check, report it.", enabled: true },
        { name: "Portfolio Report", cron: "0 * * * *", skillPrompt: "Generate a portfolio status report showing current holdings and their USD values.", enabled: true },
        { name: "Daily Market Summary", cron: "0 9 * * *", skillPrompt: "Generate a comprehensive daily market analysis for all Mento stablecoin pairs.", enabled: false },
      ];
    case "trading":
      return [
        { name: "Price Check", cron: "*/10 * * * *", skillPrompt: "Check current exchange rates for all configured trading pairs.", enabled: true },
        { name: "Portfolio Rebalance", cron: "0 */4 * * *", skillPrompt: "Analyze current portfolio allocation and suggest rebalancing.", enabled: false },
      ];
    case "payment":
      return [
        { name: "Balance Alert", cron: "0 */6 * * *", skillPrompt: "Check the agent wallet balance and report if any token is running low.", enabled: false },
      ];
    default:
      return [];
  }
}

