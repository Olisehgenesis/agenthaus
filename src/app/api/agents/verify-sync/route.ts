/**
 * POST /api/agents/verify-sync
 *
 * Re-checks SelfClaw API for all agents belonging to the owner and updates
 * local DB when SelfClaw reports verified. Handles agents verified via
 * another device/session where our DB may be out of sync.
 *
 * Body: { ownerAddress: string }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkAgentStatus } from "@/lib/selfclaw/client";
import { decryptPrivateKey } from "@/lib/selfclaw/keys";
import {
  createWallet as createWalletSelfClaw,
  signAuthenticatedPayload,
} from "@/lib/selfclaw/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ownerAddress = body?.ownerAddress;

    if (!ownerAddress || typeof ownerAddress !== "string") {
      return NextResponse.json(
        { error: "ownerAddress required in body" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress: ownerAddress },
    });

    if (!user) {
      return NextResponse.json({
        synced: 0,
        updated: 0,
        agents: [],
        message: "No user found.",
      });
    }

    const agents = await prisma.agent.findMany({
      where: { ownerId: user.id },
      include: {
        verification: {
          select: {
            publicKey: true,
            encryptedPrivateKey: true,
            selfxyzVerified: true,
            agentId: true,
          },
        },
      },
    });

    let updated = 0;

    for (const agent of agents) {
      const v = agent.verification;
      if (!v?.publicKey || v.selfxyzVerified) continue;

      try {
        const agentStatus = await checkAgentStatus(v.publicKey);
        if (!agentStatus.verified) continue;

        const fullAgent = await prisma.agent.findUnique({
          where: { id: agent.id },
          select: { agentWalletAddress: true },
        });

        await prisma.agentVerification.update({
          where: { agentId: agent.id },
          data: {
            status: "verified",
            selfxyzVerified: true,
            humanId: agentStatus.humanId || null,
            swarmUrl: agentStatus.swarm || null,
            selfxyzRegisteredAt: agentStatus.selfxyz?.registeredAt
              ? new Date(agentStatus.selfxyz.registeredAt)
              : null,
            verifiedAt: new Date(),
          },
        });

        const walletAddr = fullAgent?.agentWalletAddress;
        const alreadyHasWallet =
          (agentStatus as { walletAddress?: string }).walletAddress != null;
        if (walletAddr && !alreadyHasWallet && v.encryptedPrivateKey) {
          try {
            const privateKeyHex = decryptPrivateKey(v.encryptedPrivateKey);
            const signed = await signAuthenticatedPayload(v.publicKey, privateKeyHex);
            await createWalletSelfClaw(signed, walletAddr, "celo");
          } catch {
            // Non-fatal
          }
        }

        await prisma.activityLog.create({
          data: {
            agentId: agent.id,
            type: "action",
            message: `✅ Verification synced from SelfClaw (humanId: ${agentStatus.humanId || "unknown"})`,
            metadata: JSON.stringify({
              humanId: agentStatus.humanId,
              swarm: agentStatus.swarm,
            }),
          },
        });

        updated++;
      } catch (err) {
        console.warn(`[verify-sync] Agent ${agent.id} check failed:`, err);
      }
    }

    const refreshed = await prisma.agent.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        verification: {
          select: {
            selfxyzVerified: true,
            humanId: true,
            verifiedAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      synced: agents.filter((a) => a.verification?.publicKey).length,
      updated,
      agents: refreshed,
      message: updated > 0 ? `Synced ${updated} agent(s) from SelfClaw.` : "No updates needed.",
    });
  } catch (error) {
    console.error("verify-sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync verification" },
      { status: 500 }
    );
  }
}
