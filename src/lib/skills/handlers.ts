/**
 * Skill Handlers
 *
 * Each handler implements the execute() logic for a single skill.
 * These are pure async functions taking (params, ctx) → SkillResult.
 *
 * Handlers lazy-import heavy blockchain libs so the module tree-shakes well.
 */

import { type Address, isAddress } from "viem";
import {
  getNetworkStatus,
  getBlock,
  getLatestBlocks,
  getTransaction,
  getTokenInfo,
  getTokenBalance,
  getNftInfo,
  getNftBalance,
  getGasFeeData,
  getGovernanceProposals,
  getProposalDetails,
  estimateContractGas,
} from "@/lib/blockchain/celoData";
import type { SkillContext, SkillResult } from "./types";

// ─── Oracle / Rate handlers ──────────────────────────────────────────────────

export async function executeQueryRate(params: string[], _ctx: SkillContext): Promise<SkillResult> {
  const currency = params[0] || "cUSD";
  const { getOracleRate } = await import("@/lib/blockchain/mento");

  try {
    const rate = await getOracleRate(currency);
    const display = [
      `📊 **${rate.pair} Exchange Rate**`,
      `• 1 CELO = ${rate.rate.toFixed(4)} ${currency}`,
      `• 1 ${currency} = ${rate.inverse.toFixed(4)} CELO`,
      `• Reporters: ${rate.numReporters}`,
      `• Last update: ${rate.lastUpdate.toISOString()}`,
      `• Source: ${rate.source === "sorted_oracles" ? "Celo SortedOracles (on-chain)" : "Estimated (API fallback)"}`,
      rate.isExpired ? "⚠️ Warning: Oracle data may be stale" : "",
    ].filter(Boolean).join("\n");

    return { success: true, data: rate as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `❌ Failed to query ${currency} rate: ${error}` };
  }
}

export async function executeQueryAllRates(_params: string[], _ctx: SkillContext): Promise<SkillResult> {
  const { getAllOracleRates } = await import("@/lib/blockchain/mento");

  try {
    const rates = await getAllOracleRates();
    const lines = rates.map((r) =>
      `• ${r.pair}: 1 CELO = ${r.rate.toFixed(4)} ${r.pair.split("/")[1]} (${r.source})`
    );

    const display = [
      "📊 **Celo Exchange Rates (SortedOracles)**",
      ...lines,
      "",
      `_Updated: ${new Date().toISOString()}_`,
    ].join("\n");

    return { success: true, data: { rates } as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `❌ Failed to query rates: ${error}` };
  }
}

// ─── Mento handlers ──────────────────────────────────────────────────────────

export async function executeMentoQuote(params: string[], _ctx: SkillContext): Promise<SkillResult> {
  const [sellCurrency, buyCurrency, amount] = params;
  if (!sellCurrency || !buyCurrency || !amount) {
    return { success: false, error: "Missing parameters", display: "❌ Usage: [[MENTO_QUOTE|sell_currency|buy_currency|amount]]" };
  }

  const { getMentoQuote } = await import("@/lib/blockchain/mento");

  try {
    const quote = await getMentoQuote(sellCurrency, buyCurrency, amount);
    const display = [
      `💱 **Mento Swap Quote**`,
      `• Sell: ${quote.sellAmount} ${quote.sellCurrency}`,
      `• Buy: ~${parseFloat(quote.buyAmount).toFixed(4)} ${quote.buyCurrency}`,
      `• Rate: 1 ${quote.sellCurrency} = ${quote.rate.toFixed(4)} ${quote.buyCurrency}`,
      `• Est. slippage: ${quote.slippage}%`,
      `• Source: ${quote.source}`,
      "",
      `_To execute: "swap ${quote.sellAmount} ${quote.sellCurrency} for ${quote.buyCurrency}"_`,
    ].join("\n");

    return { success: true, data: quote as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `❌ Failed to get quote: ${error}` };
  }
}

export async function executeMentoSwap(params: string[], ctx: SkillContext): Promise<SkillResult> {
  const [sellCurrency, buyCurrency, amount] = params;
  if (!sellCurrency || !buyCurrency || !amount) {
    return { success: false, error: "Missing parameters", display: "❌ Usage: [[MENTO_SWAP|sell_currency|buy_currency|amount]]" };
  }

  if (!ctx.agentWalletAddress || ctx.walletDerivationIndex === null) {
    return { success: false, error: "No wallet", display: "⚠️ Agent wallet not initialized. Cannot execute swap." };
  }

  const { getMentoQuote } = await import("@/lib/blockchain/mento");

  try {
    const quote = await getMentoQuote(sellCurrency, buyCurrency, amount);

    const display = [
      `💱 **Mento Swap (Simulated on Testnet)**`,
      `• Sold: ${quote.sellAmount} ${quote.sellCurrency}`,
      `• Bought: ~${parseFloat(quote.buyAmount).toFixed(4)} ${quote.buyCurrency}`,
      `• Rate: 1 ${quote.sellCurrency} = ${quote.rate.toFixed(4)} ${quote.buyCurrency}`,
      `• Slippage: ${quote.slippage}%`,
      "",
      `⚠️ _On Celo Sepolia testnet, Mento swaps are simulated. Real execution available on mainnet._`,
    ].join("\n");

    return { success: true, data: quote as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `❌ Swap failed: ${error}` };
  }
}

// ─── Data handlers ───────────────────────────────────────────────────────────

export async function executeCheckBalance(params: string[], ctx: SkillContext): Promise<SkillResult> {
  let address = params[0];
  if (!address && ctx.agentWalletAddress) {
    address = ctx.agentWalletAddress;
  }
  if (!address || !isAddress(address)) {
    return { success: false, error: "Invalid address", display: "❌ Please provide a valid 0x address." };
  }

  const { checkBalance } = await import("@/lib/blockchain/mento");

  try {
    const bal = await checkBalance(address as Address);
    const display = [
      `💰 **Balance for ${address.slice(0, 6)}...${address.slice(-4)}**`,
      `• CELO: ${parseFloat(bal.celo).toFixed(4)}`,
      `• cUSD: ${parseFloat(bal.cUSD).toFixed(4)}`,
      `• cEUR: ${parseFloat(bal.cEUR).toFixed(4)}`,
      `• cREAL: ${parseFloat(bal.cREAL).toFixed(4)}`,
    ].join("\n");

    return { success: true, data: bal as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `❌ Failed to check balance: ${error}` };
  }
}

export async function executeGasPrice(_params: string[], _ctx: SkillContext): Promise<SkillResult> {
  const { getGasPrice } = await import("@/lib/blockchain/mento");

  try {
    const gas = await getGasPrice();
    const display = [
      `⛽ **Celo Gas Price**`,
      `• Base fee: ${parseFloat(gas.baseFee).toFixed(2)} gwei`,
      `• Suggested tip: ${gas.suggestedTip} gwei`,
      `• Simple transfer cost: ~${parseFloat(gas.estimatedCost).toFixed(6)} CELO`,
    ].join("\n");

    return { success: true, data: gas as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `❌ Failed to get gas price: ${error}` };
  }
}

// ─── Forex / Analysis handlers ───────────────────────────────────────────────

export async function executeForexAnalysis(params: string[], _ctx: SkillContext): Promise<SkillResult> {
  const pair = params[0] || "";
  const { getAllOracleRates, getOracleRate } = await import("@/lib/blockchain/mento");
  const { analyzeTrend, predictPrice, recordAllPriceSnapshots, getPriceHistory } = await import("@/lib/blockchain/price-tracker");

  // Always record fresh snapshots so trend data stays current
  await recordAllPriceSnapshots().catch(() => {});

  try {
    if (pair && pair.includes("/")) {
      // Specific pair analysis
      const [, buy] = pair.split("/");
      const rate = await getOracleRate(buy);

      // Include trend data
      const trend = analyzeTrend(rate.pair, 60);
      const prediction = predictPrice(rate.pair);
      const history = getPriceHistory(rate.pair, 10);

      const display = [
        `📈 **Forex Analysis: ${rate.pair}**`,
        ``,
        `**Current Rate:**`,
        `• 1 CELO = ${rate.rate.toFixed(4)} ${buy}`,
        `• 1 ${buy} = ${rate.inverse.toFixed(4)} CELO`,
        ``,
        `**Oracle Status:**`,
        `• Active reporters: ${rate.numReporters}`,
        `• Last update: ${rate.lastUpdate.toISOString()}`,
        `• Data fresh: ${rate.isExpired ? "❌ Stale" : "✅ Fresh"}`,
        `• Source: ${rate.source}`,
        ``,
        trend ? [
          `**Trend (${trend.period}):**`,
          `• Direction: ${trend.direction === "up" ? "📈 Up" : trend.direction === "down" ? "📉 Down" : "➡️ Flat"}`,
          `• Change: ${trend.change > 0 ? "+" : ""}${trend.changePercent.toFixed(3)}%`,
          `• Previous: ${trend.previousRate.toFixed(6)} → Current: ${trend.currentRate.toFixed(6)}`,
          `• Data points: ${trend.snapshots}`,
        ].join("\n") : "**Trend:** Not enough data yet (start price tracking first)",
        ``,
        prediction ? [
          `**Prediction (${prediction.timeframe}):**`,
          `• Direction: ${prediction.predictedDirection === "up" ? "📈" : prediction.predictedDirection === "down" ? "📉" : "➡️"} ${prediction.predictedDirection.toUpperCase()}`,
          `• Predicted rate: ${prediction.predictedRate.toFixed(6)}`,
          `• Confidence: ${prediction.confidence === "high" ? "🟢" : prediction.confidence === "medium" ? "🟡" : "🔴"} ${prediction.confidence}`,
          `• Reasoning: ${prediction.reasoning}`,
        ].join("\n") : "**Prediction:** Need ≥ 5 data points — run price tracking first",
        ``,
        `**Analysis:**`,
        rate.numReporters >= 3
          ? `• Oracle has sufficient reporters (${rate.numReporters}) — rate is reliable.`
          : `• ⚠️ Low reporter count (${rate.numReporters}) — rate may be less reliable.`,
        rate.isExpired
          ? `• ⚠️ Oracle data is expired — exercise caution with trades.`
          : `• Oracle data is fresh — safe to trade at quoted rates.`,
        history.length > 0 ? `• ${history.length} price snapshots recorded in current session.` : "",
      ].filter(Boolean).join("\n");

      return { success: true, data: rate as unknown as Record<string, unknown>, display };
    }

    // Full market overview
    const rates = await getAllOracleRates();
    const lines = rates.map((r) => {
      const freshIcon = r.isExpired ? "⚠️" : "✅";
      const trend = analyzeTrend(r.pair, 60);
      const trendIcon = trend
        ? (trend.direction === "up" ? "📈" : trend.direction === "down" ? "📉" : "➡️")
        : "•";
      const changeStr = trend
        ? ` (${trend.change > 0 ? "+" : ""}${trend.changePercent.toFixed(2)}%)`
        : "";
      return `${trendIcon} ${r.pair}: ${r.rate.toFixed(4)}${changeStr} (reporters: ${r.numReporters}) ${freshIcon}`;
    });

    const display = [
      `📈 **Celo Forex Market Overview**`,
      ``,
      `**Current Rates (SortedOracles):**`,
      ...lines,
      ``,
      `**Summary:**`,
      `• ${rates.length} active pairs monitored`,
      `• All rates sourced from Celo SortedOracles (on-chain)`,
      `• Gas fees can be paid in cUSD via fee abstraction — no CELO needed!`,
      `• Use "swap X CELO for cUSD" to execute a Mento trade`,
    ].join("\n");

    return { success: true, data: { rates } as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `❌ Analysis failed: ${error}` };
  }
}

export async function executePortfolioStatus(_params: string[], ctx: SkillContext): Promise<SkillResult> {
  if (!ctx.agentWalletAddress) {
    return { success: false, error: "No wallet", display: "⚠️ Agent wallet not initialized." };
  }

  const { checkBalance } = await import("@/lib/blockchain/mento");
  const { getOracleRate } = await import("@/lib/blockchain/mento");

  try {
    const bal = await checkBalance(ctx.agentWalletAddress as Address);
    const celoRate = await getOracleRate("cUSD");

    const celoVal = parseFloat(bal.celo);
    const cusdVal = parseFloat(bal.cUSD);
    const ceurVal = parseFloat(bal.cEUR);
    const crealVal = parseFloat(bal.cREAL);

    // Value everything in USD terms
    const celoUsd = celoVal * celoRate.rate;
    const totalUsd = celoUsd + cusdVal + ceurVal * 1.08 + crealVal * 0.20; // Approximate

    const display = [
      `💼 **Agent Portfolio**`,
      `• Wallet: ${ctx.agentWalletAddress.slice(0, 6)}...${ctx.agentWalletAddress.slice(-4)}`,
      ``,
      `**Holdings:**`,
      `• CELO: ${celoVal.toFixed(4)} (~$${celoUsd.toFixed(2)})`,
      `• cUSD: ${cusdVal.toFixed(4)} (~$${cusdVal.toFixed(2)})`,
      `• cEUR: ${ceurVal.toFixed(4)} (~$${(ceurVal * 1.08).toFixed(2)})`,
      `• cREAL: ${crealVal.toFixed(4)} (~$${(crealVal * 0.20).toFixed(2)})`,
      ``,
      `**Total Value: ~$${totalUsd.toFixed(2)}**`,
      ``,
      `_CELO/cUSD rate: ${celoRate.rate.toFixed(4)} (${celoRate.source})_`,
    ].join("\n");

    return { success: true, data: { ...bal, totalUsd } as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `❌ Portfolio check failed: ${error}` };
  }
}

// ── Price Tracking, Trend, Prediction, Alerts ────────────────────────────────

export async function executePriceTrack(params: string[], _ctx: SkillContext): Promise<SkillResult> {
  const target = (params[0] || "all").toUpperCase();
  const { recordAllPriceSnapshots, recordPriceSnapshot, getPriceHistory } = await import("@/lib/blockchain/price-tracker");

  try {
    if (target === "ALL") {
      const snapshots = await recordAllPriceSnapshots();
      const lines = snapshots.map((s) =>
        `• ${s.pair}: ${s.rate.toFixed(6)} (${s.source}) — recorded at ${s.timestamp.toISOString()}`
      );

      const historyLines: string[] = [];
      for (const s of snapshots) {
        const hist = getPriceHistory(s.pair, 5);
        if (hist.length > 1) {
          const oldest = hist[0];
          const newest = hist[hist.length - 1];
          const change = ((newest.rate - oldest.rate) / oldest.rate) * 100;
          historyLines.push(`• ${s.pair}: ${change > 0 ? "+" : ""}${change.toFixed(3)}% over ${hist.length} snapshots`);
        }
      }

      const display = [
        `📊 **Price Snapshot Recorded** (${snapshots.length} pairs)`,
        ``,
        ...lines,
        historyLines.length > 0 ? `\n**Recent Changes:**` : "",
        ...historyLines,
      ].filter(Boolean).join("\n");

      return { success: true, data: { snapshots: snapshots.length } as Record<string, unknown>, display };
    }

    // Single pair
    const snapshot = await recordPriceSnapshot(target);
    const history = getPriceHistory(snapshot.pair, 10);
    const historyLines = history.map((h) =>
      `  ${h.timestamp.toLocaleTimeString()}: ${h.rate.toFixed(6)}`
    );

    const display = [
      `📊 **Price Recorded: ${snapshot.pair}**`,
      `• Current rate: ${snapshot.rate.toFixed(6)}`,
      `• Source: ${snapshot.source}`,
      ``,
      history.length > 1 ? `**Recent History (${history.length} points):**` : "",
      ...historyLines,
    ].filter(Boolean).join("\n");

    return { success: true, data: snapshot as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `❌ Price tracking failed: ${error}` };
  }
}

export async function executePriceTrend(params: string[], _ctx: SkillContext): Promise<SkillResult> {
  const pairInput = params[0] || "all";
  const period = parseInt(params[1] || "60", 10);
  const { analyzeTrend, analyzeAllTrends, recordAllPriceSnapshots } = await import("@/lib/blockchain/price-tracker");

  // Ensure we have fresh data
  await recordAllPriceSnapshots().catch(() => {});

  try {
    if (pairInput.toUpperCase() === "ALL") {
      const trends = analyzeAllTrends(period);
      if (trends.length === 0) {
        return { success: true, data: {}, display: "📈 **No trend data yet.** Run [[PRICE_TRACK|all]] a few times to build history." };
      }

      const lines = trends.map((t) => {
        const icon = t.direction === "up" ? "📈" : t.direction === "down" ? "📉" : "➡️";
        return `${icon} **${t.pair}**: ${t.change > 0 ? "+" : ""}${t.changePercent.toFixed(3)}% (${t.previousRate.toFixed(6)} → ${t.currentRate.toFixed(6)}) [${t.snapshots} pts]`;
      });

      const display = [
        `📈 **Price Trends (${formatPeriodLabel(period)})**`,
        ``,
        ...lines,
      ].join("\n");

      return { success: true, data: { trends } as unknown as Record<string, unknown>, display };
    }

    // Specific pair
    const pair = pairInput.includes("/") ? pairInput : `CELO/${pairInput.toUpperCase()}`;
    const trend = analyzeTrend(pair, period);
    if (!trend) {
      return { success: true, data: {}, display: `📈 **No trend data for ${pair}.** Run [[PRICE_TRACK|${pairInput}]] a few times first.` };
    }

    const icon = trend.direction === "up" ? "📈" : trend.direction === "down" ? "📉" : "➡️";
    const display = [
      `${icon} **Trend: ${trend.pair} (${trend.period})**`,
      `• Direction: ${trend.direction.toUpperCase()}`,
      `• Change: ${trend.change > 0 ? "+" : ""}${trend.changePercent.toFixed(3)}%`,
      `• From: ${trend.previousRate.toFixed(6)} → To: ${trend.currentRate.toFixed(6)}`,
      `• Data points: ${trend.snapshots}`,
    ].join("\n");

    return { success: true, data: trend as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `❌ Trend analysis failed: ${error}` };
  }
}

export async function executePricePredict(params: string[], _ctx: SkillContext): Promise<SkillResult> {
  const pairInput = params[0] || "all";
  const { predictPrice, predictAllPrices, recordAllPriceSnapshots } = await import("@/lib/blockchain/price-tracker");

  // Ensure we have fresh data
  await recordAllPriceSnapshots().catch(() => {});

  try {
    if (pairInput.toUpperCase() === "ALL") {
      const predictions = predictAllPrices();
      if (predictions.length === 0) {
        return { success: true, data: {}, display: "🔮 **Not enough data for predictions.** Need at least 5 price snapshots. Run [[PRICE_TRACK|all]] periodically." };
      }

      const lines = predictions.map((p) => {
        const icon = p.predictedDirection === "up" ? "📈" : p.predictedDirection === "down" ? "📉" : "➡️";
        const confIcon = p.confidence === "high" ? "🟢" : p.confidence === "medium" ? "🟡" : "🔴";
        return [
          `${icon} **${p.pair}** (${p.timeframe})`,
          `  Current: ${p.currentRate.toFixed(6)} → Predicted: ${p.predictedRate.toFixed(6)}`,
          `  Confidence: ${confIcon} ${p.confidence} — ${p.reasoning}`,
        ].join("\n");
      });

      const display = [
        `🔮 **Price Predictions (momentum-based)**`,
        ``,
        ...lines,
        ``,
        `⚠️ _This is a simple heuristic, NOT financial advice._`,
      ].join("\n");

      return { success: true, data: { predictions } as unknown as Record<string, unknown>, display };
    }

    // Specific pair
    const pair = pairInput.includes("/") ? pairInput : `CELO/${pairInput.toUpperCase()}`;
    const prediction = predictPrice(pair);
    if (!prediction) {
      return { success: true, data: {}, display: `🔮 **Not enough data for ${pair}.** Need ≥ 5 snapshots. Run [[PRICE_TRACK|${pairInput}]] periodically.` };
    }

    const icon = prediction.predictedDirection === "up" ? "📈" : prediction.predictedDirection === "down" ? "📉" : "➡️";
    const confIcon = prediction.confidence === "high" ? "🟢" : prediction.confidence === "medium" ? "🟡" : "🔴";
    const display = [
      `🔮 **Prediction: ${prediction.pair}** (${prediction.timeframe})`,
      `${icon} Direction: ${prediction.predictedDirection.toUpperCase()}`,
      `• Current: ${prediction.currentRate.toFixed(6)}`,
      `• Predicted: ${prediction.predictedRate.toFixed(6)}`,
      `• Confidence: ${confIcon} ${prediction.confidence}`,
      `• Reasoning: ${prediction.reasoning}`,
      ``,
      `⚠️ _Simple momentum heuristic — not financial advice._`,
    ].join("\n");

    return { success: true, data: prediction as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `❌ Prediction failed: ${error}` };
  }
}

export async function executePriceAlerts(params: string[], _ctx: SkillContext): Promise<SkillResult> {
  const threshold = parseFloat(params[0] || "2");
  const { checkAlerts, recordAllPriceSnapshots } = await import("@/lib/blockchain/price-tracker");

  // Ensure we have fresh data
  await recordAllPriceSnapshots().catch(() => {});

  try {
    const alerts = checkAlerts(threshold);

    if (alerts.length === 0) {
      return {
        success: true,
        data: { alerts: [] },
        display: `🔔 **No Price Alerts** (threshold: ${threshold}%)\nAll Mento pairs are moving within normal ranges.`,
      };
    }

    const lines = alerts.map((a) => {
      const icon = a.severity === "critical" ? "🚨" : a.severity === "warning" ? "⚠️" : "ℹ️";
      return `${icon} **${a.type.replace("_", " ").toUpperCase()}** — ${a.message}`;
    });

    const display = [
      `🔔 **Price Alerts** (threshold: ${threshold}%)`,
      ``,
      ...lines,
    ].join("\n");

    return { success: true, data: { alerts } as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `❌ Alert check failed: ${error}` };
  }
}

// ─── Celo MCP-Equivalent handlers ────────────────────────────────────────────

export async function executeGetNetworkStatus(
  _params: string[],
  _ctx: SkillContext
): Promise<SkillResult> {
  try {
    const status = await getNetworkStatus();
    const display = [
      "Network Status",
      "",
      `Network: ${status.networkName} (Chain ID: ${status.chainId})`,
      `Latest Block: ${status.latestBlock}`,
      `Gas Price: ${status.gasPrice}`,
      `RPC: ${status.rpcUrl}`,
      `Explorer: ${status.blockExplorerUrl}`,
    ].join("\n");
    return { success: true, data: status as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `Failed to get network status: ${error}` };
  }
}

export async function executeGetBlock(
  params: string[],
  _ctx: SkillContext
): Promise<SkillResult> {
  const blockId = params[0]?.trim() || "latest";
  try {
    const block = await getBlock(blockId);
    if (!block) {
      return { success: false, error: "Block not found", display: `Block ${blockId} not found.` };
    }
    const display = [
      `Block #${block.number}`,
      "",
      `Hash: ${block.hash}`,
      `Timestamp: ${block.timestamp.toISOString()}`,
      `Gas Used: ${block.gasUsed.toString()}`,
      `Gas Limit: ${block.gasLimit.toString()}`,
      block.baseFeePerGas ? `Base Fee: ${block.baseFeePerGas}` : "",
      `Transactions: ${block.transactionsCount}`,
    ].filter(Boolean).join("\n");
    return { success: true, data: block as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `Failed to get block: ${error}` };
  }
}

export async function executeGetLatestBlocks(
  params: string[],
  _ctx: SkillContext
): Promise<SkillResult> {
  const count = Math.min(parseInt(params[0] || "10", 10) || 10, 100);
  try {
    const blocks = await getLatestBlocks(count);
    const lines = blocks.map((b) =>
      `#${b.number} | ${b.timestamp.toISOString()} | ${b.transactionsCount} txs | gas: ${b.gasUsed.toString()}`
    );
    const display = ["Latest Blocks", "", ...lines].join("\n");
    return { success: true, data: { blocks } as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `Failed to get blocks: ${error}` };
  }
}

export async function executeGetTransaction(
  params: string[],
  _ctx: SkillContext
): Promise<SkillResult> {
  const txHash = params[0]?.trim();
  if (!txHash || !txHash.startsWith("0x")) {
    return { success: false, error: "Invalid tx hash", display: "Usage: [[GET_TRANSACTION|0x...]]" };
  }
  try {
    const tx = await getTransaction(txHash);
    if (!tx) {
      return { success: false, error: "Transaction not found", display: `Transaction ${txHash.slice(0, 16)}... not found.` };
    }
    const display = [
      `Transaction ${tx.hash.slice(0, 10)}...${tx.hash.slice(-8)}`,
      "",
      `From: ${tx.from}`,
      `To: ${tx.to ?? "contract creation"}`,
      `Value: ${tx.value} CELO`,
      `Status: ${tx.status}`,
      `Block: ${tx.blockNumber}`,
      tx.timestamp ? `Time: ${tx.timestamp.toISOString()}` : "",
      `Gas Used: ${tx.gasUsed}`,
      `Gas Price: ${tx.gasPrice}`,
    ].filter(Boolean).join("\n");
    return { success: true, data: tx as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `Failed to get transaction: ${error}` };
  }
}

export async function executeGetTokenInfo(
  params: string[],
  _ctx: SkillContext
): Promise<SkillResult> {
  const addr = params[0]?.trim();
  if (!addr || !isAddress(addr)) {
    return { success: false, error: "Invalid address", display: "Usage: [[GET_TOKEN_INFO|0x...]]" };
  }
  try {
    const info = await getTokenInfo(addr as Address);
    if (!info) {
      return { success: false, error: "Not an ERC20", display: "Contract is not a valid ERC20 token." };
    }
    const display = [
      `Token: ${info.name} (${info.symbol})`,
      "",
      `Address: ${info.address}`,
      `Decimals: ${info.decimals}`,
      `Total Supply: ${info.totalSupply}`,
    ].join("\n");
    return { success: true, data: info as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `Failed: ${error}` };
  }
}

export async function executeGetTokenBalance(
  params: string[],
  _ctx: SkillContext
): Promise<SkillResult> {
  const [tokenAddr, ownerAddr] = params.map((p) => p?.trim());
  if (!tokenAddr || !isAddress(tokenAddr) || !ownerAddr || !isAddress(ownerAddr)) {
    return { success: false, error: "Invalid params", display: "Usage: [[GET_TOKEN_BALANCE|tokenAddress|ownerAddress]]" };
  }
  try {
    const balance = await getTokenBalance(tokenAddr as Address, ownerAddr as Address);
    const display = [
      `Token Balance`,
      "",
      `Address: ${ownerAddr.slice(0, 10)}...${ownerAddr.slice(-8)}`,
      `Balance: ${balance}`,
    ].join("\n");
    return { success: true, data: { balance } as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `Failed: ${error}` };
  }
}

export async function executeGetNftInfo(
  params: string[],
  _ctx: SkillContext
): Promise<SkillResult> {
  const [contractAddr, tokenId] = params.map((p) => p?.trim());
  if (!contractAddr || !isAddress(contractAddr)) {
    return { success: false, error: "Invalid address", display: "Usage: [[GET_NFT_INFO|contractAddress|tokenId]]" };
  }
  try {
    const info = await getNftInfo(contractAddr as Address, tokenId);
    if (!info) {
      return { success: false, error: "Not an NFT", display: "Contract is not a valid ERC721/ERC1155 NFT." };
    }
    const display = [
      `NFT: ${info.name} (${info.type})`,
      "",
      `Address: ${info.address}`,
      info.symbol ? `Symbol: ${info.symbol}` : "",
      info.tokenURI ? `Token URI: ${info.tokenURI}` : "",
    ].filter(Boolean).join("\n");
    return { success: true, data: info as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `Failed: ${error}` };
  }
}

export async function executeGetNftBalance(
  params: string[],
  _ctx: SkillContext
): Promise<SkillResult> {
  const [contractAddr, ownerAddr, tokenId] = params.map((p) => p?.trim());
  if (!contractAddr || !isAddress(contractAddr) || !ownerAddr || !isAddress(ownerAddr)) {
    return { success: false, error: "Invalid params", display: "Usage: [[GET_NFT_BALANCE|contractAddress|ownerAddress|tokenId]]" };
  }
  try {
    const balance = await getNftBalance(contractAddr as Address, ownerAddr as Address, tokenId);
    const display = [
      `NFT Balance`,
      "",
      `Owner: ${ownerAddr.slice(0, 10)}...${ownerAddr.slice(-8)}`,
      `Balance: ${balance}`,
    ].join("\n");
    return { success: true, data: { balance } as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `Failed: ${error}` };
  }
}

export async function executeEstimateGas(
  params: string[],
  ctx: SkillContext
): Promise<SkillResult> {
  const [contractAddr, functionName, argsStr] = params.map((p) => p?.trim());
  if (!contractAddr || !isAddress(contractAddr) || !functionName) {
    return { success: false, error: "Invalid params", display: "Usage: [[ESTIMATE_GAS|contractAddress|functionName|args]]" };
  }
  const account = (ctx.agentWalletAddress || "0x0000000000000000000000000000000000000000") as Address;
  const args = argsStr ? argsStr.split(",").map((a) => a.trim()) : [];
  try {
    const result = await estimateContractGas(contractAddr as Address, functionName, args, account);
    if (result.error) {
      return { success: false, error: result.error, display: `Gas estimation failed: ${result.error}` };
    }
    return {
      success: true,
      data: { gasEstimate: result.gasEstimate } as unknown as Record<string, unknown>,
      display: `Estimated gas: ${result.gasEstimate} units`,
    };
  } catch (error) {
    return { success: false, error: String(error), display: `Failed: ${error}` };
  }
}

export async function executeGetGasFeeData(
  _params: string[],
  _ctx: SkillContext
): Promise<SkillResult> {
  try {
    const data = await getGasFeeData();
    const display = [
      "Gas Fee Data (EIP-1559)",
      "",
      `Base Fee: ${data.baseFeePerGas}`,
      `Max Fee: ${data.maxFeePerGas}`,
      `Priority Fee: ${data.maxPriorityFeePerGas}`,
      `Est. Simple Transfer: ${data.estimatedCostCelo}`,
    ].join("\n");
    return { success: true, data: data as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `Failed: ${error}` };
  }
}

export async function executeGetGovernanceProposals(
  params: string[],
  _ctx: SkillContext
): Promise<SkillResult> {
  const limit = parseInt(params[0] || "10", 10) || 10;
  try {
    const { proposals, error } = await getGovernanceProposals({ limit, includeInactive: true });
    if (error) {
      return {
        success: false,
        error,
        display: `Governance: ${error} Set CELO_GOVERNANCE_API_URL to enable.`,
      };
    }
    if (proposals.length === 0) {
      return { success: true, data: {} as Record<string, unknown>, display: "No governance proposals found." };
    }
    const lines = proposals.slice(0, limit).map((p) => {
      const title = (p.title || `Proposal ${p.id}`).slice(0, 50);
      const votes = p.votes ? ` | Yes: ${p.votes.yes?.percentage ?? 0}%` : "";
      return `#${p.id} ${title}${votes}`;
    });
    const display = ["Governance Proposals", "", ...lines].join("\n");
    return { success: true, data: { proposals } as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `Failed: ${error}` };
  }
}

export async function executeGetProposalDetails(
  params: string[],
  _ctx: SkillContext
): Promise<SkillResult> {
  const id = parseInt(params[0] || "0", 10);
  if (!id) {
    return { success: false, error: "Invalid ID", display: "Usage: [[GET_PROPOSAL_DETAILS|proposalId]]" };
  }
  try {
    const { proposal, error } = await getProposalDetails(id);
    if (error) {
      return { success: false, error, display: `Governance: ${error}` };
    }
    if (!proposal) {
      return { success: true, data: {} as Record<string, unknown>, display: `Proposal ${id} not found.` };
    }
    const display = [
      `Proposal #${proposal.id}`,
      "",
      `Title: ${proposal.title || "—"}`,
      `Stage: ${proposal.stage_name ?? proposal.stage ?? "—"}`,
      `Active: ${proposal.is_active}`,
      proposal.votes ? `Votes: ${proposal.votes.total_formatted ?? "—"} | Yes: ${proposal.votes.yes?.percentage ?? 0}%` : "",
      proposal.urls?.discussion ? `Discussion: ${proposal.urls.discussion}` : "",
      proposal.urls?.cgp ? `CGP: ${proposal.urls.cgp}` : "",
    ].filter(Boolean).join("\n");
    return { success: true, data: proposal as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `Failed: ${error}` };
  }
}

// ─── SelfClaw / Agent Token handlers ────────────────────────────────────────

export async function executeAgentTokens(
  _params: string[],
  ctx: SkillContext
): Promise<SkillResult> {
  const { getAgentTokenInfo } = await import("@/lib/selfclaw/agentActions");

  try {
    const info = await getAgentTokenInfo(ctx.agentId);

    if (info.error) {
      return {
        success: false,
        error: info.error,
        display: `Agent Tokens: ${info.error}`,
      };
    }

    const lines: string[] = ["Agent Token Info (SelfClaw)", ""];

    if (info.deployedTokens && info.deployedTokens.length > 0) {
      lines.push("Deployed tokens (tracked):");
      for (const t of info.deployedTokens) {
        lines.push("  " + t.name + " (" + t.symbol + "): " + t.address);
      }
      lines.push("");
    }

    if (info.tokenAddress) {
      lines.push("Primary token: " + info.tokenAddress);
    } else if (!info.deployedTokens || info.deployedTokens.length === 0) {
      lines.push("Token: Not deployed yet. Deploy via [[SELFCLAW_DEPLOY_TOKEN|name|symbol|supply]]");
    }

    if (info.walletAddress) {
      const addr = info.walletAddress;
      lines.push("Wallet: " + addr.slice(0, 10) + "..." + addr.slice(addr.length - 8));
    }

    if (info.economics) {
      lines.push("");
      lines.push("Economics:");
      lines.push(`Revenue: $${info.economics.totalRevenue}`);
      lines.push(`Costs: $${info.economics.totalCosts}`);
      lines.push(`P&L: $${info.economics.profitLoss}`);
      if (info.economics.runway) {
        lines.push(`Runway: ${info.economics.runway.months} months (${info.economics.runway.status})`);
      }
    }

    if (info.pools && info.pools.length > 0) {
      lines.push("");
      lines.push("Liquidity Pools:");
      for (const pool of info.pools) {
        lines.push(
          `${pool.agentName || "Pool"}: $${pool.price?.toFixed(4) ?? "—"} | MCap: $${pool.marketCap?.toLocaleString() ?? "—"}`
        );
      }
    } else if (info.tokenAddress) {
      lines.push("");
      lines.push("Pools: None yet. Use [[REQUEST_SELFCLAW_SPONSORSHIP]] to request sponsorship.");
    }

    return {
      success: true,
      data: info as unknown as Record<string, unknown>,
      display: lines.join("\n"),
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      display: `Failed to get token info: ${error}`,
    };
  }
}

export async function executeRequestSelfClawSponsorship(
  params: string[],
  ctx: SkillContext
): Promise<SkillResult> {
  const { requestSponsorshipForAgent, getAgentTokenInfo } = await import("@/lib/selfclaw/agentActions");

  const tokenAddressOverride = params[0]?.trim();
  if (tokenAddressOverride && !tokenAddressOverride.startsWith("0x")) {
    return {
      success: false,
      error: "Invalid token address",
      display: "Token address must start with 0x. Use the full address from the deploy result.",
    };
  }

  try {
    const tokenInfo = await getAgentTokenInfo(ctx.agentId);
    if (tokenInfo.pools && tokenInfo.pools.length > 0) {
      return {
        success: true,
        data: { alreadySponsored: true },
        display: [
          "Already Sponsored",
          "",
          "Your token already has SELFCLAW liquidity sponsorship. You have a pool paired with SELFCLAW.",
          "",
          tokenInfo.pools
            .map(
              (p) =>
                `• ${p.agentName || "Pool"}: $${p.price?.toFixed(4) ?? "—"} | MCap: $${p.marketCap?.toLocaleString() ?? "—"}`
            )
            .join("\n"),
        ].join("\n"),
      };
    }

    const result = await requestSponsorshipForAgent(
      ctx.agentId,
      undefined,
      tokenAddressOverride || undefined
    );

    if (result.success) {
      return {
        success: true,
        data: { sponsorshipRequested: true },
        display: [
          "SELFCLAW Sponsorship Requested",
          "",
          "Your liquidity pool request was submitted successfully. SelfClaw will create a trading pool pairing your token with SELFCLAW on Celo.",
          "",
          "What happens next:",
          "• Pool creation may take a few minutes",
          "• One sponsorship per human (sybil protection)",
          "• View your pool in the Token & Trade tab or at selfclaw.ai/pools",
        ].join("\n"),
      };
    }

    const lines = [`Sponsorship Request Failed: ${result.error ?? "Unknown error"}`];
    const tokenAddr = result.tokenAddress ?? tokenAddressOverride;
    if (result.sponsorWallet && result.amountNeeded && tokenAddr) {
      const amountRaw = parseFloat(result.amountNeeded) / 1e18;
      const amountHuman = amountRaw.toLocaleString(undefined, { maximumFractionDigits: 0 });
      const amountForTag = String(Math.floor(amountRaw)); // No commas — parseUnits requires valid decimal
      lines.push("");
      lines.push("RECOVERY: The sponsor wallet needs your agent tokens. To fix:");
      lines.push(`1. Send ${amountHuman} of your agent token to ${result.sponsorWallet}`);
      lines.push(`   Use: [[SEND_AGENT_TOKEN|${tokenAddr}|${result.sponsorWallet}|${amountForTag}]]`);
      lines.push("2. After transfer confirms, retry: [[REQUEST_SELFCLAW_SPONSORSHIP]]");
      lines.push("");
      lines.push("Ask the user: 'Should I send the tokens to the sponsor wallet and retry sponsorship?'");
    }

    return {
      success: false,
      error: result.error,
      data: { sponsorWallet: result.sponsorWallet, amountNeeded: result.amountNeeded },
      display: lines.join("\n"),
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      display: `Failed to request sponsorship: ${error}`,
    };
  }
}

export async function executeSelfClawRegisterWallet(
  _params: string[],
  ctx: SkillContext
): Promise<SkillResult> {
  const { registerWalletForAgent } = await import("@/lib/selfclaw/agentActions");

  try {
    const result = await registerWalletForAgent(ctx.agentId);

    if (result.success) {
      const wal = result.walletAddress;
      const walStr = wal ? "Wallet " + wal.slice(0, 10) + "..." + wal.slice(wal.length - 8) + " is now registered." : "Registration complete.";
      return {
        success: true,
        data: { walletAddress: result.walletAddress },
        display: [
          "Wallet Registered with SelfClaw",
          "",
          walStr,
          "",
          "You can now deploy a token and request sponsorship.",
        ].join("\n"),
      };
    }

    return {
      success: false,
      error: result.error,
      display: `Registration Failed: ${result.error ?? "Unknown error"}`,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      display: `Failed to register wallet: ${error}`,
    };
  }
}

export async function executeSelfClawDeployToken(
  params: string[],
  ctx: SkillContext
): Promise<SkillResult> {
  const { deployTokenForAgent } = await import("@/lib/selfclaw/agentActions");

  const name = params[0]?.trim();
  const symbol = params[1]?.trim()?.toUpperCase();
  const supply = (params[2]?.trim() || "1000000").replace(/,/g, "");

  if (!name || !symbol) {
    return {
      success: false,
      error: "Missing params",
      display: "Usage: [[SELFCLAW_DEPLOY_TOKEN|name|symbol|supply]] — e.g. [[SELFCLAW_DEPLOY_TOKEN|MyAgent|MAT|1000000]]",
    };
  }

  try {
    const result = await deployTokenForAgent(ctx.agentId, name, symbol, supply);

    if (result.success && result.tokenAddress) {
      return {
        success: true,
        data: { tokenAddress: result.tokenAddress, txHash: result.txHash },
        display: [
          "Token Deployed",
          "",
          `${name} (${symbol}) deployed successfully.`,
          `Token address: ${result.tokenAddress}`,
          result.txHash ? `Tx: ${result.txHash}` : "",
          "Registered with SelfClaw. You can now request sponsorship.",
        ].filter(Boolean).join("\n"),
      };
    }

    return {
      success: false,
      error: result.error,
      display: `Deploy Failed: ${result.error ?? "Unknown error"}`,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      display: `Failed to deploy token: ${error}`,
    };
  }
}

export async function executeSelfClawLogRevenue(
  params: string[],
  ctx: SkillContext
): Promise<SkillResult> {
  const { logRevenueForAgent } = await import("@/lib/selfclaw/agentActions");

  const amount = params[0]?.trim();
  const source = params[1]?.trim() || "api_fees";
  const description = params[2]?.trim();

  if (!amount || isNaN(parseFloat(amount))) {
    return {
      success: false,
      error: "Missing amount",
      display: "Usage: [[SELFCLAW_LOG_REVENUE|amount|source|description]] — e.g. [[SELFCLAW_LOG_REVENUE|50|api_fees|API revenue]]",
    };
  }

  try {
    const result = await logRevenueForAgent(ctx.agentId, amount, source, "USD", description);

    if (result.success) {
      return {
        success: true,
        data: { amount, source },
        display: `Revenue Logged: $${amount} from ${source}${description ? ` (${description})` : ""}`,
      };
    }

    return {
      success: false,
      error: result.error,
      display: `Log Failed: ${result.error ?? "Unknown error"}`,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      display: `Failed to log revenue: ${error}`,
    };
  }
}

export async function executeSelfClawLogCost(
  params: string[],
  ctx: SkillContext
): Promise<SkillResult> {
  const { logCostForAgent, COST_CATEGORIES } = await import("@/lib/selfclaw/agentActions");

  const amount = params[0]?.trim();
  const category = params[1]?.trim() || "other";
  const description = params[2]?.trim();

  if (!amount || isNaN(parseFloat(amount))) {
    return {
      success: false,
      error: "Missing amount",
      display: `Usage: [[SELFCLAW_LOG_COST|amount|category|description]] — categories: ${COST_CATEGORIES.join(", ")}`,
    };
  }

  try {
    const result = await logCostForAgent(ctx.agentId, amount, category, "USD", description);

    if (result.success) {
      return {
        success: true,
        data: { amount, category },
        display: `Cost Logged: $${amount} (${category})${description ? ` — ${description}` : ""}`,
      };
    }

    return {
      success: false,
      error: result.error,
      display: `Log Failed: ${result.error ?? "Unknown error"}`,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      display: `Failed to log cost: ${error}`,
    };
  }
}

// ─── QR Code handlers ────────────────────────────────────────────────────────

export async function executeGenerateQR(
  params: string[],
  ctx: SkillContext
): Promise<SkillResult> {
  const content = params[0]?.trim();
  if (!content) {
    return {
      success: false,
      error: "Missing content",
      display: "Usage: [[GENERATE_QR|content]] — e.g. [[GENERATE_QR|https://example.com]]",
    };
  }

  const { generateQRDataUrl } = await import("@/lib/qr/generate");
  const { prisma } = await import("@/lib/db");

  try {
    const dataUrl = await generateQRDataUrl(content);

    if (ctx.agentId) {
      await prisma.activityLog.create({
        data: {
          agentId: ctx.agentId,
          type: "info",
          message: "QR code generated",
          metadata: JSON.stringify({
            contentPreview: content.slice(0, 80) + (content.length > 80 ? "…" : ""),
            contentLength: content.length,
            generatedAt: new Date().toISOString(),
          }),
        },
      });
    }

    const display = [
      "📱 **QR Code Generated**",
      "",
      `Content encoded: ${content.length > 60 ? content.slice(0, 60) + "…" : content}`,
      "",
      "Scan the QR code below:",
      "",
      `![QR Code](${dataUrl})`,
      "",
      "_QR generation logged to activity._",
    ].join("\n");

    return {
      success: true,
      data: { contentLength: content.length } as unknown as Record<string, unknown>,
      display,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      display: `❌ QR generation failed: ${error}`,
    };
  }
}

export async function executeListQRHistory(
  params: string[],
  ctx: SkillContext
): Promise<SkillResult> {
  const limit = Math.min(parseInt(params[0] || "10", 10) || 10, 50);

  if (!ctx.agentId) {
    return {
      success: false,
      error: "No agent context",
      display: "Cannot list QR history without agent context.",
    };
  }

  const { prisma } = await import("@/lib/db");

  try {
    const logs = await prisma.activityLog.findMany({
      where: {
        agentId: ctx.agentId,
        type: "info",
        message: "QR code generated",
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    if (logs.length === 0) {
      return {
        success: true,
        data: { count: 0 },
        display: "📋 **QR History**\n\nNo QR codes generated yet. Use [[GENERATE_QR|content]] to create one.",
      };
    }

    const lines = logs.map((log, i) => {
      let preview = "(unknown)";
      try {
        const meta = log.metadata ? (JSON.parse(log.metadata) as { contentPreview?: string }) : {};
        preview = meta.contentPreview || preview;
      } catch {
        // ignore invalid metadata
      }
      const at = log.createdAt ? new Date(log.createdAt).toLocaleString() : "—";
      return `${i + 1}. ${preview} — ${at}`;
    });

    const display = [
      "📋 **QR Code History**",
      "",
      ...lines,
      "",
      `_${logs.length} recent QR generation(s)._`,
    ].join("\n");

    return {
      success: true,
      data: { count: logs.length } as unknown as Record<string, unknown>,
      display,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      display: `❌ Failed to list QR history: ${error}`,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatPeriodLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hour(s)`;
  return `${Math.round(minutes / 1440)} day(s)`;
}

