/**
 * Channel System — Types
 *
 * Hybrid multi-tenant channel architecture:
 *
 *   Mode 1 — Shared Bot (pairing code):
 *     One bot per channel for the whole platform.
 *     Users pair their sender identity to an agent via a 6-char code.
 *     Works for: WhatsApp, iMessage, shared Telegram/Discord bots.
 *
 *   Mode 2 — Dedicated Bot (per-agent):
 *     Each agent gets its own bot token (Telegram @BotFather, Discord app).
 *     Routing is implicit: bot token → agent.
 *     Works for: Telegram, Discord.
 *
 *   Mode 3 — Direct (web chat):
 *     Agent ID is in the URL. No pairing needed.
 *
 * All modes feed into the same processMessage() pipeline
 * for skill execution and on-chain transactions.
 */

// ─── Channel Types ──────────────────────────────────────────────────────────

/** All supported channel types */
export type ChannelType =
  | "web"
  | "telegram"
  | "discord"
  | "whatsapp"
  | "imessage";

/** How a sender was bound to an agent */
export type BindingType =
  | "pairing"    // shared-bot: user sent a pairing code
  | "dedicated"  // per-agent bot: bot token = agent
  | "direct";    // web chat: agent ID in URL

export interface ChannelConfig {
  type: ChannelType;
  enabled: boolean;
  connectedAt?: string;
  /** Telegram-specific */
  botUsername?: string;
  /** Discord-specific */
  guildCount?: number;
  /** Binding mode for this channel on this agent */
  bindingType?: BindingType;
}

// ─── Incoming Message (from OpenClaw Gateway or direct webhook) ─────────

export interface IncomingChannelMessage {
  channelType: ChannelType;
  /** Resolved agent ID (null if routing hasn't happened yet) */
  agentId?: string;
  /** Sender identifier — unique per channel:
   *  WhatsApp: "+15555550123"
   *  Telegram: "12345678" (user ID)
   *  Discord:  "98765432" (user ID)
   *  iMessage: "+15555550123" or "user@icloud.com"
   *  Web:      session UUID
   */
  senderId: string;
  senderName?: string;
  /** The raw user message text */
  text: string;
  /** Chat/group/channel where the message was sent */
  chatId: string;
  /** Original message ID for replies */
  messageId?: string | number;
  /** Timestamp */
  timestamp: Date;
  /** Raw metadata from the channel (forwarded from OpenClaw) */
  rawMetadata?: Record<string, unknown>;
}

// ─── Outgoing Reply ─────────────────────────────────────────────────────────

export interface OutgoingReply {
  text: string;
  chatId: string;
  channelType: ChannelType;
  /** Reply to a specific message */
  replyToMessageId?: string | number;
  /** Media attachments */
  media?: {
    type: "image" | "audio" | "document";
    url: string;
    caption?: string;
  }[];
}

// ─── Cron Job ───────────────────────────────────────────────────────────────

export interface CronJobDef {
  id: string;
  agentId: string;
  name: string;
  /** Cron expression (5-field: min hour dom month dow) */
  cron: string;
  /** Prompt to send through processMessage when cron fires */
  skillPrompt: string;
  enabled: boolean;
  lastRun?: string;     // ISO date
  lastResult?: string;  // truncated response
  nextRun?: string;     // ISO date (computed)
}

// ─── Channel Adapter Interface ──────────────────────────────────────────────

export interface ChannelAdapter {
  type: ChannelType;
  /** Set up the channel (e.g. register webhook with Telegram) */
  connect(agentId: string, config: Record<string, string>): Promise<{ success: boolean; botUsername?: string; error?: string }>;
  /** Tear down the channel */
  disconnect(agentId: string): Promise<{ success: boolean; error?: string }>;
  /** Send a message to a chat */
  sendMessage(botToken: string, reply: OutgoingReply): Promise<{ success: boolean; error?: string }>;
  /** Verify an incoming webhook is authentic */
  verifyWebhook?(request: Request, secret: string): boolean;
}

// ─── OpenClaw Webhook Payload ──────────────────────────────────────────────
// Shape of the POST body that OpenClaw Gateway sends to our webhook endpoint.

export interface OpenClawWebhookPayload {
  /** Channel the message arrived on */
  channel: ChannelType;
  /** Sender identity on that channel */
  sender: {
    id: string;          // unique identifier
    name?: string;       // display name
    phone?: string;      // WhatsApp / iMessage
    username?: string;   // Telegram / Discord
  };
  /** Chat context (DM vs group) */
  chat: {
    id: string;
    type: "dm" | "group";
    title?: string;      // group name
  };
  /** Message content */
  message: {
    id: string;
    text: string;
    timestamp: string;   // ISO 8601
    media?: {
      type: string;
      url: string;
    }[];
  };
  /** OpenClaw internal metadata */
  meta?: {
    sessionId?: string;
    gatewayId?: string;
    botId?: string;       // for dedicated bots: which bot received this
  };
}

// ─── OpenClaw Webhook Response ─────────────────────────────────────────────
// What we return to OpenClaw so it can relay the reply.

export interface OpenClawWebhookResponse {
  /** Reply text for OpenClaw to send back */
  reply: string;
  /** Agent that handled this message */
  agentId: string;
  agentName: string;
  /** Whether this was a pairing action vs normal chat */
  action: "chat" | "paired" | "unpaired" | "unknown_sender" | "error";
  /** Media to attach to the reply */
  media?: {
    type: "image" | "audio" | "document";
    url: string;
    caption?: string;
  }[];
}
