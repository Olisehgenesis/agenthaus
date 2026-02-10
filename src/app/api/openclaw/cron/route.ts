/**
 * OpenClaw Cron Proxy
 *
 * POST /api/openclaw/cron
 *
 * OpenClaw Gateway can call this endpoint on a schedule to trigger
 * cron jobs for all agents. This is an alternative to the existing
 * /api/cron/tick endpoint — they do the same thing but this one
 * accepts OpenClaw's auth format.
 *
 * Also supports:
 * - POST with { agentId, prompt } to run a one-off skill prompt for an agent
 *   (e.g. OpenClaw's scheduled messages feature)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tickCronJobs } from "@/lib/channels/scheduler";
import { processMessage } from "@/lib/openclaw/manager";

const WEBHOOK_SECRET = process.env.OPENCLAW_WEBHOOK_SECRET || "";

export async function POST(request: Request) {
  try {
    // Auth
    if (WEBHOOK_SECRET) {
      const auth =
        request.headers.get("authorization")?.replace("Bearer ", "") ||
        request.headers.get("x-openclaw-secret");

      if (auth !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    // Mode 1: One-off agent prompt (from OpenClaw scheduled message)
    if (body.agentId && body.prompt) {
      const agentId = body.agentId as string;
      const prompt = body.prompt as string;

      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { id: true, status: true, name: true },
      });

      if (!agent || agent.status !== "active") {
        return NextResponse.json(
          { error: "Agent not found or not active" },
          { status: 404 }
        );
      }

      const response = await processMessage(agentId, prompt);

      await prisma.activityLog.create({
        data: {
          agentId,
          type: "action",
          message: `⏰ OpenClaw cron: "${prompt.slice(0, 60)}"`,
          metadata: JSON.stringify({
            source: "openclaw-cron",
            prompt: prompt.slice(0, 200),
            response: response.slice(0, 200),
          }),
        },
      });

      return NextResponse.json({
        ok: true,
        agentId,
        agentName: agent.name,
        response,
      });
    }

    // Mode 2: Global cron tick (same as /api/cron/tick)
    const result = await tickCronJobs();

    return NextResponse.json({
      ok: true,
      source: "openclaw",
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("OpenClaw cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 }
    );
  }
}

