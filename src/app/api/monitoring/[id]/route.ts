import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/monitoring/:id - Get monitoring data for an agent
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";

    const agent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get date range based on period
    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case "24h":
        startDate.setHours(startDate.getHours() - 24);
        break;
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Get transactions for the period
    const transactions = await prisma.transaction.findMany({
      where: {
        agentId: id,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get activity logs for the period
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        agentId: id,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate metrics
    const totalTransactions = transactions.length;
    const confirmedTransactions = transactions.filter((t) => t.status === "confirmed").length;
    const failedTransactions = transactions.filter((t) => t.status === "failed").length;
    const totalVolume = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalGas = transactions.reduce((sum, t) => sum + (t.gasUsed || 0), 0);
    const successRate = totalTransactions > 0 ? (confirmedTransactions / totalTransactions) * 100 : 0;

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        reputationScore: agent.reputationScore,
        spendingUsed: agent.spendingUsed,
        spendingLimit: agent.spendingLimit,
      },
      metrics: {
        totalTransactions,
        confirmedTransactions,
        failedTransactions,
        totalVolume,
        totalGas,
        successRate,
      },
      transactions,
      activityLogs,
      period,
    });
  } catch (error) {
    console.error("Failed to fetch monitoring data:", error);
    return NextResponse.json({ error: "Failed to fetch monitoring data" }, { status: 500 });
  }
}

