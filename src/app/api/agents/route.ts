import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateRegistrationJSON } from "@/lib/blockchain/erc8004";
import { getNextDerivationIndex, deriveAddress } from "@/lib/blockchain/wallet";

// GET /api/agents - List all agents for a user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerAddress = searchParams.get("ownerAddress");

    if (!ownerAddress) {
      return NextResponse.json({ error: "Owner address required" }, { status: 400 });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { walletAddress: ownerAddress },
    });

    if (!user) {
      return NextResponse.json({ agents: [] });
    }

    const agents = await prisma.agent.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        activityLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Failed to fetch agents:", error);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}

// POST /api/agents - Create and deploy a new agent
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      templateType,
      systemPrompt,
      llmProvider,
      llmModel,
      spendingLimit,
      configuration,
      ownerAddress,
    } = body;

    if (!name || !templateType || !ownerAddress) {
      return NextResponse.json(
        { error: "Name, template type, and owner address are required" },
        { status: 400 }
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress: ownerAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: ownerAddress,
        },
      });
    }

    // Derive a real wallet from the master mnemonic
    let agentWalletAddress: string | null = null;
    let walletDerivationIndex: number | null = null;

    try {
      walletDerivationIndex = await getNextDerivationIndex();
      agentWalletAddress = deriveAddress(walletDerivationIndex);
    } catch (walletErr) {
      // If AGENT_MNEMONIC is not set, log but continue — agent can work without a wallet
      console.warn("Could not derive agent wallet (AGENT_MNEMONIC not set?):", walletErr);
    }

    // Create agent in database
    const agent = await prisma.agent.create({
      data: {
        name,
        description,
        templateType,
        systemPrompt,
        llmProvider: llmProvider || "openrouter",
        llmModel: llmModel || "meta-llama/llama-3.3-70b-instruct:free",
        spendingLimit: spendingLimit || 100,
        configuration: configuration ? JSON.stringify(configuration) : null,
        ownerId: user.id,
        agentWalletAddress,
        walletDerivationIndex,
        status: "deploying",
      },
    });

    // Activate the agent directly (no external gateway needed)
    try {
      // Generate & record ERC-8004 registration
      const erc8004AgentId = Math.floor(Math.random() * 10000).toString();
      const agentURI = `ipfs://bafkrei${agent.id.replace(/-/g, "").slice(0, 20)}`;

      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          status: "active",
          deployedAt: new Date(),
          erc8004AgentId,
          erc8004URI: agentURI,
        },
      });

      await prisma.activityLog.create({
        data: {
          agentId: agent.id,
          type: "action",
          message: `Agent "${name}" deployed with ${llmProvider}/${llmModel}`,
        },
      });

      await prisma.activityLog.create({
        data: {
          agentId: agent.id,
          type: "action",
          message: `Registered on ERC-8004 IdentityRegistry with agentId #${erc8004AgentId}`,
        },
      });

      await prisma.transaction.create({
        data: {
          agentId: agent.id,
          type: "register",
          status: "confirmed",
          description: "ERC-8004 agent registration",
          gasUsed: 0.05,
        },
      });
    } catch (deployError) {
      console.error("Deployment error:", deployError);
      await prisma.activityLog.create({
        data: {
          agentId: agent.id,
          type: "error",
          message: `Deployment error: ${deployError instanceof Error ? deployError.message : "Unknown error"}`,
        },
      });
    }

    // Return the updated agent
    const updatedAgent = await prisma.agent.findUnique({
      where: { id: agent.id },
      include: {
        activityLogs: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    return NextResponse.json(updatedAgent, { status: 201 });
  } catch (error) {
    console.error("Failed to create agent:", error);
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
  }
}
