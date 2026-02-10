import { NextResponse } from "next/server";
import { generateRegistrationJSON } from "@/lib/blockchain/erc8004";

// POST /api/erc8004/register - Generate ERC-8004 registration data
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, agentId, serviceUrl } = body;

    if (!name) {
      return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
    }

    const registrationJSON = generateRegistrationJSON(
      name,
      description || "",
      agentId || "TBD",
      serviceUrl || `https://agentforge.celo.xyz/api/agents/${agentId}`
    );

    return NextResponse.json({
      registrationJSON,
      // In production, this would upload to IPFS and return the CID
      ipfsUri: `ipfs://bafkrei${Date.now().toString(36)}`,
    });
  } catch (error) {
    console.error("Failed to generate registration:", error);
    return NextResponse.json({ error: "Failed to generate registration" }, { status: 500 });
  }
}

