import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { get8004ScanAgentUrl, getERC8004ScanUrl } from "@/lib/constants";

const MAX_TRANSACTIONS = 50;

/**
 * Public, read-only agent detail.
 *
 * Path: /api/public/agents/:id
 *
 * Privacy rules:
 * - No owner wallets or user info
 * - No verification details (SelfClaw / Self.xyz)
 * - No raw messages or activity log messages
 * - Only aggregate metrics by default
 *
 * Query params:
 * - include=transactions  → include last N transactions (on-chain-safe)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const includeParam = searchParams.get("include") || "";
    const includeTokens = new Set(
      includeParam
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
    );

    const includeTransactions = includeTokens.has("transactions");

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        transactions: includeTransactions
          ? {
              orderBy: { createdAt: "desc" },
              take: MAX_TRANSACTIONS,
              select: {
                txHash: true,
                type: true,
                status: true,
                amount: true,
                currency: true,
                blockNumber: true,
                createdAt: true,
              },
            }
          : false,
        _count: {
          select: {
            transactions: true,
            activityLogs: true,
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const chainId = agent.erc8004ChainId ?? 42220;
    const hasErc8004 = !!agent.erc8004AgentId;

    const response = {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      templateType: agent.templateType,
      status: agent.status,
      imageUrl: agent.imageUrl,
      createdAt: agent.createdAt,
      deployedAt: agent.deployedAt,
      reputationScore: agent.reputationScore,
      deployer: {
        agentWalletAddress: agent.agentWalletAddress,
        chainId,
      },
      erc8004: hasErc8004
        ? {
            agentId: agent.erc8004AgentId,
            chainId,
            uri: agent.erc8004URI,
            scanUrl: getERC8004ScanUrl(chainId, agent.erc8004AgentId!),
            agentPageUrl: get8004ScanAgentUrl(chainId, agent.erc8004AgentId!),
          }
        : null,
      metrics: {
        transactionCount: agent._count.transactions,
        activityCount: agent._count.activityLogs,
      },
      // Optional: last N transactions (on-chain-visible data only)
      transactions: includeTransactions ? agent.transactions : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch public agent detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent" },
      { status: 500 }
    );
  }
}

