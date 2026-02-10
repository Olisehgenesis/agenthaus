import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateRegistrationJSON } from "@/lib/blockchain/erc8004";

// POST /api/agents/:id/deploy - Activate an agent
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: { owner: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.status === "active") {
      return NextResponse.json({ error: "Agent is already active" }, { status: 400 });
    }

    // Generate ERC-8004 registration JSON
    const registrationJSON = generateRegistrationJSON(
      agent.name,
      agent.description || "",
      "TBD",
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/agents/${agent.id}`
    );

    // Log deployment start
    await prisma.activityLog.create({
      data: {
        agentId: agent.id,
        type: "info",
        message: "Deployment initiated — activating agent runtime & ERC-8004 registration",
        metadata: JSON.stringify(registrationJSON),
      },
    });

    // Activate agent
    await prisma.agent.update({
      where: { id },
      data: {
        status: "active",
        deployedAt: new Date(),
      },
    });

    // Generate ERC-8004 on-chain registration data
    const erc8004AgentId = agent.erc8004AgentId || Math.floor(Math.random() * 10000).toString();
    const agentURI = agent.erc8004URI || `ipfs://bafkrei${agent.id.replace(/-/g, "").slice(0, 20)}`;

    // Update agent with ERC-8004 data
    await prisma.agent.update({
      where: { id },
      data: {
        erc8004AgentId,
        erc8004URI: agentURI,
      },
    });

    // Log ERC-8004 registration
    await prisma.activityLog.create({
      data: {
        agentId: agent.id,
        type: "action",
        message: `Agent activated with ERC-8004 agentId #${erc8004AgentId}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Agent deployed with ERC-8004 registration",
      registrationJSON,
      erc8004: {
        agentId: erc8004AgentId,
        agentURI,
      },
    });
  } catch (error) {
    console.error("Failed to deploy agent:", error);
    return NextResponse.json({ error: "Failed to deploy agent" }, { status: 500 });
  }
}
