import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/dashboard/stats?ownerAddress=0x...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerAddress = searchParams.get("ownerAddress");

    if (!ownerAddress) {
      return NextResponse.json({ error: "Owner address required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress: ownerAddress },
    });

    if (!user) {
      return NextResponse.json({
        stats: {
          totalAgents: 0,
          activeAgents: 0,
          totalTransactions: 0,
          totalValueTransferred: 0,
          averageReputation: 0,
          totalGasSpent: 0,
        },
        agents: [],
        recentActivity: [],
      });
    }

    // Fetch all agents for this user
    const agents = await prisma.agent.findMany({
      where: { ownerId: user.id },
      include: {
        transactions: true,
        activityLogs: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalAgents = agents.length;
    const activeAgents = agents.filter((a) => a.status === "active").length;

    // Aggregate transaction data across all agents
    const allTransactions = agents.flatMap((a) => a.transactions);
    const totalTransactions = allTransactions.length;
    const totalValueTransferred = allTransactions.reduce(
      (sum, t) => sum + (t.amount || 0),
      0
    );
    const totalGasSpent = allTransactions.reduce(
      (sum, t) => sum + (t.gasUsed || 0),
      0
    );

    // Average reputation
    const agentsWithReputation = agents.filter((a) => a.reputationScore > 0);
    const averageReputation =
      agentsWithReputation.length > 0
        ? agentsWithReputation.reduce((sum, a) => sum + a.reputationScore, 0) /
          agentsWithReputation.length
        : 0;

    // Recent activity (merged from all agents, sorted by time)
    const recentActivity = agents
      .flatMap((a) =>
        a.activityLogs.map((log) => ({
          id: log.id,
          type: log.type,
          message: log.message,
          agentName: a.name,
          agentId: a.id,
          createdAt: log.createdAt,
        }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 15);

    // Agent summaries for the sidebar
    const agentSummaries = agents.map((a) => ({
      id: a.id,
      name: a.name,
      templateType: a.templateType,
      status: a.status,
      reputationScore: a.reputationScore,
      spendingUsed: a.spendingUsed,
      spendingLimit: a.spendingLimit,
    }));

    return NextResponse.json({
      stats: {
        totalAgents,
        activeAgents,
        totalTransactions,
        totalValueTransferred,
        averageReputation: Math.round(averageReputation * 10) / 10,
        totalGasSpent: Math.round(totalGasSpent * 1000) / 1000,
      },
      agents: agentSummaries,
      recentActivity,
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

