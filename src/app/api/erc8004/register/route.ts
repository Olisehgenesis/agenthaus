import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateRegistrationJSON } from "@/lib/blockchain/erc8004";
import { uploadJsonToIPFS, isPinataConfigured } from "@/lib/ipfs";
import { ERC8004_CONTRACTS, DEPLOYMENT_URL, getTemplateDescription } from "@/lib/constants";
import { syncErc8004ToSelfClaw } from "@/lib/selfclaw/agentActions";

/**
 * GET /api/erc8004/register?agentId=...&chainId=...
 *
 * 1. Fetches agent (image must already be uploaded → agent.imageUrl has URL)
 * 2. Builds registration JSON with image URL from step 1
 * 3. Uploads JSON to IPFS via Pinata → returns ipfs:// agentURI
 * Requires PINATA_JWT. Image must be saved before this runs.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const chainId = parseInt(searchParams.get("chainId") || "42220", 10);

    if (!agentId) {
      return NextResponse.json({ error: "agentId query param required" }, { status: 400 });
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
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

    if (agent.erc8004AgentId) {
      return NextResponse.json({
        error: "Agent is already registered on-chain",
        erc8004AgentId: agent.erc8004AgentId,
      }, { status: 409 });
    }

    // Always use production URL for published metadata (8004scan, ERC-8004)
    const appUrl = DEPLOYMENT_URL;
    const serviceUrl = `${appUrl}/api/agents/${agent.id}/chat`;

    const config = (agent.configuration ? JSON.parse(agent.configuration) : {}) as { webUrl?: string; contactEmail?: string };
    const registrationJSON = generateRegistrationJSON({
      name: agent.name,
      description: agent.description || getTemplateDescription(agent.templateType),
      imageUrl: agent.imageUrl,
      appUrl,
      agentId: agent.id,
      serviceUrl,
      agentWalletAddress: agent.agentWalletAddress,
      chainId: agent.erc8004ChainId || chainId,
      erc8004AgentId: null,
      templateType: agent.templateType,
      status: agent.status,
      webUrl: config.webUrl || null,
      contactEmail: config.contactEmail || null,
    });

    if (!isPinataConfigured()) {
      return NextResponse.json(
        { error: "Pinata (IPFS) required for ERC-8004 registration. Set PINATA_JWT in .env" },
        { status: 503 }
      );
    }

    const agentURI = await uploadJsonToIPFS(registrationJSON);

    return NextResponse.json({
      agentURI,
      registrationJSON,
      contracts: ERC8004_CONTRACTS,
    });
  } catch (error) {
    console.error("Failed to prepare registration:", error);
    return NextResponse.json({ error: "Failed to prepare registration" }, { status: 500 });
  }
}

/**
 * POST /api/erc8004/register
 *
 * Called by the client AFTER the on-chain transaction succeeds.
 * Records the on-chain data in the database.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, erc8004AgentId, erc8004TxHash, erc8004ChainId, erc8004URI } = body;

    if (!agentId || !erc8004AgentId || !erc8004TxHash) {
      return NextResponse.json(
        { error: "agentId, erc8004AgentId, and erc8004TxHash are required" },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Update agent with real on-chain data
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        erc8004AgentId: String(erc8004AgentId),
        erc8004TxHash,
        erc8004ChainId: erc8004ChainId ? Number(erc8004ChainId) : null,
        erc8004URI: erc8004URI || null,
      },
    });

    // Log
    await prisma.activityLog.create({
      data: {
        agentId,
        type: "action",
        message: `Registered on ERC-8004 IdentityRegistry — on-chain agentId #${erc8004AgentId}`,
        metadata: JSON.stringify({ txHash: erc8004TxHash, chainId: erc8004ChainId }),
      },
    });

    // Record registration tx
    await prisma.transaction.create({
      data: {
        agentId,
        type: "register",
        status: "confirmed",
        txHash: erc8004TxHash,
        description: `ERC-8004 registration (agentId #${erc8004AgentId})`,
      },
    });

    // Sync to SelfClaw so sponsorship works (updates verifiedBots.metadata.erc8004TokenId)
    syncErc8004ToSelfClaw(agentId, erc8004TxHash).catch((err) =>
      console.warn("[erc8004] SelfClaw sync failed (non-blocking):", err)
    );

    return NextResponse.json({
      success: true,
      erc8004AgentId: String(erc8004AgentId),
      erc8004TxHash,
    });
  } catch (error) {
    console.error("Failed to record registration:", error);
    return NextResponse.json({ error: "Failed to record registration" }, { status: 500 });
  }
}
