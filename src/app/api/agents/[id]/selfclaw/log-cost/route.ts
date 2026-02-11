import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptPrivateKey } from "@/lib/selfclaw/keys";
import { logCost, signAuthenticatedPayload } from "@/lib/selfclaw/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  try {
    const body = await request.json();
    const { amount, currency = "USD", category, description } = body;

    if (!amount || !category) {
      return NextResponse.json(
        { error: "amount and category are required" },
        { status: 400 }
      );
    }

    const verification = await prisma.agentVerification.findUnique({
      where: { agentId },
      select: { publicKey: true, encryptedPrivateKey: true, selfxyzVerified: true },
    });

    if (!verification?.encryptedPrivateKey || !verification.selfxyzVerified) {
      return NextResponse.json(
        { error: "Agent must be SelfClaw verified" },
        { status: 400 }
      );
    }

    const privateKeyHex = decryptPrivateKey(verification.encryptedPrivateKey);
    const signed = await signAuthenticatedPayload(verification.publicKey, privateKeyHex);

    await logCost(signed, String(amount), currency, category, description);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SelfClaw log-cost failed:", error);
    const msg = error instanceof Error ? error.message : "Failed to log cost";
    const isKeyError = msg.includes("could not be decrypted") || msg.includes("re-verify");
    return NextResponse.json({ error: msg }, { status: isKeyError ? 400 : 500 });
  }
}