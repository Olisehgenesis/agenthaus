/**
 * Transaction Executor
 *
 * Parses structured transaction commands from LLM responses and executes
 * them on-chain using the agent's HD-derived wallet.
 *
 * Command format embedded in LLM output:
 *   [[SEND_CELO|<to_address>|<amount>]]
 *   [[SEND_TOKEN|<currency>|<to_address>|<amount>]]
 *
 * After execution, the command tags are replaced with a human-readable
 * transaction receipt block.
 */

import { type Address, isAddress } from "viem";
import { sendCelo, sendToken, getWalletBalance, getPublicClient, detectFeeCurrency, getFeeCurrencyLabel } from "./wallet";
import { prisma } from "@/lib/db";
import { CELO_TOKENS, BLOCK_EXPLORER } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransactionIntent {
  action: "send_celo" | "send_token";
  to: string;
  amount: string;
  currency: string;
  raw: string; // original tag text
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  intent: TransactionIntent;
  feeCurrencyUsed?: string; // e.g. "cUSD (fee abstraction)" or "CELO (native)"
}

// ─── Command Parsing ──────────────────────────────────────────────────────────

/**
 * Regex patterns for transaction commands embedded in LLM output.
 *   [[SEND_CELO|0x...|1.5]]
 *   [[SEND_TOKEN|cUSD|0x...|10]]
 */
const SEND_CELO_REGEX = /\[\[SEND_CELO\|([^\|]+)\|([^\]]+)\]\]/g;
const SEND_TOKEN_REGEX = /\[\[SEND_TOKEN\|([^\|]+)\|([^\|]+)\|([^\]]+)\]\]/g;

/**
 * Extract all transaction intents from an LLM response string.
 */
export function parseTransactionIntents(text: string): TransactionIntent[] {
  const intents: TransactionIntent[] = [];

  // Match SEND_CELO commands
  let match;
  const celoRegex = new RegExp(SEND_CELO_REGEX.source, "g");
  while ((match = celoRegex.exec(text)) !== null) {
    intents.push({
      action: "send_celo",
      to: match[1].trim(),
      amount: match[2].trim(),
      currency: "CELO",
      raw: match[0],
    });
  }

  // Match SEND_TOKEN commands
  const tokenRegex = new RegExp(SEND_TOKEN_REGEX.source, "g");
  while ((match = tokenRegex.exec(text)) !== null) {
    intents.push({
      action: "send_token",
      to: match[2].trim(),
      amount: match[3].trim(),
      currency: match[1].trim().toUpperCase(),
      raw: match[0],
    });
  }

  return intents;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateAddress(addr: string): addr is Address {
  return isAddress(addr);
}

function validateAmount(amount: string): boolean {
  const n = parseFloat(amount);
  return !isNaN(n) && n > 0 && n < 1_000_000;
}

function getTokenInfo(currency: string) {
  const key = currency.toUpperCase() as keyof typeof CELO_TOKENS;
  return CELO_TOKENS[key] || null;
}

// ─── Execution ────────────────────────────────────────────────────────────────

/**
 * Execute a single transaction intent using the agent's wallet.
 */
async function executeIntent(
  intent: TransactionIntent,
  walletIndex: number,
  agentId: string
): Promise<TransactionResult> {
  // Validate address
  if (!validateAddress(intent.to)) {
    return {
      success: false,
      error: `Invalid recipient address: ${intent.to}`,
      intent,
    };
  }

  // Validate amount
  if (!validateAmount(intent.amount)) {
    return {
      success: false,
      error: `Invalid amount: ${intent.amount}`,
      intent,
    };
  }

  try {
    let txHash: string;

    // Detect which fee currency will be used (for reporting)
    const { deriveAddress } = await import("./wallet");
    const agentAddress = deriveAddress(walletIndex);
    const feeCurrencyAddr = await detectFeeCurrency(agentAddress);
    const feeCurrencyLabel = getFeeCurrencyLabel(feeCurrencyAddr);

    if (intent.action === "send_celo") {
      txHash = await sendCelo(walletIndex, intent.to as Address, intent.amount);
    } else {
      // send_token
      const tokenInfo = getTokenInfo(intent.currency);
      if (!tokenInfo) {
        return {
          success: false,
          error: `Unsupported currency: ${intent.currency}. Supported: ${Object.keys(CELO_TOKENS).join(", ")}`,
          intent,
        };
      }
      if (tokenInfo.address === "0x0000000000000000000000000000000000000000") {
        // CELO native — use sendCelo
        txHash = await sendCelo(walletIndex, intent.to as Address, intent.amount);
      } else {
        txHash = await sendToken(
          walletIndex,
          tokenInfo.address as Address,
          intent.to as Address,
          intent.amount,
          tokenInfo.decimals
        );
      }
    }

    // Wait for receipt
    const publicClient = getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      timeout: 30_000,
    });

    // Record in DB
    await prisma.transaction.create({
      data: {
        agentId,
        txHash,
        type: "send",
        status: receipt.status === "success" ? "confirmed" : "failed",
        toAddress: intent.to,
        amount: parseFloat(intent.amount),
        currency: intent.currency,
        gasUsed: receipt.gasUsed ? Number(receipt.gasUsed) / 1e18 : null,
        blockNumber: receipt.blockNumber ? Number(receipt.blockNumber) : null,
        description: `Sent ${intent.amount} ${intent.currency} to ${intent.to} (gas: ${feeCurrencyLabel})`,
      },
    });

    return {
      success: receipt.status === "success",
      txHash,
      intent,
      feeCurrencyUsed: feeCurrencyLabel,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Transaction execution failed:`, msg);

    // Record failed tx in DB
    await prisma.transaction.create({
      data: {
        agentId,
        type: "send",
        status: "failed",
        toAddress: intent.to,
        amount: parseFloat(intent.amount),
        currency: intent.currency,
        description: `Failed: ${msg.slice(0, 200)}`,
      },
    });

    return {
      success: false,
      error: msg,
      intent,
    };
  }
}

// ─── Format Results ───────────────────────────────────────────────────────────

function formatTxResult(result: TransactionResult): string {
  if (result.success && result.txHash) {
    return [
      `\n✅ **Transaction Confirmed**`,
      `• Sent: ${result.intent.amount} ${result.intent.currency}`,
      `• To: ${result.intent.to}`,
      `• TX Hash: \`${result.txHash}\``,
      `• Explorer: ${BLOCK_EXPLORER}/tx/${result.txHash}`,
      result.feeCurrencyUsed ? `• Gas paid in: ${result.feeCurrencyUsed}` : "",
    ].filter(Boolean).join("\n");
  } else {
    return [
      `\n❌ **Transaction Failed**`,
      `• Attempted: ${result.intent.amount} ${result.intent.currency} → ${result.intent.to}`,
      `• Error: ${result.error || "Unknown error"}`,
    ].join("\n");
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Process LLM response text: find transaction commands, execute them,
 * and replace the command tags with human-readable results.
 *
 * Returns the updated text with transaction receipts.
 */
export async function executeTransactionsInResponse(
  responseText: string,
  agentId: string,
  walletIndex: number | null
): Promise<{ text: string; executedCount: number; results: TransactionResult[] }> {
  const intents = parseTransactionIntents(responseText);

  if (intents.length === 0) {
    return { text: responseText, executedCount: 0, results: [] };
  }

  // Agent must have a wallet
  if (walletIndex === null) {
    let updatedText = responseText;
    for (const intent of intents) {
      updatedText = updatedText.replace(
        intent.raw,
        "\n⚠️ **Cannot execute transaction** — this agent does not have a wallet initialized. Please initialize a wallet first."
      );
    }
    return { text: updatedText, executedCount: 0, results: [] };
  }

  // Check balance first
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { agentWalletAddress: true, spendingLimit: true, spendingUsed: true },
    });

    if (agent?.agentWalletAddress) {
      const balance = await getWalletBalance(agent.agentWalletAddress as Address);

      // Quick balance check for CELO sends
      const totalCeloNeeded = intents
        .filter((i) => i.currency === "CELO")
        .reduce((sum, i) => sum + parseFloat(i.amount), 0);

      if (totalCeloNeeded > parseFloat(balance.nativeBalance)) {
        let updatedText = responseText;
        for (const intent of intents) {
          if (intent.currency === "CELO") {
            updatedText = updatedText.replace(
              intent.raw,
              `\n⚠️ **Insufficient CELO balance.** Wallet has ${parseFloat(balance.nativeBalance).toFixed(4)} CELO but needs ${totalCeloNeeded} CELO. Please top up the agent wallet.`
            );
          }
        }
        if (intents.every((i) => i.currency === "CELO")) {
          return { text: updatedText, executedCount: 0, results: [] };
        }
      }

      // Spending limit check
      const totalSpend = intents.reduce((sum, i) => sum + parseFloat(i.amount), 0);
      if (agent.spendingLimit && (agent.spendingUsed + totalSpend) > agent.spendingLimit) {
        let updatedText = responseText;
        for (const intent of intents) {
          updatedText = updatedText.replace(
            intent.raw,
            `\n⚠️ **Spending limit reached.** Used: $${agent.spendingUsed.toFixed(2)} / Limit: $${agent.spendingLimit.toFixed(2)}.`
          );
        }
        return { text: updatedText, executedCount: 0, results: [] };
      }
    }
  } catch (err) {
    console.warn("Pre-execution balance check failed:", err);
    // Continue anyway — sendCelo/sendToken will fail with a clear error
  }

  // Execute all intents sequentially
  const results: TransactionResult[] = [];
  let updatedText = responseText;

  for (const intent of intents) {
    const result = await executeIntent(intent, walletIndex, agentId);
    results.push(result);

    // Replace the command tag with the result
    updatedText = updatedText.replace(intent.raw, formatTxResult(result));

    // Update spending
    if (result.success) {
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          spendingUsed: {
            increment: parseFloat(intent.amount),
          },
        },
      });
    }
  }

  // Log execution summary
  const successCount = results.filter((r) => r.success).length;
  await prisma.activityLog.create({
    data: {
      agentId,
      type: successCount === results.length ? "action" : "warning",
      message: `Executed ${successCount}/${results.length} transaction(s)`,
      metadata: JSON.stringify(
        results.map((r) => ({
          success: r.success,
          txHash: r.txHash,
          amount: r.intent.amount,
          currency: r.intent.currency,
          to: r.intent.to,
          error: r.error,
        }))
      ),
    },
  });

  return {
    text: updatedText,
    executedCount: successCount,
    results,
  };
}

