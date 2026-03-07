import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const MAX_LIMIT = 1000;

// GET /api/v1/getAgents - Admin/public endpoint returning agents with owner wallets
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get("limit") || "200", 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
      : 200;

    const agents = await prisma.agent.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        owner: {
          select: {
            id: true,
            walletAddress: true,
            createdAt: true,
          },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            txHash: true,
            type: true,
            status: true,
            fromAddress: true,
            toAddress: true,
            amount: true,
            currency: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            transactions: true,
            activityLogs: true,
            channelBindings: true,
          },
        },
        channelBindings: {
          select: {
            id: true,
            channelType: true,
            senderIdentifier: true,
            senderName: true,
            chatIdentifier: true,
            bindingType: true,
            isActive: true,
            pairedAt: true,
            lastMessageAt: true,
          },
        },
        verification: {
          select: {
            publicKey: true,
            status: true,
            selfxyzVerified: true,
            agentName: true,
            swarmUrl: true,
            verifiedAt: true,
          },
        },
      },
    });

    // Sanitize per-agent fields to avoid exposing secrets
    const sanitized = agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      templateType: a.templateType,
      status: a.status,
      systemPrompt: a.systemPrompt ? a.systemPrompt : null,
      llmProvider: a.llmProvider,
      llmModel: a.llmModel,
      spendingLimit: a.spendingLimit,
      spendingUsed: a.spendingUsed,
      agentWalletAddress: a.agentWalletAddress,
      walletDerivationIndex: a.walletDerivationIndex,
      // Channel-related non-secret fields
      hasTelegram: !!a.telegramChatIds || !!a.telegramBotToken,
      telegramChatIds: a.telegramChatIds ? JSON.parse(a.telegramChatIds) : null,
      channels: a.channels ? JSON.parse(a.channels) : null,
      cronJobs: a.cronJobs ? JSON.parse(a.cronJobs) : null,
      // ERC-8004 and reputation
      erc8004AgentId: a.erc8004AgentId,
      erc8004URI: a.erc8004URI,
      erc8004ChainId: a.erc8004ChainId,
      reputationScore: a.reputationScore,
      imageUrl: a.imageUrl,
      imageSlug: a.imageSlug,
      // Owner
      owner: a.owner
        ? {
            id: a.owner.id,
            walletAddress: a.owner.walletAddress,
            createdAt: a.owner.createdAt,
          }
        : null,
      // Counts and recent transactions
      counts: a._count,
      recentTransactions: a.transactions,
      channelBindings: a.channelBindings,
      verification: a.verification || null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      deployedAt: a.deployedAt,
    }));

    return NextResponse.json({ agents: sanitized });
  } catch (error) {
    console.error("GET /api/v1/getAgents failed:", error);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}
