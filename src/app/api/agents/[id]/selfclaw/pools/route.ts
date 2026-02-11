import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPools } from "@/lib/selfclaw/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  try {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { name: true },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const data = await getPools();
    const pools = data.pools || [];

    // Filter by agent name if we have it
    const agentPools = agent.name
      ? pools.filter(
          (p) =>
            p.agentName?.toLowerCase() === agent.name.toLowerCase()
        )
      : pools;

    return NextResponse.json({ pools: agentPools, allPools: pools });
  } catch (error) {
    console.error("SelfClaw pools fetch failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch pools" },
      { status: 500 }
    );
  }
}
