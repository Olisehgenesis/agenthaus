/**
 * Agent SelfClaw Verification API
 *
 * GET  /api/agents/[id]/verify  — Get current verification status
 * POST /api/agents/[id]/verify  — Start or advance verification flow
 *
 * Flow:
 *   POST { action: "start" }           → generates keys, calls SelfClaw, returns QR data
 *   POST { action: "sign" }            → signs challenge with agent key, submits to SelfClaw
 *   POST { action: "check" }           → polls SelfClaw for verification completion
 *   POST { action: "restart" }         → resets and restarts verification
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateKeyPair,
  signMessage,
  encryptPrivateKey,
  decryptPrivateKey,
} from "@/lib/selfclaw/keys";
import {
  startVerification,
  signChallenge,
  checkAgentStatus,
} from "@/lib/selfclaw/client";

// ─── GET: Current verification status ────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  try {
    const verification = await prisma.agentVerification.findUnique({
      where: { agentId },
      select: {
        status: true,
        publicKey: true,
        humanId: true,
        agentKeyHash: true,
        agentName: true,
        swarmUrl: true,
        selfxyzVerified: true,
        selfxyzRegisteredAt: true,
        selfAppConfig: true,
        verifiedAt: true,
        createdAt: true,
        sessionId: true,
      },
    });

    if (!verification) {
      return NextResponse.json({
        status: "not_started",
        verified: false,
      });
    }

    return NextResponse.json({
      status: verification.status,
      verified: verification.selfxyzVerified,
      publicKey: verification.publicKey,
      humanId: verification.humanId,
      agentKeyHash: verification.agentKeyHash,
      swarmUrl: verification.swarmUrl,
      verifiedAt: verification.verifiedAt,
      selfAppConfig: verification.selfAppConfig
        ? JSON.parse(verification.selfAppConfig)
        : null,
      hasSession: !!verification.sessionId,
    });
  } catch (error) {
    console.error("Failed to get verification status:", error);
    return NextResponse.json(
      { error: "Failed to get verification status" },
      { status: 500 }
    );
  }
}

// ─── POST: Advance verification flow ─────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  try {
    const body = await request.json();
    const { action } = body;

    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, ownerId: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    switch (action) {
      case "start":
        return handleStart(agent);
      case "sign":
        return handleSign(agentId);
      case "check":
        return handleCheck(agentId);
      case "restart":
        return handleRestart(agent);
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "start", "sign", "check", or "restart".' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed" },
      { status: 500 }
    );
  }
}

// ─── Action Handlers ─────────────────────────────────────────────────────────

async function handleStart(agent: { id: string; name: string }) {
  // Check for existing verification
  const existing = await prisma.agentVerification.findUnique({
    where: { agentId: agent.id },
  });

  if (existing?.selfxyzVerified) {
    return NextResponse.json({
      status: "already_verified",
      verified: true,
      humanId: existing.humanId,
      verifiedAt: existing.verifiedAt,
    });
  }

  // Generate a new Ed25519 key pair
  const { publicKey, privateKeyHex } = await generateKeyPair();
  const encryptedKey = encryptPrivateKey(privateKeyHex);

  // Call SelfClaw to start verification
  const selfClawResponse = await startVerification({
    agentPublicKey: publicKey,
    agentName: agent.name,
  });

  // Upsert verification record
  const verification = await prisma.agentVerification.upsert({
    where: { agentId: agent.id },
    create: {
      agentId: agent.id,
      publicKey,
      encryptedPrivateKey: encryptedKey,
      status: "pending",
      sessionId: selfClawResponse.sessionId,
      challenge: selfClawResponse.challenge,
      agentKeyHash: selfClawResponse.agentKeyHash,
      agentName: agent.name,
      selfAppConfig: selfClawResponse.selfApp
        ? JSON.stringify(selfClawResponse.selfApp)
        : null,
    },
    update: {
      publicKey,
      encryptedPrivateKey: encryptedKey,
      status: "pending",
      sessionId: selfClawResponse.sessionId,
      challenge: selfClawResponse.challenge,
      agentKeyHash: selfClawResponse.agentKeyHash,
      selfAppConfig: selfClawResponse.selfApp
        ? JSON.stringify(selfClawResponse.selfApp)
        : null,
      selfxyzVerified: false,
      humanId: null,
      verifiedAt: null,
    },
  });

  return NextResponse.json({
    status: "pending",
    sessionId: selfClawResponse.sessionId,
    signatureRequired: selfClawResponse.signatureRequired,
    selfAppConfig: selfClawResponse.selfApp || null,
    publicKey,
    message: "Verification started. Next step: call with action 'sign' to sign the challenge.",
  });
}

async function handleSign(agentId: string) {
  const verification = await prisma.agentVerification.findUnique({
    where: { agentId },
  });

  if (!verification) {
    return NextResponse.json(
      { error: "No verification session. Start verification first." },
      { status: 400 }
    );
  }

  if (verification.selfxyzVerified) {
    return NextResponse.json({
      status: "already_verified",
      verified: true,
    });
  }

  if (!verification.sessionId || !verification.challenge) {
    return NextResponse.json(
      { error: "No active session. Restart verification." },
      { status: 400 }
    );
  }

  // Decrypt the private key and sign the challenge
  const privateKeyHex = decryptPrivateKey(verification.encryptedPrivateKey);
  const signature = await signMessage(verification.challenge, privateKeyHex);

  // Submit to SelfClaw
  const signResponse = await signChallenge({
    sessionId: verification.sessionId,
    signature,
  });

  // Update status — after signing, the QR code becomes available
  await prisma.agentVerification.update({
    where: { agentId },
    data: {
      status: "qr_ready",
      selfAppConfig: signResponse.selfApp
        ? JSON.stringify(signResponse.selfApp)
        : verification.selfAppConfig,
    },
  });

  return NextResponse.json({
    status: "qr_ready",
    message: "Challenge signed. Scan the QR code with the Self app to complete verification.",
    selfAppConfig: signResponse.selfApp || (
      verification.selfAppConfig ? JSON.parse(verification.selfAppConfig) : null
    ),
  });
}

async function handleCheck(agentId: string) {
  const verification = await prisma.agentVerification.findUnique({
    where: { agentId },
  });

  if (!verification) {
    return NextResponse.json({
      status: "not_started",
      verified: false,
    });
  }

  if (verification.selfxyzVerified) {
    return NextResponse.json({
      status: "verified",
      verified: true,
      humanId: verification.humanId,
      verifiedAt: verification.verifiedAt,
    });
  }

  // Poll SelfClaw for status
  try {
    const agentStatus = await checkAgentStatus(verification.publicKey);

    if (agentStatus.verified) {
      // Verification complete! Update database.
      await prisma.agentVerification.update({
        where: { agentId },
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

      // Log the verification
      await prisma.activityLog.create({
        data: {
          agentId,
          type: "action",
          message: `✅ Agent verified via SelfClaw (humanId: ${agentStatus.humanId || "unknown"})`,
          metadata: JSON.stringify({
            humanId: agentStatus.humanId,
            swarm: agentStatus.swarm,
          }),
        },
      });

      return NextResponse.json({
        status: "verified",
        verified: true,
        humanId: agentStatus.humanId,
        swarmUrl: agentStatus.swarm,
        verifiedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      status: verification.status,
      verified: false,
      message: "Verification not yet complete. Scan the QR code with the Self app.",
    });
  } catch (error) {
    // SelfClaw API may return 404 for not-yet-verified agents
    return NextResponse.json({
      status: verification.status,
      verified: false,
      message: "Waiting for verification to complete...",
    });
  }
}

async function handleRestart(agent: { id: string; name: string }) {
  // Delete existing verification and start fresh
  await prisma.agentVerification.deleteMany({
    where: { agentId: agent.id },
  });

  return handleStart(agent);
}

