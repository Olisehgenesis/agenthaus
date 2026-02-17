import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateRegistrationJSON } from "@/lib/blockchain/erc8004";
import { uploadJsonToIPFS, isPinataConfigured } from "@/lib/ipfs";
import { DEPLOYMENT_URL, getTemplateDescription } from "@/lib/constants";

/**
 * GET /api/agents/[id]/erc8004/update-metadata
 *
 * Prepares an on-chain metadata update:
 * 1. Fetches current agent data
 * 2. Generates new registration JSON (name, description, image, etc.)
 * 3. Uploads to IPFS via Pinata
 * 4. Returns new agentURI for the client to call setAgentURI(agentId, newURI)
 *
 * Requires: Agent must already be registered on-chain (erc8004AgentId set).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        templateType: true,
        imageUrl: true,
        status: true,
        agentWalletAddress: true,
        erc8004AgentId: true,
        erc8004ChainId: true,
        configuration: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (!agent.erc8004AgentId) {
      return NextResponse.json(
        { error: "Agent is not registered on-chain. Register first." },
        { status: 400 }
      );
    }

    if (!isPinataConfigured()) {
      return NextResponse.json(
        { error: "Pinata (IPFS) required for metadata updates. Set PINATA_JWT in .env" },
        { status: 503 }
      );
    }

    const appUrl = DEPLOYMENT_URL;
    const serviceUrl = `${appUrl}/api/agents/${agent.id}/chat`;
    const config = (agent.configuration ? JSON.parse(agent.configuration) : {}) as {
      webUrl?: string;
      contactEmail?: string;
    };

    const registrationJSON = generateRegistrationJSON({
      name: agent.name,
      description: agent.description || getTemplateDescription(agent.templateType),
      imageUrl: agent.imageUrl,
      appUrl,
      agentId: agent.id,
      serviceUrl,
      agentWalletAddress: agent.agentWalletAddress,
      chainId: agent.erc8004ChainId || 42220,
      erc8004AgentId: agent.erc8004AgentId,
      templateType: agent.templateType,
      status: agent.status,
      webUrl: config.webUrl || null,
      contactEmail: config.contactEmail || null,
    });

    const agentURI = await uploadJsonToIPFS(registrationJSON);

    return NextResponse.json({
      agentURI,
      erc8004AgentId: agent.erc8004AgentId,
      chainId: agent.erc8004ChainId || 42220,
    });
  } catch (error) {
    console.error("Failed to prepare metadata update:", error);
    return NextResponse.json(
      { error: "Failed to prepare metadata update" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/[id]/erc8004/update-metadata
 *
 * Records the new agentURI in the database after the on-chain setAgentURI tx confirms.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { erc8004URI, erc8004TxHash } = body as {
      erc8004URI: string;
      erc8004TxHash: string;
    };

    if (!erc8004URI || !erc8004TxHash) {
      return NextResponse.json(
        { error: "erc8004URI and erc8004TxHash are required" },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    await prisma.agent.update({
      where: { id },
      data: { erc8004URI },
    });

    await prisma.activityLog.create({
      data: {
        agentId: id,
        type: "action",
        message: "Updated ERC-8004 metadata URI on-chain",
        metadata: JSON.stringify({ txHash: erc8004TxHash, newURI: erc8004URI }),
      },
    });

    await prisma.transaction.create({
      data: {
        agentId: id,
        type: "register",
        status: "confirmed",
        txHash: erc8004TxHash,
        description: "ERC-8004 metadata URI update",
      },
    });

    return NextResponse.json({ success: true, erc8004URI });
  } catch (error) {
    console.error("Failed to record metadata update:", error);
    return NextResponse.json(
      { error: "Failed to record metadata update" },
      { status: 500 }
    );
  }
}
