import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptPrivateKey } from "@/lib/selfclaw/keys";
import { createWallet as createWalletSelfClaw, signAuthenticatedPayload } from "@/lib/selfclaw/client";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  try {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        agentWalletAddress: true,
        verification: {
          select: { publicKey: true, encryptedPrivateKey: true, selfxyzVerified: true },
        },
      },
    });

    if (!agent?.verification?.encryptedPrivateKey) {
      return NextResponse.json(
        { error: "Agent must be SelfClaw verified first" },
        { status: 400 }
      );
    }
    if (!agent.verification.selfxyzVerified) {
      return NextResponse.json(
        { error: "Complete Self passport verification first" },
        { status: 400 }
      );
    }
    if (!agent.agentWalletAddress) {
      return NextResponse.json(
        { error: "Agent has no wallet. Initialize wallet first." },
        { status: 400 }
      );
    }

    const privateKeyHex = decryptPrivateKey(agent.verification.encryptedPrivateKey);
    const signed = await signAuthenticatedPayload(agent.verification.publicKey, privateKeyHex);

    await createWalletSelfClaw(signed, agent.agentWalletAddress, "celo");

    return NextResponse.json({ success: true, walletAddress: agent.agentWalletAddress });
  } catch (error) {
    console.error("SelfClaw create-wallet failed:", error);
    const msg = error instanceof Error ? error.message : "Failed to register wallet";
    const isKeyError = msg.includes("could not be decrypted") || msg.includes("re-verify");
    return NextResponse.json({ error: msg }, { status: isKeyError ? 400 : 500 });
  }
}
