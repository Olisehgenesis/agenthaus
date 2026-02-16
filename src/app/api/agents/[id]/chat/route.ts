import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processMessage, processChannelMessage } from "@/lib/openclaw/manager";
import { getOrCreateWebChatBinding, getWebChatBindingId, loadSessionHistory, clearSessionHistory } from "@/lib/openclaw/router";

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
    const { message, conversationHistory = [], walletAddress, welcome } = body;

    if (!message && !welcome) {
      return NextResponse.json({ error: "Message or welcome is required" }, { status: 400 });
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

    const isAdmin =
      !!walletAddress &&
      agent.owner.walletAddress?.toLowerCase() === String(walletAddress).toLowerCase();

    if (welcome) {
      const agentName = agent.name || "Agent";
      const introPrompt = `Your name is **${agentName}**. Introduce yourself to the user in one short, cool paragraph. Say who you are (use your name: ${agentName}), what you can help with. Be friendly, welcoming, and a bit charismatic. Keep it concise. You may use **bold** for emphasis if it helps.`;
      response = await processMessage(id, introPrompt, [], { canUseAgentWallet: false });
    } else if (walletAddress && isAdmin) {
      // Persist session: verify wallet is owner, get/create web binding, use processChannelMessage
      const bindingId = await getOrCreateWebChatBinding(id, String(walletAddress).toLowerCase());
      response = await processChannelMessage(id, bindingId, message);
    } else {
      // External user (no wallet or not owner): ephemeral chat, no agent wallet execution
      response = await processMessage(id, message, conversationHistory, {
        canUseAgentWallet: false,
      });
    }

    // Log the interaction (skip for welcome)
    if (!welcome) {
      await prisma.activityLog.create({
        data: {
          agentId: id,
          type: "action",
          message: `Chat: "${(message as string).slice(0, 80)}${(message as string).length > 80 ? "..." : ""}"`,
        metadata: JSON.stringify({
          userMessage: message,
          responsePreview: response.slice(0, 200),
          provider: agent.llmProvider,
          model: agent.llmModel,
        }),
      },
    });
    }

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

// DELETE /api/agents/:id/chat - Clear chat history (owner only)
export async function DELETE(
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

    const cleared = await clearSessionHistory(id, providedWallet);
    return NextResponse.json({ success: true, cleared });
  } catch (error) {
    console.error("Clear chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear chat" },
      { status: 500 }
    );
  }
}

