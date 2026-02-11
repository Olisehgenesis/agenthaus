import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getERC8004Addresses } from "@/lib/blockchain/erc8004";

/**
 * POST /api/agents/:id/reputation/feedback — Submit on-chain feedback for an agent
 * Body: { value, valueDecimals?, tag1, tag2? }
 * Note: Feedback must be submitted from the client using the user's connected wallet
 * (giveFeedback from @/lib/blockchain/erc8004). This route returns metadata for the client.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const body = await request.json();
    const { value, valueDecimals = 0, tag1 = "starred", tag2 = "" } = body;

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { erc8004AgentId: true, erc8004ChainId: true, ownerId: true },
    });
    if (!agent?.erc8004AgentId) {
      return NextResponse.json(
        { error: "Agent not registered on ERC-8004" },
        { status: 400 }
      );
    }

    const chainId = agent.erc8004ChainId || 42220;
    const addresses = getERC8004Addresses(chainId);
    if (!addresses) {
      return NextResponse.json(
        { error: "ERC-8004 not deployed on this chain" },
        { status: 400 }
      );
    }

    // Client must call giveFeedback from their wallet — this route documents the flow.
    // For now return instructions. Full implementation requires client-side wagmi walletClient.
    return NextResponse.json({
      message: "Submit feedback from the client using the connected wallet. Use giveFeedback from @/lib/blockchain/erc8004 with walletClient, reputationRegistryAddress, agentId (bigint), value, valueDecimals, tag1, tag2.",
      agentId: agent.erc8004AgentId,
      chainId,
      reputationRegistry: addresses.reputationRegistry,
    });
  } catch (error) {
    console.error("Reputation feedback error:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
