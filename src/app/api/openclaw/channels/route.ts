import { NextRequest, NextResponse } from "next/server";
import {
  listChannels,
  addChannel,
  removeChannel,
  probeChannel,
  restartGateway,
} from "@/lib/openclaw/gateway-client";

/**
 * GET /api/openclaw/channels
 *
 * List all configured OpenClaw channels with their status.
 */
export async function GET() {
  try {
    const channels = await listChannels();
    return NextResponse.json({ channels });
  } catch (error) {
    return NextResponse.json(
      { channels: [], error: error instanceof Error ? error.message : "Failed to list channels" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/openclaw/channels
 *
 * Add or update a channel configuration.
 *
 * Body:
 *   { channel: "telegram"|"discord"|"whatsapp", botToken: "...", enabled: true }
 *
 * For WhatsApp, no token is needed — it uses QR pairing via `openclaw channels login`.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channel, botToken, account, enabled, action } = body;

    if (!channel) {
      return NextResponse.json(
        { error: "Channel name is required (telegram, discord, whatsapp)" },
        { status: 400 }
      );
    }

    // Handle special actions
    if (action === "probe") {
      const result = await probeChannel(channel);
      return NextResponse.json(result);
    }

    if (action === "restart") {
      const result = await restartGateway();
      return NextResponse.json(result);
    }

    // Add/update channel
    const result = await addChannel(channel, {
      botToken,
      account,
      enabled,
    });

    if (result.success) {
      // Restart gateway to pick up new channel config
      await restartGateway().catch(() => {
        // Non-fatal: gateway may auto-reload
      });

      // Return updated channel list
      const channels = await listChannels();
      return NextResponse.json({ ...result, channels });
    }

    return NextResponse.json(result, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to configure channel" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/openclaw/channels
 *
 * Remove a channel.
 * Body: { channel: "telegram" }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { channel } = body;

    if (!channel) {
      return NextResponse.json({ error: "Channel name is required" }, { status: 400 });
    }

    const result = await removeChannel(channel);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to remove channel" },
      { status: 500 }
    );
  }
}

