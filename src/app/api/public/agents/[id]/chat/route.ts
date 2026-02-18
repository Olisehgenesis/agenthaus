import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processMessage } from "@/lib/openclaw/manager";

/**
 * Public, metaverse-aware chat entrypoint.
 *
 * POST /api/public/agents/:id/chat
 *
 * Anyone can call this endpoint to talk to an agent in a
 * metaverse / world context. It never:
 * - uses the agent's on-chain wallet
 * - requires or returns user accounts or verification data
 *
 * Body:
 * - message: string (required)
 * - worldName?: string
 * - location?: string
 * - participants?: string[]  (names / agent ids / avatars present)
 * - contextNote?: string     (extra free-form description)
 *
 * The endpoint injects a short system preamble so the agent knows
 * it is speaking inside a metaverse scene with other agents/avatars.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      message,
      worldName,
      location,
      participants,
      contextNote,
    }: {
      message?: string;
      worldName?: string;
      location?: string;
      participants?: string[];
      contextNote?: string;
    } = body || {};

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        llmProvider: true,
        llmModel: true,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    if (agent.status !== "active") {
      return NextResponse.json(
        {
          error: `Agent is ${agent.status}. Only active agents can process messages.`,
        },
        { status: 400 }
      );
    }

    const worldLabel = worldName || "a Celo-powered metaverse world";
    const whereLabel = location ? ` at ${location}` : "";
    const participantsLabel =
      participants && participants.length > 0
        ? `Other participants here: ${participants.join(", ")}.`
        : "";
    const extraContext = contextNote ? `Extra context: ${contextNote}` : "";

    const systemPreamble = [
      `You are currently being asked from inside ${worldLabel}${whereLabel}.`,
      "You are in a shared metaverse scene where humans and other agents may be present.",
      "Be social and immersive: you can greet other agents or avatars, say \"hey\" back, and describe what you are doing in-world.",
      participantsLabel,
      extraContext,
    ]
      .filter(Boolean)
      .join(" ");

    const composedPrompt = `${systemPreamble}\n\nUser: ${message}`;

    const response = await processMessage(
      agent.id,
      composedPrompt,
      [],
      {
        // Public metaverse entrypoint must never execute on-chain actions.
        canUseAgentWallet: false,
      }
    );

    return NextResponse.json({
      agentId: agent.id,
      agentName: agent.name,
      provider: agent.llmProvider,
      model: agent.llmModel,
      response,
      meta: {
        worldName: worldName || null,
        location: location || null,
        participants: participants || [],
      },
    });
  } catch (error) {
    console.error("Public metaverse chat error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process metaverse chat message",
      },
      { status: 500 }
    );
  }
}

