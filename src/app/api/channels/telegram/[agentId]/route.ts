/**
 * Telegram Webhook Endpoint
 *
 * POST /api/channels/telegram/[agentId]
 *
 * Called by Telegram when a user sends a message to the agent's bot.
 * Routes through processMessage() for full skill + transaction execution,
 * then replies via Telegram Bot API.
 *
 * Security: Telegram sends X-Telegram-Bot-Api-Secret-Token header which
 * we verify against the agent's stored webhookSecret.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processMessage } from "@/lib/openclaw/manager";
import {
  parseUpdate,
  verifyWebhookSecret,
  sendMessage,
  sendTypingAction,
  type TelegramUpdate,
} from "@/lib/channels/telegram";
import { decrypt } from "@/lib/crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

  try {
    // Look up agent
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        name: true,
        status: true,
        telegramBotToken: true,
        telegramChatIds: true,
        webhookSecret: true,
      },
    });

    if (!agent || !agent.telegramBotToken) {
      // Return 200 to Telegram (so it stops retrying) but do nothing
      return NextResponse.json({ ok: true });
    }

    // Verify webhook secret
    if (agent.webhookSecret) {
      if (!verifyWebhookSecret(request, agent.webhookSecret)) {
        return NextResponse.json({ ok: true }); // Silent reject
      }
    }

    // Agent must be active
    if (agent.status !== "active") {
      return NextResponse.json({ ok: true });
    }

    // Parse the Telegram update
    const update: TelegramUpdate = await request.json();
    const incoming = parseUpdate(update, agentId);
    if (!incoming) {
      // Not a text message — ignore
      return NextResponse.json({ ok: true });
    }

    // Check chat ID allowlist (if configured)
    if (agent.telegramChatIds) {
      try {
        const allowedIds = JSON.parse(agent.telegramChatIds) as string[];
        if (allowedIds.length > 0 && !allowedIds.includes(incoming.chatId)) {
          return NextResponse.json({ ok: true }); // Not authorized
        }
      } catch {
        // Malformed JSON — allow all
      }
    }

    // Decrypt bot token
    const botToken = decrypt(agent.telegramBotToken);

    // Send typing indicator (non-blocking)
    sendTypingAction(botToken, incoming.chatId);

    // Load recent conversation history for this chat from activity logs
    const recentLogs = await prisma.activityLog.findMany({
      where: {
        agentId,
        type: "action",
        message: { startsWith: "📱 TG" },
        metadata: { contains: incoming.chatId },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Build conversation history from logs
    const history: { role: "user" | "assistant"; content: string }[] = [];
    for (const log of recentLogs.reverse()) {
      try {
        const meta = JSON.parse(log.metadata || "{}");
        if (meta.userMessage && meta.response) {
          history.push({ role: "user", content: meta.userMessage });
          history.push({ role: "assistant", content: meta.response });
        }
      } catch {
        // Skip malformed logs
      }
    }

    // Process through full Agent Forge pipeline (skills + transactions)
    const response = await processMessage(agentId, incoming.text, history);

    // Send reply back to Telegram
    await sendMessage(
      botToken,
      Number(incoming.chatId),
      response,
      incoming.messageId as number | undefined
    );

    // Log the interaction
    await prisma.activityLog.create({
      data: {
        agentId,
        type: "action",
        message: `📱 TG ${incoming.senderName || incoming.senderId}: ${incoming.text.slice(0, 60)}`,
        metadata: JSON.stringify({
          channel: "telegram",
          chatId: incoming.chatId,
          senderId: incoming.senderId,
          senderName: incoming.senderName,
          userMessage: incoming.text.slice(0, 200),
          response: response.slice(0, 200),
        }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`Telegram webhook error for agent ${agentId}:`, error);

    // Log error but return 200 to Telegram
    try {
      await prisma.activityLog.create({
        data: {
          agentId,
          type: "error",
          message: `Telegram webhook error: ${error instanceof Error ? error.message : String(error)}`.slice(0, 200),
        },
      });
    } catch {
      // Logging failed — nothing we can do
    }

    return NextResponse.json({ ok: true });
  }
}

