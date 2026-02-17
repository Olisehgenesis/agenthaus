import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const usersCount = await prisma.user.count();
    const totalAgents = await prisma.agent.count();
    const deployedAgents = await prisma.agent.count({
      where: {
        OR: [
          { deployedAt: { not: null } },
          { erc8004AgentId: { not: null } },
        ],
      },
    });
    const activeAgents = await prisma.agent.count({
      where: { status: "active" },
    });
    let verifiedAgents = 0;
    try {
      verifiedAgents = await prisma.agentVerification.count({
        where: {
          OR: [{ selfxyzVerified: true }, { status: "verified" }],
        },
      });
    } catch {
      // Some environments may not have AgentVerification table yet.
      verifiedAgents = 0;
    }


    // Sum tokens deployed stored as JSON string in agentDeployedTokens
    const agentsWithTokens = await prisma.agent.findMany({
      select: { agentDeployedTokens: true },
    });
    let tokensDeployed = 0;
    for (const a of agentsWithTokens) {
      try {
        if (a.agentDeployedTokens) {
          const arr = JSON.parse(a.agentDeployedTokens);
          if (Array.isArray(arr)) tokensDeployed += arr.length;
        }
      } catch {
        // ignore parse errors
      }
    }

    const transactionsCount = await prisma.transaction.count();
    const volumeAgg = await prisma.transaction.aggregate({ _sum: { amount: true } });
    const totalVolume = volumeAgg._sum.amount ?? 0;
    const deploymentRate = totalAgents > 0 ? (deployedAgents / totalAgents) * 100 : 0;
    const activeRate = totalAgents > 0 ? (activeAgents / totalAgents) * 100 : 0;
    const averageAgentsPerUser = usersCount > 0 ? totalAgents / usersCount : 0;
    const transactionsPerAgent = totalAgents > 0 ? transactionsCount / totalAgents : 0;

    return NextResponse.json({
      uniqueUsers: usersCount,
      agentsTotal: totalAgents,
      agentsDeployed: deployedAgents,
      activeAgents,
      verifiedAgents,
      tokensDeployed,
      transactionsCount,
      totalVolume,
      deploymentRate,
      activeRate,
      averageAgentsPerUser,
      transactionsPerAgent,
    });
  } catch (error) {
    console.error("Failed to compute analytics stats:", error);
    return NextResponse.json({ error: "Failed to compute stats" }, { status: 500 });
  }
}
