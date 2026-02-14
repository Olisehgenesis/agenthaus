/**
 * GET /api/agenthaus/registration.json
 *
 * Returns ERC-8004 registration JSON for Agent Haus (the platform).
 * Use this as agentURI when registering Agent Haus on the Identity Registry.
 *
 * Steps to register Agent Haus:
 * 1. Upload this JSON to IPFS (or host at agenthaus.space/api/agenthaus/registration.json)
 * 2. Call register(agentURI) on IdentityRegistry (Celo 42220 or 11142220)
 * 3. Set NEXT_PUBLIC_AGENT_HAUS_AGENT_ID_* in .env with the minted agentId
 *
 * @see https://github.com/erc-8004/erc-8004-contracts
 */

import { NextResponse } from "next/server";
import { DEPLOYMENT_ATTRIBUTION, DEPLOYMENT_URL } from "@/lib/constants";

const AGENT_HAUS_REGISTRATION = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "Agent Haus",
  description: `Platform for deploying and managing AI agents on Celo with ERC-8004 identity.
Create, configure, and deploy agents with on-chain reputation and SelfClaw verification.
${DEPLOYMENT_ATTRIBUTION}`,
  image: `${DEPLOYMENT_URL}/images/logo.svg`,
  services: [
    { name: "web", endpoint: DEPLOYMENT_URL },
    { name: "deployedBy", endpoint: DEPLOYMENT_URL },
  ],
  registrations: [],
  supportedTrust: ["reputation"],
  active: true,
  x402Support: false,
  updatedAt: Math.floor(Date.now() / 1000),
};

export async function GET() {
  return new NextResponse(JSON.stringify(AGENT_HAUS_REGISTRATION, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
}
