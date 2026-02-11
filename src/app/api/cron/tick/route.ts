/**
 * Cron Tick Endpoint
 *
 * POST /api/cron/tick
 *
 * Called every minute to check and execute due cron jobs across all agents.
 * Trigger options:
 *   1. Vercel Cron (vercel.json)
 *   2. External cron service (cron-job.org, easycron.com)
 *   3. Client-side setInterval (fallback for dev)
 *
 * Protected by CRON_SECRET env var to prevent abuse.
 */

import { NextResponse } from "next/server";
import { tickCronJobs } from "@/lib/channels/scheduler";
import { pruneExpiredSessionMessages } from "@/lib/session-retention";

export const maxDuration = 60; // Allow up to 60s for cron processing

export async function POST(request: Request) {
  try {
    // Verify cron secret (optional — if set, require it)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const body = await request.json().catch(() => ({}));
      const providedSecret =
        authHeader?.replace("Bearer ", "") || (body as Record<string, string>).secret;

      if (providedSecret !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await tickCronJobs();

    // Prune session messages older than retention period (default 30 days)
    const prunedCount = await pruneExpiredSessionMessages();

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...result,
      sessionMessagesPruned: prunedCount,
    });
  } catch (error) {
    console.error("Cron tick error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron tick failed" },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel Cron (it uses GET by default)
export async function GET(request: Request) {
  try {
    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.replace("Bearer ", "") !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await tickCronJobs();
    const prunedCount = await pruneExpiredSessionMessages();

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...result,
      sessionMessagesPruned: prunedCount,
    });
  } catch (error) {
    console.error("Cron tick error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron tick failed" },
      { status: 500 }
    );
  }
}
