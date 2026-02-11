import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processMessage, processChannelMessage } from "@/lib/openclaw/manager";
import { getOrCreateWebChatBinding, getWebChatBindingId, loadSessionHistory } from "@/lib/openclaw/router";

// GET /api/agents/:id/chat?walletAddress=0x... - Load persisted chat history
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "walletAddress query param is required" },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: { owner: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const ownerWallet = agent.owner.walletAddress?.toLowerCase();
    const providedWallet = walletAddress.toLowerCase();
    if (ownerWallet !== providedWallet) {
      return NextResponse.json(
        { error: "Wallet address does not match agent owner" },
        { status: 403 }
      );
    }

    const bindingId = await getWebChatBindingId(id, providedWallet);
    if (!bindingId) {
      return NextResponse.json({ messages: [] });
    }

    const history = await loadSessionHistory(bindingId, 100);
    return NextResponse.json({
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch (error) {
    console.error("Chat history error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load history" },
      { status: 500 }
    );
  }
}

// POST /api/agents/:id/chat - Send a message to an agent
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message, conversationHistory = [], walletAddress } = body;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Verify agent exists and is active
    const agent = await prisma.agent.findUnique({
      where: { id },
      include: { owner: true },
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

    let response: string;

    if (walletAddress) {
      // Persist session: verify wallet is owner, get/create web binding, use processChannelMessage
      const ownerWallet = agent.owner.walletAddress?.toLowerCase();
      const providedWallet = String(walletAddress).toLowerCase();
      if (ownerWallet !== providedWallet) {
        return NextResponse.json(
          { error: "Wallet address does not match agent owner" },
          { status: 403 }
        );
      }
      const bindingId = await getOrCreateWebChatBinding(id, providedWallet);
      response = await processChannelMessage(id, bindingId, message);
    } else {
      // No wallet: ephemeral chat (no persistence)
      response = await processMessage(id, message, conversationHistory);
    }

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

