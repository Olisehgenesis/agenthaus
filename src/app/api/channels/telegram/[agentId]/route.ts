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

function isLikelyWalletCommand(text: string): boolean {
  const normalized = text.toLowerCase();
  const patterns = [
    /\bsend\b/,
    /\btransfer\b/,
    /\bswap\b/,
    /\bdeploy\b.+\btoken\b/,
    /\brequest\b.+\bsponsorship\b/,
    /\bregister\b.+\berc-?8004\b/,
    /\btip\b/,
    /\bpay\b/,
  ];
  return patterns.some((p) => p.test(normalized));
}

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

    // Decrypt bot token
    const botToken = decrypt(agent.telegramBotToken);

    // Check chat ID allowlist (if configured).
    // If blocked, send guidance instead of failing silently.
    if (agent.telegramChatIds) {
      try {
        const allowedIds = JSON.parse(agent.telegramChatIds) as string[];
        if (allowedIds.length > 0 && !allowedIds.includes(incoming.chatId)) {
          await sendMessage(
            botToken,
            incoming.chatId,
            "This chat is not authorized for admin actions yet. Open the Admin modal, generate a pairing code, and send it here."
          );
          return NextResponse.json({ ok: true });
        }
      } catch {
        // Malformed JSON — allow all
      }
    }

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

    if (route.systemReply) {
      await sendMessage(
        botToken,
        incoming.chatId,
        route.systemReply,
        incoming.messageId as number | undefined
      );
      return NextResponse.json({ ok: true });
    }

    if (!route.agentId) {
      await sendMessage(
        botToken,
        incoming.chatId,
        "Please send a valid pairing code from your admin dashboard to continue.",
        incoming.messageId as number | undefined
      );
      return NextResponse.json({ ok: true });
    }

    let canUseAgentWallet = false;
    if (route.bindingId) {
      const binding = await prisma.channelBinding.findUnique({
        where: { id: route.bindingId },
        select: { bindingType: true },
      });
      canUseAgentWallet =
        binding?.bindingType === "pairing" || binding?.bindingType === "direct";
    }

    if (!canUseAgentWallet && isLikelyWalletCommand(incoming.text)) {
      const pairingMessage = [
        "This is a privileged command.",
        "",
        "To enable wallet/admin actions:",
        "1. Open the agent Admin modal",
        "2. Generate a pairing code",
        "3. Send that code here (example: `AF7X2K`)",
        "",
        "After pairing, retry your command.",
      ].join("\n");

      await sendMessage(
        botToken,
        incoming.chatId,
        pairingMessage,
        incoming.messageId as number | undefined
      );
      return NextResponse.json({ ok: true });
    }

    // Process through full pipeline with session history
    const response = await processChannelMessage(
      route.agentId,
      route.bindingId || null,
      incoming.text,
      {
        channel: "telegram",
        senderId: incoming.senderId,
        senderName: incoming.senderName,
        chatId: incoming.chatId,
        dedicated: true,
      },
      { canUseAgentWallet }
    );

    // Send reply back to Telegram
    await sendMessage(
      botToken,
      incoming.chatId,
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
