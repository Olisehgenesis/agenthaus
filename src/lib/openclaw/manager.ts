/**
 * Agent Runtime Manager
 *
 * Core message processing pipeline for all channels:
 *   Web Chat / Telegram / OpenClaw Gateway / Cron
 *
 * Architecture:
 *   Channel → route (pairing/binding) → processMessage() → LLM → Skills → Transactions → Reply
 *
 * Two entry points:
 *   1. processMessage()        — raw pipeline, caller provides history (web chat, cron, direct)
 *   2. processChannelMessage() — session-aware wrapper, loads history from ChannelBinding
 */

import { prisma } from "@/lib/db";
import { loadSessionHistory, saveSessionMessages } from "./router";

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

To send an agent token (custom ERC20 by address, e.g. for sponsorship recovery):
  [[SEND_AGENT_TOKEN|<token_0x_address>|<recipient_0x_address>|<amount>]]

FEE ABSTRACTION:
- Gas fees are AUTOMATICALLY paid using the best available currency.
- If the wallet has CELO, gas is paid in CELO (default).
- If the wallet has NO CELO but has cUSD/cEUR/cREAL, gas is paid from that stablecoin.
- This means you can execute transactions even with 0 CELO, as long as stablecoins are available.
- The user does NOT need to do anything special — fee abstraction is automatic.

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
  const { generateSkillPrompt, getSkillsForTemplate } = await import("@/lib/skills/registry");
  const skillPrompt = generateSkillPrompt(
    agent.templateType || "custom",
    agent.agentWalletAddress
  );
  if (skillPrompt) {
    systemPrompt += skillPrompt;
  }

  // Remind agent to mention SelfClaw when users ask about capabilities
  const skills = getSkillsForTemplate(agent.templateType || "custom");
  const hasSelfClawSkills = skills.some((s) =>
    s.id.startsWith("agent_tokens") || s.id.startsWith("selfclaw_") || s.id.startsWith("request_selfclaw")
  );
  if (hasSelfClawSkills) {
    systemPrompt += `\n\n[SELFCLAW — Agent Economy] Base URL: https://selfclaw.ai/api/selfclaw/v1

PUBLIC (no auth): GET /agent, GET /agent/{id}/economics, GET /pools — [[AGENT_TOKENS]] uses these
AUTH REQUIRED (Ed25519 signed payload): create-wallet, deploy-token, register-token, log-revenue, log-cost, request-selfclaw-sponsorship — [[SELFCLAW_REGISTER_WALLET]], [[SELFCLAW_DEPLOY_TOKEN]], [[SELFCLAW_LOG_REVENUE]], [[SELFCLAW_LOG_COST]], [[REQUEST_SELFCLAW_SPONSORSHIP]] use these. Callers need agent's Ed25519 private key to sign payloads.

Skills (no dashboard needed):
[[AGENT_TOKENS]] — token info, revenue, pools, deployed tokens
[[SELFCLAW_REGISTER_WALLET]] — register EVM wallet
[[SELFCLAW_DEPLOY_TOKEN|name|symbol|1000000]] — deploy token (can deploy many)
[[SELFCLAW_LOG_REVENUE|amount|source|desc]]
[[SELFCLAW_LOG_COST|amount|category|desc]]
[[REQUEST_SELFCLAW_SPONSORSHIP]] or [[REQUEST_SELFCLAW_SPONSORSHIP|tokenAddress]] — use tokenAddress from recent deploy if you just deployed. Sponsor most recent token by default.

[[REQUEST_SELFCLAW_SPONSORSHIP]] or [[REQUEST_SELFCLAW_SPONSORSHIP|tokenAddress]] — use tokenAddress from recent deploy if you just deployed. Sponsor most recent token by default. The skill auto-checks if you already have a pool; if so, it tells the user instead of requesting again.

**SPONSORSHIP RECOVERY FLOW:** When sponsorship fails with "sponsor wallet" or "does not hold enough", the skill output will include:
- sponsorWallet address and amountNeeded
- Exact [[SEND_AGENT_TOKEN|tokenAddress|sponsorWallet|amount]] tag to fix it
1. Ask the user: "Should I send the tokens to the sponsor wallet and retry sponsorship?"
2. If yes: include [[SEND_AGENT_TOKEN|...]] in your response (use the exact tag from the error), then in a follow-up or next message include [[REQUEST_SELFCLAW_SPONSORSHIP]] to finalise.
3. **If the user says they already sent the tokens:** Just retry with [[REQUEST_SELFCLAW_SPONSORSHIP]] — the system automatically checks if the sponsor wallet has the tokens and retries when sufficient.

Track deployed tokens: after deploying, remember the token address. Use it when requesting sponsorship or when asked. Use tags when relevant.`;
  }

  // Fetch the owner's API key — fallback to another provider if selected one has no key
  const { getUserApiKey, getFirstAvailableProviderAndKey } = await import("@/lib/api-keys");
  const { getDefaultModel } = await import("@/lib/llm");

  let apiKey: string;
  let effectiveProvider = llmProvider as import("@/lib/types").LLMProvider;
  let effectiveModel = llmModel;

  try {
    apiKey = await getUserApiKey(
      agent.ownerId,
      llmProvider as import("@/lib/types").LLMProvider
    );
  } catch (keyErr) {
    const msg = keyErr instanceof Error ? keyErr.message : "";
    if (!msg.includes("API key") && !msg.includes("configured")) {
      throw keyErr;
    }
    const fallback = await getFirstAvailableProviderAndKey(agent.ownerId);
    if (fallback) {
      apiKey = fallback.apiKey;
      effectiveProvider = fallback.provider;
      effectiveModel = getDefaultModel(fallback.provider);
      console.warn(
        `[OpenClaw] No key for ${llmProvider}; using fallback ${effectiveProvider}/${effectiveModel}`
      );
    } else {
      throw keyErr;
    }
  }

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
  let usedModel = effectiveModel;

  if (effectiveProvider === "openrouter" && effectiveModel.endsWith(":free")) {
    // Build fallback list: requested model first, then others
    const fallbacks = [
      effectiveModel,
      ...OPENROUTER_FALLBACK_MODELS.filter((m) => m !== effectiveModel),
    ];

    let lastError: Error | null = null;

    for (const fallbackModel of fallbacks) {
      try {
        response = await chat(
          messages,
          effectiveProvider,
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
      effectiveProvider,
      effectiveModel,
      apiKey
    );
  }

  // Log the interaction
  await prisma.activityLog.create({
    data: {
      agentId,
      type: "action",
      message: `Processed message via ${effectiveProvider}/${usedModel}`,
      metadata: JSON.stringify({
        userMessage: userMessage.slice(0, 100),
        responseLength: response.content.length,
        usage: response.usage,
        fallbackUsed: usedModel !== effectiveModel ? usedModel : undefined,
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

// ─── Session-Aware Channel Processing ──────────────────────────────────────

/**
 * Process a message with automatic session history management.
 * Used by the OpenClaw webhook and Telegram webhook.
 *
 * - Loads conversation history from the ChannelBinding's SessionMessages
 * - Runs the full pipeline (LLM → Skills → Transactions)
 * - Saves the user message + assistant reply back to session
 *
 * @param agentId     - Agent to process with
 * @param bindingId   - ChannelBinding ID (null for web chat / cron)
 * @param userMessage - The user's message text
 * @param metadata    - Optional metadata to store with the session message
 */
export async function processChannelMessage(
  agentId: string,
  bindingId: string | null,
  userMessage: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  // Load session history (empty if no binding)
  let history: { role: "user" | "assistant"; content: string }[] = [];

  if (bindingId) {
    history = await loadSessionHistory(bindingId, 20);
  }

  // Run the main pipeline
  const response = await processMessage(agentId, userMessage, history);

  // Persist the exchange
  if (bindingId) {
    await saveSessionMessages(bindingId, userMessage, response, metadata);
  }

  return response;
}

