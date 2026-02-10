/**
 * Agent Runtime Manager
 *
 * Core message processing pipeline for all channels (web chat, Telegram, cron jobs).
 * Routes messages through: LLM → Skill Execution → Transaction Execution
 *
 * Architecture:
 *   Web Chat / Telegram / Cron → processMessage() → LLM → Skills → Transactions → Reply
 */

import { prisma } from "@/lib/db";

// OpenRouter free model fallback order for rate-limit / provider-error retries.
// Only models that reliably support system prompts on the free tier.
// Gemma models excluded — Google AI Studio doesn't allow system instructions on free tier.
const OPENROUTER_FALLBACK_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen3-4b:free",
  "deepseek/deepseek-r1-0528:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
];

/**
 * Process a chat message through an agent's OpenClaw runtime
 * This is the core function that routes messages to the LLM
 * 
 * Uses the agent owner's per-user API key (stored encrypted in DB).
 * For OpenRouter, if a free model is rate-limited (429), automatically
 * retries with alternative free models.
 */
export async function processMessage(
  agentId: string,
  userMessage: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = []
): Promise<string> {
  // Load agent config from DB
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      templateType: true,
      systemPrompt: true,
      llmProvider: true,
      llmModel: true,
      ownerId: true,
      agentWalletAddress: true,
      walletDerivationIndex: true,
    },
  });

  if (!agent) throw new Error(`Agent ${agentId} not found`);

  let systemPrompt = agent.systemPrompt || "You are a helpful AI agent on the Celo blockchain.";
  const llmProvider = agent.llmProvider;
  const llmModel = agent.llmModel;

  // ─── Inject transaction execution instructions ──────────────────────
  // This is appended at runtime so even agents with old prompts can execute real txs.
  if (agent.agentWalletAddress) {
    systemPrompt += `

[TRANSACTION EXECUTION — CRITICAL INSTRUCTIONS]
Your wallet address: ${agent.agentWalletAddress} (Celo Sepolia testnet, funded with real test tokens).

You MUST use the following command tags to execute REAL on-chain transactions.
DO NOT fabricate transaction hashes, block numbers, or receipts.
DO NOT pretend a transaction was executed — only the command tags below trigger real execution.

To send native CELO:
  [[SEND_CELO|<recipient_0x_address>|<amount>]]

To send ERC-20 tokens (cUSD, cEUR, cREAL):
  [[SEND_TOKEN|<currency>|<recipient_0x_address>|<amount>]]

RULES:
- The command tag MUST appear in your response text exactly as shown (with double square brackets).
- The recipient MUST be a valid 0x address (42 hex characters). If the user gives an ENS or non-0x name, ask for the real address.
- After you include the tag, the system will execute the transaction and replace the tag with a real receipt (tx hash, block number, explorer link).
- Always ask the user to confirm before including the command tag for amounts over 10.
- Never reveal private keys.

Example — user says "send 2 CELO to 0xABC...123":
  Your response: "Sending 2 CELO now. [[SEND_CELO|0xABC...123|2]]"

Example — user says "send 5 cUSD to 0xDEF...456":
  Your response: "Sending 5 cUSD now. [[SEND_TOKEN|cUSD|0xDEF...456|5]]"
`;
  } else {
    systemPrompt += `\n\n[WALLET CONTEXT] This agent does not have a wallet initialized yet. You CANNOT execute any transactions. Tell the user to click "Initialize Wallet" on the agent dashboard first.`;
  }

  // ─── Inject skill instructions ─────────────────────────────────────
  // Each template has a set of skills (oracle reads, Mento quotes, balance checks, etc.)
  const { generateSkillPrompt } = await import("@/lib/skills/registry");
  const skillPrompt = generateSkillPrompt(
    agent.templateType || "custom",
    agent.agentWalletAddress
  );
  if (skillPrompt) {
    systemPrompt += skillPrompt;
  }

  // Fetch the owner's API key for this provider
  const { getUserApiKey } = await import("@/lib/api-keys");
  const apiKey = await getUserApiKey(
    agent.ownerId,
    llmProvider as import("@/lib/types").LLMProvider
  );

  // Build messages array
  const { chat } = await import("@/lib/llm");
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  // For OpenRouter free models: retry with fallback models on 429
  let response;
  let usedModel = llmModel;

  if (llmProvider === "openrouter" && llmModel.endsWith(":free")) {
    // Build fallback list: requested model first, then others
    const fallbacks = [
      llmModel,
      ...OPENROUTER_FALLBACK_MODELS.filter((m) => m !== llmModel),
    ];

    let lastError: Error | null = null;

    for (const fallbackModel of fallbacks) {
      try {
        response = await chat(
          messages,
          llmProvider as import("@/lib/types").LLMProvider,
          fallbackModel,
          apiKey
        );
        usedModel = fallbackModel;
        break; // Success — stop retrying
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message;
        // Retry on 429 (rate limit) and 400 (provider errors like unsupported features)
        // Only fail immediately on auth errors (401/403) or unknown errors
        const isRetryable = msg.includes("429") || msg.includes("400");
        if (!isRetryable) {
          throw lastError;
        }
        const code = msg.includes("429") ? "429 rate-limited" : "400 provider error";
        console.warn(`OpenRouter ${code} on ${fallbackModel}, trying next model...`);
      }
    }

    if (!response) {
      throw lastError || new Error("All OpenRouter free models are rate-limited. Please try again shortly.");
    }
  } else {
    // Non-OpenRouter or paid model — single attempt
    response = await chat(
    messages,
      llmProvider as import("@/lib/types").LLMProvider,
    llmModel,
    apiKey
  );
  }

  // Log the interaction
  await prisma.activityLog.create({
    data: {
      agentId,
      type: "action",
      message: `Processed message via ${llmProvider}/${usedModel}`,
      metadata: JSON.stringify({
        userMessage: userMessage.slice(0, 100),
        responseLength: response.content.length,
        usage: response.usage,
        fallbackUsed: usedModel !== llmModel ? usedModel : undefined,
      }),
    },
  });

  // ─── Skill Execution ─────────────────────────────────────────────────
  // Execute any skill commands (oracle reads, Mento quotes, balance checks, etc.)
  const { executeSkillCommands } = await import("@/lib/skills/registry");
  const skillResult = await executeSkillCommands(response.content, {
    agentId,
    walletDerivationIndex: agent.walletDerivationIndex,
    agentWalletAddress: agent.agentWalletAddress,
  });

  if (skillResult.executedCount > 0) {
    await prisma.activityLog.create({
      data: {
        agentId,
        type: "action",
        message: `Executed ${skillResult.executedCount} skill(s): ${agent.templateType} template`,
      },
    });
  }

  // ─── Transaction Execution ───────────────────────────────────────────
  // Check if the LLM response contains transaction commands and execute them
  const { executeTransactionsInResponse } = await import("@/lib/blockchain/executor");
  const txResult = await executeTransactionsInResponse(
    skillResult.text, // use skill-processed text
    agentId,
    agent.walletDerivationIndex
  );

  if (txResult.executedCount > 0) {
    await prisma.activityLog.create({
      data: {
        agentId,
        type: "action",
        message: `Executed ${txResult.executedCount} on-chain transaction(s) from chat`,
      },
    });
  }

  return txResult.text;
}

