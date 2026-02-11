import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getReputationSummary, getERC8004Addresses } from "@/lib/blockchain/erc8004";
import { getPublicClient } from "@/lib/blockchain/wallet";
import { type Address } from "viem";

/**
 * GET /api/agents/:id/reputation/summary?clientAddresses=0x...,0x...&tag1=starred&tag2=
 * Returns on-chain reputation summary for an ERC-8004 registered agent.
 * clientAddresses is required (comma-separated) to mitigate Sybil/spam.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const { searchParams } = new URL(request.url);
    const clientAddressesStr = searchParams.get("clientAddresses");
    const tag1 = searchParams.get("tag1") || "";
    const tag2 = searchParams.get("tag2") || "";

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { erc8004AgentId: true, erc8004ChainId: true },
    });
    if (!agent?.erc8004AgentId) {
      return NextResponse.json({ count: 0, value: 0, decimals: 0 });
    }

    const addresses = getERC8004Addresses(agent.erc8004ChainId || 42220);
    if (!addresses) {
      return NextResponse.json({ count: 0, value: 0, decimals: 0 });
    }

    const clientAddresses = clientAddressesStr
      ? (clientAddressesStr.split(",").map((a) => a.trim()).filter(Boolean) as Address[])
      : [];
    if (clientAddresses.length === 0) {
      return NextResponse.json(
        { error: "clientAddresses query param required (comma-separated addresses)" },
        { status: 400 }
      );
    }

    const publicClient = getPublicClient();
    const summary = await getReputationSummary(
      publicClient,
      addresses.reputationRegistry,
      BigInt(agent.erc8004AgentId),
      clientAddresses,
      tag1,
      tag2
    );

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Reputation summary error:", error);
    return NextResponse.json({ error: "Failed to fetch reputation" }, { status: 500 });
  }
}
