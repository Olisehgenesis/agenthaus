import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAgentEconomics } from "@/lib/selfclaw/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  try {
    const verification = await prisma.agentVerification.findUnique({
      where: { agentId },
      select: { publicKey: true },
    });

    if (!verification?.publicKey) {
      return NextResponse.json(
        { error: "Agent has no SelfClaw verification" },
        { status: 400 }
      );
    }

    const economics = await getAgentEconomics(verification.publicKey);
    return NextResponse.json(economics);
  } catch (error) {
    console.error("SelfClaw economics fetch failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch economics" },
      { status: 500 }
    );
  }
}
