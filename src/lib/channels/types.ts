/**
 * Native Channel System — Types
 *
 * Multi-tenant channel architecture: each agent can have its own
 * Telegram bot, Discord bot, etc. Channels feed into the same
 * processMessage() pipeline that handles skills + transactions.
 *
 * Flow: Channel → /api/channels/{type}/{agentId} → processMessage() → reply via Channel API
 */

// ─── Channel Types ──────────────────────────────────────────────────────────

export type ChannelType = "web" | "telegram" | "discord";

export interface ChannelConfig {
  type: ChannelType;
  enabled: boolean;
  connectedAt?: string;
  /** Telegram-specific */
  botUsername?: string;
  /** Discord-specific */
  guildCount?: number;
}

// ─── Incoming Message ───────────────────────────────────────────────────────

export interface IncomingChannelMessage {
  channelType: ChannelType;
  agentId: string;
  /** Sender identifier (Telegram user ID, Discord user ID, etc.) */
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
}

// ─── Outgoing Reply ─────────────────────────────────────────────────────────

export interface OutgoingReply {
  text: string;
  chatId: string;
  /** Reply to a specific message */
  replyToMessageId?: string | number;
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

