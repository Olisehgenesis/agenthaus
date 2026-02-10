import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/analytics?ownerAddress=0x...
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
        metrics: {
          totalValueTransferred: 0,
          totalTransactions: 0,
          successRate: 0,
          totalGasSpent: 0,
          avgResponseTime: 0,
          avgReputation: 0,
        },
        dailyData: [],
        agentPerformance: [],
      });
    }

    const agents = await prisma.agent.findMany({
      where: { ownerId: user.id },
      include: { transactions: true },
    });

    const allTransactions = agents.flatMap((a) => a.transactions);
    const totalTransactions = allTransactions.length;
    const confirmedCount = allTransactions.filter((t) => t.status === "confirmed").length;
    const totalValueTransferred = allTransactions.reduce((s, t) => s + (t.amount || 0), 0);
    const totalGasSpent = allTransactions.reduce((s, t) => s + (t.gasUsed || 0), 0);
    const successRate = totalTransactions > 0 ? (confirmedCount / totalTransactions) * 100 : 0;

    const agentsWithRep = agents.filter((a) => a.reputationScore > 0);
    const avgReputation =
      agentsWithRep.length > 0
        ? agentsWithRep.reduce((s, a) => s + a.reputationScore, 0) / agentsWithRep.length
        : 0;

    // Build daily transaction data for the last 7 days
    const now = new Date();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dailyData = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayTxns = allTransactions.filter((t) => {
        const txDate = new Date(t.createdAt);
        return txDate >= dayStart && txDate < dayEnd;
      });

      dailyData.push({
        day: dayNames[dayStart.getDay()],
        date: dayStart.toISOString().split("T")[0],
        transactions: dayTxns.length,
        volume: Math.round(dayTxns.reduce((s, t) => s + (t.amount || 0), 0) * 100) / 100,
      });
    }

    // Agent performance breakdown
    const agentPerformance = agents.map((a) => ({
      id: a.id,
      name: a.name,
      templateType: a.templateType,
      transactions: a.transactions.length,
      volume: Math.round(a.transactions.reduce((s, t) => s + (t.amount || 0), 0) * 100) / 100,
      reputation: a.reputationScore,
      gasSpent: Math.round(a.transactions.reduce((s, t) => s + (t.gasUsed || 0), 0) * 1000) / 1000,
    }));

    return NextResponse.json({
      metrics: {
        totalValueTransferred: Math.round(totalValueTransferred * 100) / 100,
        totalTransactions,
        successRate: Math.round(successRate * 10) / 10,
        totalGasSpent: Math.round(totalGasSpent * 1000) / 1000,
        avgReputation: Math.round(avgReputation * 10) / 10,
      },
      dailyData,
      agentPerformance,
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}

