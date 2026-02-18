import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { get8004ScanAgentUrl, getERC8004ScanUrl } from "@/lib/constants";

const MAX_LIMIT = 50;

/**
 * Public, read-only list of agents.
 *
 * Privacy rules:
 * - No owner wallets or user info
 * - No verification details (SelfClaw / Self.xyz)
 * - No raw messages or activity log messages
 * - Only aggregate metrics and on-chain-safe fields
 *
 * Query params:
 * - status: filter by agent.status (default: "active", use "all" for no filter)
 * - erc8004Only: "true" to require erc8004AgentId != null
 * - limit: 1–50 (default: 20)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") || "active";
    const erc8004Only = searchParams.get("erc8004Only") === "true";

    const limitParam = parseInt(searchParams.get("limit") || "20", 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
      : 20;

    const where: Record<string, unknown> = {};
    if (status !== "all") {
      where.status = status;
    }
    if (erc8004Only) {
      where.erc8004AgentId = { not: null };
    }

    const agents = await prisma.agent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            createdAt: true,
          },
        },
        _count: {
          select: {
            transactions: true,
            activityLogs: true,
          },
        },
      },
    });

    const sanitized = agents.map((agent) => {
      const chainId = agent.erc8004ChainId ?? 42220;
      const hasErc8004 = !!agent.erc8004AgentId;

      return {
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
          // This is the agent's on-chain wallet used in ERC-8004 metadata / SelfClaw,
          // not the human owner's wallet address.
          agentWalletAddress: agent.agentWalletAddress,
          chainId,
        },
        erc8004: hasErc8004
          ? {
              agentId: agent.erc8004AgentId,
              chainId,
              uri: agent.erc8004URI,
              // Block explorer NFT view (IdentityRegistry token)
              scanUrl: getERC8004ScanUrl(chainId, agent.erc8004AgentId!),
              // 8004scan agent page (score, feedback, etc.)
              agentPageUrl: get8004ScanAgentUrl(chainId, agent.erc8004AgentId!),
            }
          : null,
        metrics: {
          transactionCount: agent._count.transactions,
          lastTransactionAt:
            agent.transactions.length > 0
              ? agent.transactions[0]?.createdAt
              : null,
          activityCount: agent._count.activityLogs,
        },
      };
    });

    return NextResponse.json({ agents: sanitized });
  } catch (error) {
    console.error("Failed to fetch public agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}

