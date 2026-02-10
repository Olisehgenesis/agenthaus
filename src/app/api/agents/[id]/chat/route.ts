import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processMessage } from "@/lib/openclaw/manager";

// POST /api/agents/:id/chat - Send a message to an agent
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Verify agent exists and is active
    const agent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.status !== "active") {
      return NextResponse.json(
        { error: `Agent is ${agent.status}. Only active agents can process messages.` },
        { status: 400 }
      );
    }

    // Process message through OpenClaw runtime (uses owner's per-user API key)
    const response = await processMessage(id, message, conversationHistory);

    // Log the interaction
    await prisma.activityLog.create({
      data: {
        agentId: id,
        type: "action",
        message: `Chat: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"`,
        metadata: JSON.stringify({
          userMessage: message,
          responsePreview: response.slice(0, 200),
          provider: agent.llmProvider,
          model: agent.llmModel,
        }),
      },
    });

    return NextResponse.json({
      response,
      agentId: id,
      provider: agent.llmProvider,
      model: agent.llmModel,
    });
  } catch (error) {
    console.error("Chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process message";

    // Detect missing API key errors and return a helpful message
    const isMissingKey = errorMessage.includes("API key");
    return NextResponse.json(
      {
        error: errorMessage,
        action: isMissingKey ? "Go to Settings to add your API key" : undefined,
      },
      { status: isMissingKey ? 422 : 500 }
    );
  }
}

