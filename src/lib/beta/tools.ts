/**
 * Beta Create — server-side tools for chat-to-deploy
 * @see docs/BETA_CREATE_PLAN.md
 */

import { prisma } from "@/lib/db";
import { getNextDerivationIndex, deriveAddress } from "@/lib/blockchain/wallet";
import { AGENT_TEMPLATES } from "@/lib/constants";
import type { AgentTemplate } from "@/lib/types";

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

export async function getMyAgents(ownerAddress: string): Promise<{
  agents: Array<{ id: string; name: string; templateType: string; status: string }>;
  stats: { totalAgents: number; activeAgents: number; totalTransactions: number };
}> {
  const user = await prisma.user.findUnique({
    where: { walletAddress: ownerAddress },
  });

  if (!user) {
    return { agents: [], stats: { totalAgents: 0, activeAgents: 0, totalTransactions: 0 } };
  }

  const agents = await prisma.agent.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { transactions: true },
  });

  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const totalTransactions = agents.reduce((sum, a) => sum + a.transactions.length, 0);

  return {
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      templateType: a.templateType,
      status: a.status,
    })),
    stats: { totalAgents, activeAgents, totalTransactions },
  };
}
