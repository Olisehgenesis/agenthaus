import { NextResponse } from "next/server";
import { requestSponsorshipForAgent } from "@/lib/selfclaw/agentActions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  try {
    let tokenAmount: string | undefined;
    let tokenAddress: string | undefined;
    try {
      const body = await request.json();
      if (body?.tokenAmount && typeof body.tokenAmount === "string") tokenAmount = body.tokenAmount.trim();
      if (body?.tokenAddress && typeof body.tokenAddress === "string") tokenAddress = body.tokenAddress.trim();
    } catch {
      // no body — use defaults
    }

    const result = await requestSponsorshipForAgent(agentId, tokenAmount, tokenAddress);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to request sponsorship" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SelfClaw request-sponsorship failed:", error);
    const msg = error instanceof Error ? error.message : "Failed to request sponsorship";
    const isKeyError = msg.includes("could not be decrypted") || msg.includes("re-verify");
    return NextResponse.json(
      { error: msg },
      { status: isKeyError ? 400 : 500 }
    );
  }
}
