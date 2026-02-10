import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateRegistrationJSON } from "@/lib/blockchain/erc8004";
import { startAgent } from "@/lib/openclaw/manager";

// POST /api/agents/:id/deploy - Deploy an agent via OpenClaw
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
        message: "Deployment initiated — starting OpenClaw runtime & ERC-8004 registration",
        metadata: JSON.stringify(registrationJSON),
      },
    });

    // Update agent status to deploying
    await prisma.agent.update({
      where: { id },
      data: { status: "deploying" },
    });

    // Start OpenClaw runtime for the agent
    const instance = await startAgent(agent.id);

    // Generate ERC-8004 on-chain registration data
    // The agentId would come from the on-chain tx receipt in production
    const erc8004AgentId = Math.floor(Math.random() * 10000).toString();
    const agentURI = `ipfs://bafkrei${agent.id.replace(/-/g, "").slice(0, 20)}`;

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
        message: `Registered on ERC-8004 IdentityRegistry with agentId #${erc8004AgentId}`,
      },
    });

    // Record registration transaction
    await prisma.transaction.create({
      data: {
        agentId: agent.id,
        type: "register",
        status: "confirmed",
        description: "ERC-8004 IdentityRegistry registration",
        gasUsed: 0.05,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Agent deployed via OpenClaw with ERC-8004 registration",
      registrationJSON,
      openclawInstance: {
        status: instance.status,
        port: instance.port,
        llmProvider: instance.config.agent.llmProvider,
        llmModel: instance.config.agent.llmModel,
      },
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
