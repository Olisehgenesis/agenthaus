/**
 * Agent Channel Management API
 *
 * GET  /api/agents/[id]/channels — list channels + cron jobs
 * POST /api/agents/[id]/channels — connect/disconnect channels, manage cron jobs
 *
 * Actions:
 *   connect_telegram   — set up Telegram bot webhook
 *   disconnect_telegram — remove webhook
 *   add_cron           — add a scheduled task
 *   toggle_cron        — enable/disable a cron job
 *   remove_cron        — delete a cron job
 *   init_default_crons — create default cron jobs for the template
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { v4 as uuid } from "uuid";
import {
  verifyBotToken,
  setWebhook,
  removeWebhook,
} from "@/lib/channels/telegram";
import {
  getCronJobs,
  saveCronJobs,
  getDefaultCronJobs,
} from "@/lib/channels/scheduler";
import type { ChannelConfig } from "@/lib/channels/types";

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const agent = await prisma.agent.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        templateType: true,
        channels: true,
        cronJobs: true,
        telegramBotToken: true,
        webhookSecret: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Parse channels
    let channels: ChannelConfig[] = [];
    if (agent.channels) {
      try {
        channels = JSON.parse(agent.channels);
      } catch {
        channels = [];
      }
    }

    // Always include web channel
    const webChannel: ChannelConfig = {
      type: "web",
      enabled: true,
      connectedAt: agent.channels ? undefined : new Date().toISOString(),
    };
    if (!channels.find((c) => c.type === "web")) {
      channels.unshift(webChannel);
    }

    // Get cron jobs
    const cronJobs = await getCronJobs(id);
    const defaultCrons = getDefaultCronJobs(agent.templateType);

    return NextResponse.json({
      channels,
      cronJobs,
      defaultCronJobs: defaultCrons,
      hasTelegramBot: !!agent.telegramBotToken,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch channels" },
      { status: 500 }
    );
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { action } = body;

    const agent = await prisma.agent.findUnique({
      where: { id },
      select: {
        id: true,
        templateType: true,
        channels: true,
        telegramBotToken: true,
        webhookSecret: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    switch (action) {
      // ── Telegram ────────────────────────────────────────────────────
      case "connect_telegram": {
        const { botToken } = body;
        if (!botToken || typeof botToken !== "string") {
          return NextResponse.json({ error: "Bot token required" }, { status: 400 });
        }

        // Verify the token is valid
        const verification = await verifyBotToken(botToken);
        if (!verification.valid) {
          return NextResponse.json(
            { error: `Invalid bot token: ${verification.error}` },
            { status: 400 }
          );
        }

        // Generate webhook secret
        const webhookSecret = uuid().replace(/-/g, "");

        // Get the app URL for webhook
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000";

        // Set webhook with Telegram
        const hookResult = await setWebhook(botToken, id, baseUrl, webhookSecret);
        if (!hookResult.success) {
          return NextResponse.json(
            { error: `Failed to set webhook: ${hookResult.error}` },
            { status: 500 }
          );
        }

        // Store encrypted token and update channels
        const encryptedToken = encrypt(botToken);
        const channels = parseChannels(agent.channels);
        const existingIdx = channels.findIndex((c) => c.type === "telegram");
        const tgChannel: ChannelConfig = {
          type: "telegram",
          enabled: true,
          connectedAt: new Date().toISOString(),
          botUsername: verification.botUsername,
        };
        if (existingIdx >= 0) {
          channels[existingIdx] = tgChannel;
        } else {
          channels.push(tgChannel);
        }

        await prisma.agent.update({
          where: { id },
          data: {
            telegramBotToken: encryptedToken,
            webhookSecret,
            channels: JSON.stringify(channels),
          },
        });

        await prisma.activityLog.create({
          data: {
            agentId: id,
            type: "action",
            message: `📱 Telegram bot connected: ${verification.botUsername}`,
          },
        });

        return NextResponse.json({
          success: true,
          botUsername: verification.botUsername,
          botName: verification.botName,
        });
      }

      case "disconnect_telegram": {
        if (agent.telegramBotToken) {
          try {
            const botToken = decrypt(agent.telegramBotToken);
            await removeWebhook(botToken);
          } catch {
            // Token may be invalid — proceed with cleanup anyway
          }
        }

        const channels = parseChannels(agent.channels).filter((c) => c.type !== "telegram");

        await prisma.agent.update({
          where: { id },
          data: {
            telegramBotToken: null,
            telegramChatIds: null,
            webhookSecret: null,
            channels: JSON.stringify(channels),
          },
        });

        await prisma.activityLog.create({
          data: {
            agentId: id,
            type: "action",
            message: "📱 Telegram bot disconnected",
          },
        });

        return NextResponse.json({ success: true });
      }

      // ── Cron Jobs ───────────────────────────────────────────────────
      case "init_default_crons": {
        const defaults = getDefaultCronJobs(agent.templateType);
        const jobs = defaults.map((d) => ({
          ...d,
          id: uuid(),
          agentId: id,
        }));
        await saveCronJobs(id, jobs);
        return NextResponse.json({ cronJobs: jobs });
      }

      case "add_cron": {
        const existing = await getCronJobs(id);
        const newJob = {
          id: uuid(),
          agentId: id,
          name: body.name || "Custom Task",
          cron: body.cron || "*/30 * * * *",
          skillPrompt: body.skillPrompt || body.message || "",
          enabled: body.enabled ?? true,
        };
        existing.push(newJob);
        await saveCronJobs(id, existing);
        return NextResponse.json({ cronJob: newJob, cronJobs: existing });
      }

      case "toggle_cron": {
        const jobs = await getCronJobs(id);
        const updated = jobs.map((j) =>
          j.id === body.jobId ? { ...j, enabled: !j.enabled } : j
        );
        await saveCronJobs(id, updated);
        return NextResponse.json({ cronJobs: updated });
      }

      case "remove_cron": {
        const jobs = await getCronJobs(id);
        const filtered = jobs.filter((j) => j.id !== body.jobId);
        await saveCronJobs(id, filtered);
        return NextResponse.json({ cronJobs: filtered });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed" },
      { status: 500 }
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseChannels(raw: string | null): ChannelConfig[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ChannelConfig[];
  } catch {
    return [];
  }
}

