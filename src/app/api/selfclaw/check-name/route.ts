/**
 * GET /api/selfclaw/check-name?name=xxx
 *
 * Check if an agent name is available on SelfClaw.
 * Used when creating/editing agents to avoid "Agent name already taken".
 */

import { NextResponse } from "next/server";
import { checkAgentNameAvailable } from "@/lib/selfclaw/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name?.trim()) {
      return NextResponse.json({ available: true });
    }

    const result = await checkAgentNameAvailable(name.trim());
    return NextResponse.json(result);
  } catch (error) {
    console.error("check-name error:", error);
    return NextResponse.json({ available: true }); // Assume available on error
  }
}
