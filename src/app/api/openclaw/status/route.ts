import { NextResponse } from "next/server";
import {
  getGatewayStatus,
  listChannels,
  listCronJobs,
  getGatewayServiceStatus,
} from "@/lib/openclaw/gateway-client";

/**
 * GET /api/openclaw/status
 *
 * Returns full OpenClaw gateway status including channels, sessions, cron.
 */
export async function GET() {
  try {
    const [status, channels, cronJobs, service] = await Promise.all([
      getGatewayStatus(),
      listChannels(),
      listCronJobs(),
      getGatewayServiceStatus(),
    ]);

    return NextResponse.json({
      gateway: {
        running: status.running,
        port: status.port,
        version: status.version,
        service,
      },
      channels,
      agents: status.agents,
      sessions: status.sessions,
      cronJobs,
    });
  } catch (error) {
    console.error("OpenClaw status error:", error);
    return NextResponse.json(
      {
        gateway: { running: false, port: 18789, version: "unknown" },
        channels: [],
        agents: [],
        sessions: [],
        cronJobs: [],
        error: error instanceof Error ? error.message : "Failed to get status",
      },
      { status: 200 } // Return 200 even on error — the UI handles the "not running" state
    );
  }
}

