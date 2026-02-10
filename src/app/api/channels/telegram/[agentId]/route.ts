/**
 * Telegram Webhook Endpoint
 *
 * POST /api/channels/telegram/[agentId]
 *
 * Called by Telegram when a user sends a message to the agent's DEDICATED bot.
 * (Shared bot messages come through OpenClaw → /api/openclaw/webhook instead.)
 *
 * Routes through processChannelMessage() for full skill + transaction execution
 * with persistent session history, then replies via Telegram Bot API.
 *
 * Security: Telegram sends X-Telegram-Bot-Api-Secret-Token header which
 * we verify against the agent's stored webhookSecret.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processChannelMessage } from "@/lib/openclaw/manager";
import { routeMessage, type SenderContext } from "@/lib/openclaw/router";
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
      return NextResponse.json({ ok: true });
    }

    // Verify webhook secret
    if (agent.webhookSecret) {
      if (!verifyWebhookSecret(request, agent.webhookSecret)) {
        return NextResponse.json({ ok: true });
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
      return NextResponse.json({ ok: true });
    }

    // Check chat ID allowlist (if configured)
    if (agent.telegramChatIds) {
      try {
        const allowedIds = JSON.parse(agent.telegramChatIds) as string[];
        if (allowedIds.length > 0 && !allowedIds.includes(incoming.chatId)) {
          return NextResponse.json({ ok: true });
        }
      } catch {
        // Malformed JSON — allow all
      }
    }

    // Decrypt bot token
    const botToken = decrypt(agent.telegramBotToken);

    // Send typing indicator (non-blocking)
    sendTypingAction(botToken, incoming.chatId);

    // Route through the unified router — creates/finds ChannelBinding
    const senderCtx: SenderContext = {
      channelType: "telegram",
      senderId: `tg:${incoming.senderId}`,
      senderName: incoming.senderName,
      chatId: incoming.chatId,
      messageText: incoming.text,
      dedicatedBotId: agentId, // This is a dedicated bot
    };

    const route = await routeMessage(senderCtx);

    // Process through full pipeline with session history
    const response = await processChannelMessage(
        agentId,
      route.bindingId || null,
      incoming.text,
      {
        channel: "telegram",
        senderId: incoming.senderId,
        senderName: incoming.senderName,
        chatId: incoming.chatId,
        dedicated: true,
      }
    );

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
          bindingId: route.bindingId,
          userMessage: incoming.text.slice(0, 200),
          response: response.slice(0, 200),
        }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`Telegram webhook error for agent ${agentId}:`, error);

    try {
      await prisma.activityLog.create({
        data: {
          agentId,
          type: "error",
          message: `Telegram webhook error: ${error instanceof Error ? error.message : String(error)}`.slice(0, 200),
        },
      });
    } catch {
      // Logging failed
    }

    return NextResponse.json({ ok: true });
  }
}
