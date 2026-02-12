import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateRegistrationJSON } from "@/lib/blockchain/erc8004";
import { DEPLOYMENT_URL, getTemplateDescription } from "@/lib/constants";

/**
 * GET /api/agents/[id]/registration.json
 *
 * Serves the ERC-8004 registration JSON for an agent.
 * This URL is what gets set as the `agentURI` on the IdentityRegistry.
 *
 * The JSON follows the ERC-8004 spec's recommended registration file shape:
 * - type, name, description, image
 * - services (endpoints like chat API)
 * - registrations (on-chain identity references)
 * - supportedTrust
 *
 * @see https://github.com/erc-8004/erc-8004-contracts#agent-registration-file-recommended-shape
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
      chainId: agent.erc8004ChainId || 42220,
      erc8004AgentId: agent.erc8004AgentId,
      templateType: agent.templateType,
      status: agent.status,
      webUrl: config.webUrl || null,
      contactEmail: config.contactEmail || null,
    });

    return new NextResponse(JSON.stringify(registrationJSON, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Failed to serve registration JSON:", error);
    return NextResponse.json(
      { error: "Failed to generate registration JSON" },
      { status: 500 }
    );
  }
}

