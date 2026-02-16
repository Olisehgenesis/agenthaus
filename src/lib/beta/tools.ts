/**
 * Beta Create — server-side tools for chat-to-deploy
 * @see docs/BETA_CREATE_PLAN.md
 */

import { prisma } from "@/lib/db";
import { getNextDerivationIndex, deriveAddress } from "@/lib/blockchain/wallet";
import { AGENT_TEMPLATES } from "@/lib/constants";
import { deployTokenForAgent, requestSponsorshipForAgent } from "@/lib/selfclaw/agentActions";
import { generateQRDataUrl } from "@/lib/qr/generate";
import type { AgentTemplate } from "@/lib/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Max edit distance for fuzzy match (covers "gene"→"Gnes", "gnes"→"Gnes") */
const FUZZY_THRESHOLD = 3;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

export type ResolveResult =
  | { resolved: { id: string; name: string } }
  | { ambiguous: string[] }
  | { notFound: true };

/**
 * Resolve agent by ID (UUID) or by name.
 * Supports fuzzy matching (1–2 chars off). If ambiguous, returns candidates to ask the user.
 */
export async function resolveAgentByIdOrName(
  ownerAddress: string,
  identifier: string
): Promise<ResolveResult> {
  const user = await prisma.user.findUnique({
    where: { walletAddress: ownerAddress },
  });
  if (!user) return { notFound: true };

  const trimmed = identifier.trim();
  if (!trimmed) return { notFound: true };

  if (UUID_REGEX.test(trimmed)) {
    const agent = await prisma.agent.findFirst({
      where: { id: trimmed, ownerId: user.id },
      select: { id: true, name: true },
    });
    return agent ? { resolved: agent } : { notFound: true };
  }

  const inputLower = trimmed.toLowerCase();
  const agents = await prisma.agent.findMany({
    where: { ownerId: user.id },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  // Exact: full match or prefix
  const exact = agents.find(
    (a) =>
      a.name.toLowerCase() === inputLower ||
      a.name.toLowerCase().startsWith(inputLower) ||
      inputLower.startsWith(a.name.toLowerCase())
  );
  if (exact) return { resolved: exact };

  // Fuzzy: within 1–2 chars
  const candidates = agents
    .map((a) => ({ agent: a, dist: levenshtein(inputLower, a.name.toLowerCase()) }))
    .filter((c) => c.dist <= FUZZY_THRESHOLD)
    .sort((a, b) => a.dist - b.dist);

  if (candidates.length === 0) return { notFound: true };
  if (candidates.length === 1 || candidates[0].dist < candidates[1].dist) {
    return { resolved: candidates[0].agent };
  }
  // Tie or close — ask user
  const bestDist = candidates[0].dist;
  const best = candidates.filter((c) => c.dist === bestDist).map((c) => c.agent.name);
  return { ambiguous: [...new Set(best)] };
}

export function listTemplates(): string {
  return JSON.stringify(
    AGENT_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      features: t.features,
    })),
    null,
    2
  );
}

export async function createAgent(params: {
  name: string;
  templateType: AgentTemplate;
  description?: string;
  ownerAddress: string;
  spendingLimit?: number;
}): Promise<{ agentId: string; agentName: string; link: string }> {
  const {
    name,
    templateType,
    description,
    ownerAddress,
    spendingLimit = 100,
  } = params;

  let user = await prisma.user.findUnique({
    where: { walletAddress: ownerAddress },
  });

  if (!user) {
    user = await prisma.user.create({
      data: { walletAddress: ownerAddress },
    });
  }

  let agentWalletAddress: string | null = null;
  let walletDerivationIndex: number | null = null;

  try {
    walletDerivationIndex = await getNextDerivationIndex();
    agentWalletAddress = deriveAddress(walletDerivationIndex);
  } catch {
    // AGENT_MNEMONIC not set
  }

  const template = AGENT_TEMPLATES.find((t) => t.id === templateType);
  const systemPrompt = template?.defaultPrompt ?? "You are a helpful AI agent on Celo.";
  const configuration = template?.defaultConfig ? JSON.stringify(template.defaultConfig) : null;

  const agent = await prisma.agent.create({
    data: {
      name,
      description: description || null,
      templateType,
      systemPrompt,
      llmProvider: "openrouter",
      llmModel: "meta-llama/llama-3.3-70b-instruct:free",
      spendingLimit,
      configuration,
      ownerId: user.id,
      agentWalletAddress,
      walletDerivationIndex,
      status: "deploying",
      deployedAt: null,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = `${baseUrl}/dashboard/agents/${agent.id}`;

  await prisma.activityLog.create({
    data: {
      agentId: agent.id,
      type: "info",
      message: `Agent "${name}" created via Beta Create chat`,
    },
  });

  return {
    agentId: agent.id,
    agentName: agent.name,
    link,
  };
}

export async function getAgentDetails(
  agentId: string,
  ownerAddress: string
): Promise<Record<string, unknown> | null> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { transactions: true, verification: true },
  });

  if (!agent) return null;

  const user = await prisma.user.findUnique({
    where: { walletAddress: ownerAddress },
  });
  if (!user || agent.ownerId !== user.id) return null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = `${baseUrl}/dashboard/agents/${agent.id}`;

  const verified = !!agent.verification?.selfxyzVerified;

  const result: Record<string, unknown> = {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    templateType: agent.templateType,
    status: agent.status,
    spendingLimit: agent.spendingLimit,
    spendingUsed: agent.spendingUsed,
    agentWalletAddress: agent.agentWalletAddress,
    erc8004AgentId: agent.erc8004AgentId,
    erc8004ChainId: agent.erc8004ChainId,
    erc8004TxHash: agent.erc8004TxHash,
    reputationScore: agent.reputationScore,
    createdAt: agent.createdAt.toISOString(),
    deployedAt: agent.deployedAt?.toISOString() ?? null,
    transactionCount: agent.transactions.length,
    verified,
    link,
  };

  if (verified) {
    result.selfclawNextSteps = [
      "Deploy token — Create an ERC-20 for your agent (chat with the agent or use Token & Trade tab)",
      "Log revenue/costs — Track economics (chat: 'log $50 revenue' or 'log $10 compute cost')",
      "Request sponsorship — Get SELFCLAW liquidity (one per human, chat: 'request sponsorship')",
      "View economics — See P&L, runway (Token & Trade tab or chat: 'show my token info')",
    ];
  }

  return result;
}

export async function getMyAgents(ownerAddress: string): Promise<{
  agents: Array<{ id: string; name: string; templateType: string; status: string; verified: boolean }>;
  stats: { totalAgents: number; activeAgents: number; verifiedAgents: number; totalTransactions: number };
}> {
  const user = await prisma.user.findUnique({
    where: { walletAddress: ownerAddress },
  });

  if (!user) {
    return { agents: [], stats: { totalAgents: 0, activeAgents: 0, verifiedAgents: 0, totalTransactions: 0 } };
  }

  const agents = await prisma.agent.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { transactions: true, verification: true },
  });

  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const verifiedAgents = agents.filter((a) => a.verification?.selfxyzVerified === true).length;
  const totalTransactions = agents.reduce((sum, a) => sum + a.transactions.length, 0);

  return {
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      templateType: a.templateType,
      status: a.status,
      verified: !!a.verification?.selfxyzVerified,
    })),
    stats: { totalAgents, activeAgents, verifiedAgents, totalTransactions },
  };
}

/**
 * Deploy an ERC-20 token for an existing verified agent.
 * Requires agent to be SelfClaw verified.
 */
export async function deployToken(
  ownerAddress: string,
  agentIdOrName: string,
  tokenName: string,
  tokenSymbol: string,
  initialSupply: string = "10000000000"
): Promise<{ success: boolean; agentName?: string; tokenAddress?: string; txHash?: string; error?: string }> {
  const result = await resolveAgentByIdOrName(ownerAddress, agentIdOrName);
  if ("ambiguous" in result) {
    return { success: false, error: `Which agent? ${result.ambiguous.join(" or ")}` };
  }
  if ("notFound" in result) {
    return { success: false, error: "Agent not found. Use the exact name (e.g. Gnes)." };
  }

  const deployResult = await deployTokenForAgent(
    result.resolved.id,
    tokenName.trim(),
    tokenSymbol.trim().toUpperCase(),
    initialSupply
  );

  if (!deployResult.success) {
    return {
      success: false,
      error: deployResult.error ?? "Failed to deploy token",
      agentName: result.resolved.name,
    };
  }

  return {
    success: true,
    agentName: result.resolved.name,
    tokenAddress: deployResult.tokenAddress,
    txHash: deployResult.txHash,
  };
}

/**
 * Request SELFCLAW liquidity sponsorship for an existing verified agent.
 * Requires agent to have a deployed token.
 */
export async function requestSponsorship(
  ownerAddress: string,
  agentIdOrName: string,
  tokenAddress?: string
): Promise<{ success: boolean; agentName?: string; error?: string }> {
  const result = await resolveAgentByIdOrName(ownerAddress, agentIdOrName);
  if ("ambiguous" in result) {
    return { success: false, error: `Which agent? ${result.ambiguous.join(" or ")}` };
  }
  if ("notFound" in result) {
    return { success: false, error: "Agent not found. Use the exact name (e.g. Gnes)." };
  }

  const sponsorResult = await requestSponsorshipForAgent(result.resolved.id, undefined, tokenAddress);

  if (!sponsorResult.success) {
    return {
      success: false,
      error: sponsorResult.error ?? "Failed to request sponsorship",
      agentName: result.resolved.name,
    };
  }

  return {
    success: true,
    agentName: result.resolved.name,
  };
}

/** Gas/insufficient funds error patterns */
export function isGasOrInsufficientFundsError(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes("insufficient funds") ||
    lower.includes("exceeds the balance") ||
    lower.includes("balance 0") ||
    lower.includes("overshot") ||
    lower.includes("total cost") ||
    lower.includes("gas * price")
  );
}

/**
 * Get agent wallet info for funding — address, public key (Ed25519), QR code.
 * NEVER returns or exposes private key.
 */
export async function getAgentWalletInfo(
  ownerAddress: string,
  agentIdOrName: string
): Promise<{
  success: boolean;
  agentName?: string;
  walletAddress?: string;
  publicKey?: string;
  qrDataUrl?: string;
  error?: string;
}> {
  const result = await resolveAgentByIdOrName(ownerAddress, agentIdOrName);
  if ("ambiguous" in result) {
    return { success: false, error: `Which agent? ${result.ambiguous.join(" or ")}` };
  }
  if ("notFound" in result) {
    return { success: false, error: "Agent not found. Use the exact name (e.g. Gnes)." };
  }

  const agent = await prisma.agent.findUnique({
    where: { id: result.resolved.id },
    select: {
      name: true,
      agentWalletAddress: true,
      verification: { select: { publicKey: true } },
    },
  });

  if (!agent?.agentWalletAddress) {
    return {
      success: false,
      error: "Agent has no wallet yet. Complete verification first.",
      agentName: result.resolved.name,
    };
  }

  try {
    const qrDataUrl = await generateQRDataUrl(agent.agentWalletAddress);
    return {
      success: true,
      agentName: agent.name,
      walletAddress: agent.agentWalletAddress,
      publicKey: agent.verification?.publicKey ?? undefined,
      qrDataUrl,
    };
  } catch (err) {
    return {
      success: true,
      agentName: agent.name,
      walletAddress: agent.agentWalletAddress,
      publicKey: agent.verification?.publicKey ?? undefined,
      error: err instanceof Error ? err.message : "Failed to generate QR",
    };
  }
}
