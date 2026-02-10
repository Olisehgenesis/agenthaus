import { NextRequest, NextResponse } from "next/server";
import {
  listCronJobs,
  addCronJob,
  removeCronJob,
  toggleCronJob,
  runCronJob,
} from "@/lib/openclaw/gateway-client";

/**
 * GET /api/openclaw/cron
 *
 * List all scheduled cron jobs.
 */
export async function GET() {
  try {
    const jobs = await listCronJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    return NextResponse.json(
      { jobs: [], error: error instanceof Error ? error.message : "Failed to list cron jobs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/openclaw/cron
 *
 * Create a new cron job or perform an action on an existing one.
 *
 * Create body:
 *   {
 *     name: "Daily report",
 *     message: "Generate a summary of all transactions today",
 *     every: "24h",          // OR cron: "0 9 * * *", OR at: "+30m"
 *     agentId: "main",       // OpenClaw agent id
 *     channel: "telegram",   // delivery channel
 *     to: "732186130",       // delivery target (chatId)
 *     announce: true
 *   }
 *
 * Action body:
 *   { action: "toggle", jobId: "abc123", enabled: true }
 *   { action: "run", jobId: "abc123" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle actions on existing jobs
    if (body.action === "toggle" && body.jobId) {
      const result = await toggleCronJob(body.jobId, body.enabled ?? true);
      return NextResponse.json(result);
    }

    if (body.action === "run" && body.jobId) {
      const result = await runCronJob(body.jobId);
      return NextResponse.json(result);
    }

    // Create new job
    const { name, message, cron, every, at, agentId, channel, to, announce } = body;

    if (!name || !message) {
      return NextResponse.json(
        { error: "name and message are required" },
        { status: 400 }
      );
    }

    if (!cron && !every && !at) {
      return NextResponse.json(
        { error: "One of cron, every, or at is required for scheduling" },
        { status: 400 }
      );
    }

    const result = await addCronJob({
      name,
      message,
      cron,
      every,
      at,
      agentId,
      channel,
      to,
      announce,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to manage cron job" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/openclaw/cron
 *
 * Remove a cron job.
 * Body: { jobId: "abc123" }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const result = await removeCronJob(jobId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to remove cron job" },
      { status: 500 }
    );
  }
}

