import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getNextDerivationIndex,
  deriveAddress,
  getWalletBalance,
} from "@/lib/blockchain/wallet";
import { type Address } from "viem";

/**
 * POST /api/agents/:id/wallet — Initialize a wallet for an existing agent
 * Derives a new HD wallet from the master mnemonic and assigns it.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      select: {
        id: true,
        agentWalletAddress: true,
        walletDerivationIndex: true,
        name: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Already has a wallet
    if (agent.agentWalletAddress && agent.walletDerivationIndex !== null) {
      const balance = await getWalletBalance(agent.agentWalletAddress as Address);
      return NextResponse.json({
        message: "Agent already has a wallet",
        address: agent.agentWalletAddress,
        derivationIndex: agent.walletDerivationIndex,
        balance,
      });
    }

    // Derive new wallet
    const index = await getNextDerivationIndex();
    const address = deriveAddress(index);

    // Save to DB
    await prisma.agent.update({
      where: { id },
      data: {
        agentWalletAddress: address,
        walletDerivationIndex: index,
      },
    });

    // Log
    await prisma.activityLog.create({
      data: {
        agentId: id,
        type: "action",
        message: `Wallet initialized: ${address} (HD index #${index})`,
      },
    });

    return NextResponse.json({
      message: "Wallet initialized successfully",
      address,
      derivationIndex: index,
    });
  } catch (error) {
    console.error("Failed to initialize wallet:", error);
    const msg = error instanceof Error ? error.message : "Failed to initialize wallet";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

