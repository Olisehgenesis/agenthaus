/**
 * OpenClaw Gateway Client
 *
 * Wraps the locally-installed OpenClaw CLI to manage channels, cron jobs,
 * agents, and gateway status from within Agent Forge.
 *
 * The gateway runs as a LaunchAgent at ws://127.0.0.1:18789 (configurable).
 * We interact via `openclaw <subcommand>` invocations because the gateway's
 * HTTP surface only serves the Control-UI SPA — the real management API is
 * exposed through the CLI + WebSocket RPC.
 */

import { exec as execCb } from "child_process";
import { promisify } from "util";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const exec = promisify(execCb);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPENCLAW_BIN =
  process.env.OPENCLAW_BIN || `${process.env.HOME}/.npm-global/bin/openclaw`;
const OPENCLAW_CONFIG_PATH =
  process.env.OPENCLAW_CONFIG_PATH || `${process.env.HOME}/.openclaw/openclaw.json`;
const OPENCLAW_GATEWAY_PORT = process.env.OPENCLAW_GATEWAY_PORT || "18789";

/** Shared env for every CLI call so it can find node/npm globals. */
function cliEnv() {
  return {
    ...process.env,
    PATH: `${process.env.HOME}/.npm-global/bin:${process.env.PATH}`,
  };
}

/** Run an openclaw CLI command and return stdout. */
async function run(args: string, timeoutMs = 30_000): Promise<string> {
  try {
    const { stdout } = await exec(`${OPENCLAW_BIN} ${args}`, {
      timeout: timeoutMs,
      env: cliEnv(),
    });
    return stdout.trim();
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    throw new Error(`openclaw ${args.split(" ")[0]} failed: ${message}`);
  }
}

/** Run an openclaw command that returns JSON. */
async function runJson<T = unknown>(args: string, timeoutMs = 30_000): Promise<T> {
  const raw = await run(`${args} --json`, timeoutMs);
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Some commands output mixed text+json; try to extract the JSON portion
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error(`Failed to parse JSON from openclaw output: ${raw.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GatewayStatus {
  running: boolean;
  port: number;
  version: string;
  channels: ChannelStatus[];
  agents: AgentSummary[];
  sessions: SessionSummary[];
}

export interface ChannelStatus {
  name: string; // telegram, whatsapp, discord, etc.
  enabled: boolean;
  state: "ok" | "error" | "unconfigured";
  detail: string;
  botUsername?: string;
}

export interface AgentSummary {
  id: string;
  isDefault: boolean;
  model: string;
  sessionCount: number;
}

export interface SessionSummary {
  key: string;
  agentId: string;
  model: string;
  age: string;
  tokensUsed: number;
  contextTokens: number;
}

export interface CronJob {
  id: string;
  name: string;
  cron?: string;
  every?: string;
  at?: string;
  message: string;
  enabled: boolean;
  agentId?: string;
  channel?: string;
  to?: string;
  lastRun?: string;
  nextRun?: string;
}

export interface OpenClawConfig {
  meta?: Record<string, unknown>;
  channels?: Record<string, Record<string, unknown>>;
  gateway?: Record<string, unknown>;
  agents?: Record<string, unknown>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Gateway Status
// ---------------------------------------------------------------------------

/**
 * Get comprehensive gateway status by combining `openclaw health` and
 * `openclaw gateway call status --json`.
 */
export async function getGatewayStatus(): Promise<GatewayStatus> {
  try {
    // Quick health check first
    const healthRaw = await run("health");

    // Gateway status (richer data)
    const statusData = await runJson<Record<string, unknown>>("gateway call status");

    // Parse channel info from status
    const channelSummary = (statusData.channelSummary as string[]) || [];
    const channels = parseChannelSummary(channelSummary);

    // Parse agents
    const heartbeat = statusData.heartbeat as Record<string, unknown> | undefined;
    const agentsList = (heartbeat?.agents as Array<Record<string, unknown>>) || [];
    const agents: AgentSummary[] = agentsList.map((a) => ({
      id: a.agentId as string,
      isDefault: a.agentId === (heartbeat?.defaultAgentId || "main"),
      model: "openrouter/auto",
      sessionCount: 0,
    }));

    // Parse sessions
    const sessionsData = statusData.sessions as Record<string, unknown> | undefined;
    const recentSessions = (sessionsData?.recent as Array<Record<string, unknown>>) || [];
    const sessions: SessionSummary[] = recentSessions.map((s) => ({
      key: s.key as string,
      agentId: s.agentId as string,
      model: s.model as string,
      age: formatAge(s.age as number),
      tokensUsed: (s.totalTokens as number) || 0,
      contextTokens: (s.contextTokens as number) || 0,
    }));

    // Detect version from `openclaw --version`
    let version = "unknown";
    try {
      const vRaw = await run("--version");
      const vMatch = vRaw.match(/(\d{4}\.\d+\.\d+(?:-\d+)?)/);
      if (vMatch) version = vMatch[1];
    } catch { /* non-critical */ }

    return {
      running: true,
      port: parseInt(OPENCLAW_GATEWAY_PORT),
      version,
      channels,
      agents,
      sessions,
    };
  } catch {
    return {
      running: false,
      port: parseInt(OPENCLAW_GATEWAY_PORT),
      version: "unknown",
      channels: [],
      agents: [],
      sessions: [],
    };
  }
}

function parseChannelSummary(lines: string[]): ChannelStatus[] {
  const channels: ChannelStatus[] = [];
  let current: Partial<ChannelStatus> | null = null;

  for (const line of lines) {
    const channelMatch = line.match(/^(\w+):\s*(\w+)/);
    if (channelMatch) {
      if (current) channels.push(current as ChannelStatus);
      current = {
        name: channelMatch[1].toLowerCase(),
        enabled: true,
        state: channelMatch[2].toLowerCase() === "configured" ? "ok" : "error",
        detail: line,
      };
    } else if (current && line.trim().startsWith("-")) {
      current.detail += ` ${line.trim()}`;
    }
  }
  if (current) channels.push(current as ChannelStatus);
  return channels;
}

function formatAge(ms: number): string {
  if (!ms) return "unknown";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Channel Management
// ---------------------------------------------------------------------------

/**
 * List all configured channels.
 */
export async function listChannels(): Promise<ChannelStatus[]> {
  try {
    const raw = await run("channels list");
    const channels: ChannelStatus[] = [];

    // Parse "- Telegram default: configured, token=config, enabled"
    const lines = raw.split("\n");
    for (const line of lines) {
      const match = line.match(
        /^-\s+(\w+)\s+(\w+):\s*(configured|not configured|error)(?:.*?(enabled|disabled))?/i
      );
      if (match) {
        const name = match[1].toLowerCase();
        const isConfigured = match[3].toLowerCase() === "configured";
        const isEnabled = match[4]?.toLowerCase() !== "disabled";
        channels.push({
          name,
          enabled: isConfigured && isEnabled,
          state: isConfigured ? "ok" : "unconfigured",
          detail: line.replace(/^-\s+/, ""),
        });
      }
    }

    // Try health for bot username
    try {
      const healthRaw = await run("health");
      for (const ch of channels) {
        const botMatch = healthRaw.match(
          new RegExp(`${ch.name}:\\s*ok\\s*\\((@\\w+)\\)`, "i")
        );
        if (botMatch) ch.botUsername = botMatch[1];
      }
    } catch {
      // health not critical
    }

    return channels;
  } catch {
    return [];
  }
}

/**
 * Add or update a channel.
 */
export async function addChannel(
  channel: string,
  options: {
    botToken?: string;
    account?: string;
    enabled?: boolean;
  }
): Promise<{ success: boolean; message: string }> {
  let args = `channels add --channel ${channel}`;

  if (options.botToken) {
    args += ` --token "${options.botToken}"`;
  }
  if (options.account) {
    args += ` --account ${options.account}`;
  }

  try {
    const output = await run(args);

    // Enable/disable in config if needed
    if (options.enabled !== undefined) {
      await updateConfig(`channels.${channel}.enabled`, options.enabled);
    }

    return { success: true, message: output || `Channel ${channel} configured` };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Remove/disable a channel.
 */
export async function removeChannel(
  channel: string
): Promise<{ success: boolean; message: string }> {
  try {
    const output = await run(`channels remove --channel ${channel}`);
    return { success: true, message: output || `Channel ${channel} removed` };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Check channel connectivity (deep probe).
 */
export async function probeChannel(channel: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const raw = await run(`health`, 15_000);
    const match = raw.match(new RegExp(`${channel}:\\s*(ok|error)(.*)`, "i"));
    if (match) {
      return {
        ok: match[1].toLowerCase() === "ok",
        detail: `${match[1]}${match[2] || ""}`.trim(),
      };
    }
    return { ok: false, detail: `Channel ${channel} not found in health output` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Cron Job Management
// ---------------------------------------------------------------------------

/**
 * List all cron jobs.
 */
export async function listCronJobs(): Promise<CronJob[]> {
  try {
    const raw = await run("cron list");
    if (raw.includes("No cron jobs")) return [];

    // Try JSON output
    try {
      const data = await runJson<{ jobs?: CronJob[] }>("cron list");
      return data.jobs || [];
    } catch {
      // Parse text output
      return parseCronListText(raw);
    }
  } catch {
    return [];
  }
}

function parseCronListText(raw: string): CronJob[] {
  // Simplified text parser — cron list may vary
  const jobs: CronJob[] = [];
  const lines = raw.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    const match = line.match(/^(\S+)\s+(.+)/);
    if (match && match[1] !== "No") {
      jobs.push({
        id: match[1],
        name: match[2],
        message: "",
        enabled: true,
      });
    }
  }
  return jobs;
}

/**
 * Add a new cron job.
 */
export async function addCronJob(options: {
  name: string;
  message: string;
  cron?: string; // 5-field cron expression
  every?: string; // e.g. "10m", "1h"
  at?: string; // one-shot ISO date or +duration
  agentId?: string;
  channel?: string; // delivery channel (e.g. "telegram")
  to?: string; // delivery target (e.g. chatId)
  announce?: boolean;
}): Promise<{ success: boolean; message: string; jobId?: string }> {
  let args = `cron add --name "${options.name}" --message "${options.message}"`;

  if (options.cron) args += ` --cron "${options.cron}"`;
  if (options.every) args += ` --every ${options.every}`;
  if (options.at) args += ` --at "${options.at}"`;
  if (options.agentId) args += ` --agent ${options.agentId}`;
  if (options.channel) args += ` --channel ${options.channel}`;
  if (options.to) args += ` --to "${options.to}"`;
  if (options.announce) args += ` --announce`;

  try {
    const output = await run(args);
    // Try to extract job ID from output
    const idMatch = output.match(/(?:id|job)[:\s]+(\S+)/i);
    return {
      success: true,
      message: output || "Cron job created",
      jobId: idMatch?.[1],
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Remove a cron job.
 */
export async function removeCronJob(jobId: string): Promise<{ success: boolean; message: string }> {
  try {
    const output = await run(`cron rm ${jobId}`);
    return { success: true, message: output || `Cron job ${jobId} removed` };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Enable/disable a cron job.
 */
export async function toggleCronJob(
  jobId: string,
  enabled: boolean
): Promise<{ success: boolean; message: string }> {
  const subcmd = enabled ? "enable" : "disable";
  try {
    const output = await run(`cron ${subcmd} ${jobId}`);
    return { success: true, message: output || `Cron job ${jobId} ${subcmd}d` };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Run a cron job immediately (for testing).
 */
export async function runCronJob(jobId: string): Promise<{ success: boolean; message: string }> {
  try {
    const output = await run(`cron run ${jobId}`, 60_000);
    return { success: true, message: output || "Job executed" };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Message Sending (outbound via channels)
// ---------------------------------------------------------------------------

/**
 * Send a message through a channel.
 */
export async function sendMessage(options: {
  channel?: string; // telegram, discord, whatsapp
  target: string; // phone number, chatId, channel ID
  message: string;
  media?: string; // file path for attachments
}): Promise<{ success: boolean; message: string }> {
  let args = `message send --target "${options.target}" --message "${options.message.replace(/"/g, '\\"')}"`;

  if (options.channel) args += ` --channel ${options.channel}`;
  if (options.media) args += ` --media "${options.media}"`;

  try {
    const output = await run(args, 30_000);
    return { success: true, message: output || "Message sent" };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Config Helpers
// ---------------------------------------------------------------------------

/**
 * Read the raw OpenClaw config file.
 */
export async function readConfig(): Promise<OpenClawConfig> {
  try {
    const raw = await readFile(OPENCLAW_CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Set a config value by dot path.
 */
export async function updateConfig(dotPath: string, value: unknown): Promise<void> {
  const valStr = typeof value === "string" ? `"${value}"` : String(value);
  await run(`config set ${dotPath} ${valStr}`);
}

/**
 * Write the full OpenClaw config (use carefully).
 */
export async function writeConfig(config: OpenClawConfig): Promise<void> {
  await writeFile(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Gateway Control
// ---------------------------------------------------------------------------

/**
 * Restart the gateway service.
 */
export async function restartGateway(): Promise<{ success: boolean; message: string }> {
  try {
    const output = await run("gateway restart", 15_000);
    return { success: true, message: output || "Gateway restarting..." };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Get gateway service status.
 */
export async function getGatewayServiceStatus(): Promise<{
  installed: boolean;
  running: boolean;
  pid?: number;
  dashboard?: string;
}> {
  try {
    const raw = await run("gateway status");
    const installed =
      raw.includes("LaunchAgent") ||
      raw.includes("systemd") ||
      raw.includes("installed") ||
      raw.includes("loaded");
    const running =
      raw.includes("running") || raw.includes("state active");
    const pidMatch = raw.match(/pid\s+(\d+)/);
    const dashMatch = raw.match(/Dashboard:\s*(https?:\/\/\S+)/);
    return {
      installed,
      running,
      pid: pidMatch ? parseInt(pidMatch[1]) : undefined,
      dashboard: dashMatch?.[1],
    };
  } catch {
    return { installed: false, running: false };
  }
}

