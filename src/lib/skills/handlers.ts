/**
 * Skill Handlers
 *
 * Each handler implements the execute() logic for a single skill.
 * These are pure async functions taking (params, ctx) → SkillResult.
 *
 * Handlers lazy-import heavy blockchain libs so the module tree-shakes well.
 */

import { type Address, isAddress } from "viem";
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatPeriodLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hour(s)`;
  return `${Math.round(minutes / 1440)} day(s)`;
}

