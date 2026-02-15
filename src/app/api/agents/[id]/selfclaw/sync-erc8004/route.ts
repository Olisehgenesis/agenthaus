import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncErc8004ToSelfClaw } from "@/lib/selfclaw/agentActions";

/**
 * POST /api/agents/:id/selfclaw/sync-erc8004
 *
 * Sync existing ERC-8004 registration to SelfClaw (for agents registered before
 * auto-sync was added). Uses agent's stored erc8004TxHash. Required for sponsorship.
 * Only agent owner can call.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const walletAddress = body.walletAddress as string | undefined;

    const agent = await prisma.agent.findUnique({
      where: { id },
      select: {
        erc8004TxHash: true,
        erc8004AgentId: true,
        owner: { select: { walletAddress: true } },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (!agent.erc8004TxHash || !agent.erc8004AgentId) {
      return NextResponse.json(
        { error: "Agent has no ERC-8004 registration. Register on-chain first." },
        { status: 400 }
      );
    }

    const ownerWallet = agent.owner?.walletAddress?.toLowerCase();
    if (!walletAddress || ownerWallet !== String(walletAddress).toLowerCase()) {
      return NextResponse.json(
        { error: "Only the agent owner can sync" },
        { status: 403 }
      );
    }

    const result = await syncErc8004ToSelfClaw(id, agent.erc8004TxHash);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "ERC-8004 synced to SelfClaw. Sponsorship should now work.",
      });
    }

    return NextResponse.json(
      { success: false, error: result.error ?? "Sync failed" },
      { status: 422 }
    );
  } catch (error) {
    console.error("sync-erc8004 error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
