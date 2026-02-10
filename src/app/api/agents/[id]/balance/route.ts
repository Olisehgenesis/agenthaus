import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWalletBalance } from "@/lib/blockchain/wallet";
import { type Address } from "viem";

/**
 * GET /api/agents/:id/balance
 * Returns the on-chain CELO + token balances for this agent's wallet.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      select: {
        agentWalletAddress: true,
        walletDerivationIndex: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (!agent.agentWalletAddress) {
      return NextResponse.json(
        {
          error: "Agent has no wallet. AGENT_MNEMONIC may not be configured.",
          address: null,
          balances: null,
        },
        { status: 404 }
      );
    }

    const balance = await getWalletBalance(agent.agentWalletAddress as Address);

    return NextResponse.json({
      ...balance,
      derivationIndex: agent.walletDerivationIndex,
    });
  } catch (error) {
    console.error("Failed to fetch wallet balance:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch balance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

