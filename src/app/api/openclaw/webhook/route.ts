import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processMessage } from "@/lib/openclaw/manager";

/**
 * POST /api/openclaw/webhook
 *
 * Webhook endpoint that the OpenClaw gateway can call (via hooks) when it
 * receives an incoming message from a channel (Telegram, WhatsApp, Discord).
 *
 * Instead of OpenClaw's built-in LLM pipeline, we route the message through
 * Agent Forge's own processMessage (which handles our custom transaction
 * execution, wallet context injection, multi-provider LLM fallbacks, etc.)
 *
 * Body (from OpenClaw hook):
 *   {
 *     channel: "telegram",
 *     senderId: "732186130",
 *     senderName: "Oliseh",
 *     message: "send 1 CELO to 0xABC...",
 *     agentId: "main",        // OpenClaw agent id
 *     sessionId?: "...",
 *     groupId?: "...",
 *     replyToMessageId?: "..."
 *   }
 *
 * We map the OpenClaw agentId to our Agent Forge agent and process the message.
 */
export async function POST(request: NextRequest) {
  // Verify webhook token
  const authHeader = request.headers.get("authorization");
  const webhookToken = process.env.OPENCLAW_WEBHOOK_TOKEN || process.env.OPENCLAW_GATEWAY_TOKEN;

  if (webhookToken && authHeader !== `Bearer ${webhookToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      channel,
      senderId,
      senderName,
      message: userMessage,
      agentId: openclawAgentId,
      forgeAgentId, // Direct Agent Forge agent ID (preferred)
    } = body;

    if (!userMessage) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    // Resolve which Agent Forge agent to use
    let agent;

    if (forgeAgentId) {
      // Direct Agent Forge agent ID
      agent = await prisma.agent.findUnique({ where: { id: forgeAgentId } });
    } else if (openclawAgentId) {
      // Look up by OpenClaw agent ID binding
      agent = await prisma.agent.findFirst({
        where: { openclawAgentId },
      });
    }

    // Fallback: use the first active agent
    if (!agent) {
      agent = await prisma.agent.findFirst({
        where: { status: "active" },
        orderBy: { deployedAt: "desc" },
      });
    }

    if (!agent) {
      return NextResponse.json(
        { error: "No active agent found to handle this message" },
        { status: 404 }
      );
    }

    // Load recent conversation history for this sender from activity logs
    const recentLogs = await prisma.activityLog.findMany({
      where: {
        agentId: agent.id,
        type: "action",
        message: { contains: "Processed message" },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Process through our Agent Forge LLM pipeline
    const response = await processMessage(agent.id, userMessage, []);

    // Log the channel interaction
    await prisma.activityLog.create({
      data: {
        agentId: agent.id,
        type: "action",
        message: `Channel message from ${channel || "webhook"}/${senderName || senderId || "unknown"}`,
        metadata: JSON.stringify({
          channel,
          senderId,
          senderName,
          userMessage: userMessage.slice(0, 200),
          responseLength: response.length,
          openclawAgentId,
        }),
      },
    });

    return NextResponse.json({
      response,
      agentId: agent.id,
      agentName: agent.name,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process webhook message",
        response: "Sorry, I encountered an error processing your message. Please try again.",
      },
      { status: 500 }
    );
  }
}

