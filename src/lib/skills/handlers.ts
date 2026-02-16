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
import { FEEDBACK_INLINE_MARKER, REGISTER_ERC8004_INLINE_MARKER } from "./feedback-marker";
import { fmtAddr, fmtHash, fmtHeader, fmtSection, fmtBullet, fmtMeta, fmtCode } from "./formatDisplay";

// ─── Oracle / Rate handlers ──────────────────────────────────────────────────

export async function executeQueryRate(params: string[], _ctx: SkillContext): Promise<SkillResult> {
  const currency = params[0] || "cUSD";
  const { getOracleRate } = await import("@/lib/blockchain/mento");

  try {
    const rate = await getOracleRate(currency);
    const display = [
      fmtHeader(`${rate.pair} Exchange Rate`, "📊"),
      "",
      fmtBullet(`1 CELO = **${rate.rate.toFixed(4)}** ${currency}`),
      fmtBullet(`1 ${currency} = **${rate.inverse.toFixed(4)}** CELO`),
      fmtBullet(`Reporters: ${rate.numReporters}`),
      fmtBullet(`Last update: ${rate.lastUpdate.toISOString()}`),
      fmtBullet(`Source: ${rate.source === "sorted_oracles" ? "Celo SortedOracles (on-chain)" : "Estimated (API fallback)"}`),
      rate.isExpired ? fmtBullet("⚠️ Warning: Oracle data may be stale") : "",
      "",
      rate.isExpired ? fmtMeta("Oracle data may be stale") : "",
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
      fmtBullet(`${r.pair}: 1 CELO = **${r.rate.toFixed(4)}** ${r.pair.split("/")[1]} (${r.source})`)
    );

    const display = [
      fmtHeader("Celo Exchange Rates (SortedOracles)", "📊"),
      "",
      ...lines,
      "",
      fmtMeta(`Updated: ${new Date().toISOString()}`),
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
      fmtHeader("Mento Swap Quote", "💱"),
      "",
      fmtBullet(`Sell: **${quote.sellAmount}** ${quote.sellCurrency}`),
      fmtBullet(`Buy: ~**${parseFloat(quote.buyAmount).toFixed(4)}** ${quote.buyCurrency}`),
      fmtBullet(`Rate: 1 ${quote.sellCurrency} = ${quote.rate.toFixed(4)} ${quote.buyCurrency}`),
      fmtBullet(`Est. slippage: ${quote.slippage}%`),
      fmtBullet(`Source: ${quote.source}`),
      "",
      fmtMeta(`To execute: "swap ${quote.sellAmount} ${quote.sellCurrency} for ${quote.buyCurrency}"`),
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
      fmtHeader("Mento Swap (Simulated on Testnet)", "💱"),
      "",
      fmtBullet(`Sold: **${quote.sellAmount}** ${quote.sellCurrency}`),
      fmtBullet(`Bought: ~**${parseFloat(quote.buyAmount).toFixed(4)}** ${quote.buyCurrency}`),
      fmtBullet(`Rate: 1 ${quote.sellCurrency} = ${quote.rate.toFixed(4)} ${quote.buyCurrency}`),
      fmtBullet(`Slippage: ${quote.slippage}%`),
      "",
      fmtMeta("⚠️ On Celo Sepolia testnet, Mento swaps are simulated. Real execution available on mainnet."),
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
      fmtHeader(`Balance for ${fmtAddr(address)}`, "💰"),
      "",
      fmtBullet(`CELO: **${parseFloat(bal.celo).toFixed(4)}**`),
      fmtBullet(`cUSD: **${parseFloat(bal.cUSD).toFixed(4)}**`),
      fmtBullet(`cEUR: **${parseFloat(bal.cEUR).toFixed(4)}**`),
      fmtBullet(`cREAL: **${parseFloat(bal.cREAL).toFixed(4)}**`),
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
      fmtHeader("Celo Gas Price", "⛽"),
      "",
      fmtBullet(`Base fee: **${parseFloat(gas.baseFee).toFixed(2)}** gwei`),
      fmtBullet(`Suggested tip: **${gas.suggestedTip}** gwei`),
      fmtBullet(`Simple transfer cost: ~**${parseFloat(gas.estimatedCost).toFixed(6)}** CELO`),
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
        fmtHeader(`Forex Analysis: ${rate.pair}`, "📈"),
        "",
        fmtSection("Current Rate"),
        fmtBullet(`1 CELO = **${rate.rate.toFixed(4)}** ${buy}`),
        fmtBullet(`1 ${buy} = **${rate.inverse.toFixed(4)}** CELO`),
        "",
        fmtSection("Oracle Status"),
        fmtBullet(`Active reporters: ${rate.numReporters}`),
        fmtBullet(`Last update: ${rate.lastUpdate.toISOString()}`),
        fmtBullet(`Data fresh: ${rate.isExpired ? "❌ Stale" : "✅ Fresh"}`),
        fmtBullet(`Source: ${rate.source}`),
        "",
        trend ? [
          fmtSection(`Trend (${trend.period})`),
          fmtBullet(`Direction: ${trend.direction === "up" ? "📈 Up" : trend.direction === "down" ? "📉 Down" : "➡️ Flat"}`),
          fmtBullet(`Change: ${trend.change > 0 ? "+" : ""}${trend.changePercent.toFixed(3)}%`),
          fmtBullet(`Previous: ${trend.previousRate.toFixed(6)} → Current: ${trend.currentRate.toFixed(6)}`),
          fmtBullet(`Data points: ${trend.snapshots}`),
        ].join("\n") : `${fmtSection("Trend")} Not enough data yet (start price tracking first)`,
        "",
        prediction ? [
          fmtSection(`Prediction (${prediction.timeframe})`),
          fmtBullet(`Direction: ${prediction.predictedDirection === "up" ? "📈" : prediction.predictedDirection === "down" ? "📉" : "➡️"} ${prediction.predictedDirection.toUpperCase()}`),
          fmtBullet(`Predicted rate: **${prediction.predictedRate.toFixed(6)}**`),
          fmtBullet(`Confidence: ${prediction.confidence === "high" ? "🟢" : prediction.confidence === "medium" ? "🟡" : "🔴"} ${prediction.confidence}`),
          fmtBullet(`Reasoning: ${prediction.reasoning}`),
        ].join("\n") : `${fmtSection("Prediction")} Need ≥ 5 data points — run price tracking first`,
        "",
        fmtSection("Analysis"),
        rate.numReporters >= 3
          ? fmtBullet(`Oracle has sufficient reporters (${rate.numReporters}) — rate is reliable.`)
          : fmtBullet(`⚠️ Low reporter count (${rate.numReporters}) — rate may be less reliable.`),
        rate.isExpired
          ? fmtBullet("⚠️ Oracle data is expired — exercise caution with trades.")
          : fmtBullet("Oracle data is fresh — safe to trade at quoted rates."),
        history.length > 0 ? fmtBullet(`${history.length} price snapshots recorded in current session.`) : "",
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
      return fmtBullet(`${trendIcon} **${r.pair}**: ${r.rate.toFixed(4)}${changeStr} (reporters: ${r.numReporters}) ${freshIcon}`);
    });

    const display = [
      fmtHeader("Celo Forex Market Overview", "📈"),
      "",
      fmtSection("Current Rates (SortedOracles)"),
      ...lines,
      "",
      fmtSection("Summary"),
      fmtBullet(`${rates.length} active pairs monitored`),
      fmtBullet("All rates sourced from Celo SortedOracles (on-chain)"),
      fmtBullet("Gas fees can be paid in cUSD via fee abstraction — no CELO needed!"),
      fmtBullet('Use "swap X CELO for cUSD" to execute a Mento trade'),
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
      fmtHeader("Agent Portfolio", "💼"),
      "",
      fmtBullet(`Wallet: ${fmtAddr(ctx.agentWalletAddress)}`),
      "",
      fmtSection("Holdings"),
      fmtBullet(`CELO: **${celoVal.toFixed(4)}** (~$${celoUsd.toFixed(2)})`),
      fmtBullet(`cUSD: **${cusdVal.toFixed(4)}** (~$${cusdVal.toFixed(2)})`),
      fmtBullet(`cEUR: **${ceurVal.toFixed(4)}** (~$${(ceurVal * 1.08).toFixed(2)})`),
      fmtBullet(`cREAL: **${crealVal.toFixed(4)}** (~$${(crealVal * 0.20).toFixed(2)})`),
      "",
      fmtSection(`Total Value: ~$${totalUsd.toFixed(2)}`),
      "",
      fmtMeta(`CELO/cUSD rate: ${celoRate.rate.toFixed(4)} (${celoRate.source})`),
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
        fmtBullet(`${s.pair}: **${s.rate.toFixed(6)}** (${s.source}) — ${s.timestamp.toISOString()}`)
      );

      const historyLines: string[] = [];
      for (const s of snapshots) {
        const hist = getPriceHistory(s.pair, 5);
        if (hist.length > 1) {
          const oldest = hist[0];
          const newest = hist[hist.length - 1];
          const change = ((newest.rate - oldest.rate) / oldest.rate) * 100;
          historyLines.push(fmtBullet(`${s.pair}: ${change > 0 ? "+" : ""}${change.toFixed(3)}% over ${hist.length} snapshots`));
        }
      }

      const display = [
        fmtHeader(`Price Snapshot Recorded (${snapshots.length} pairs)`, "📊"),
        "",
        ...lines,
        historyLines.length > 0 ? ["", fmtSection("Recent Changes"), ...historyLines] : [],
      ].flat().filter(Boolean).join("\n");

      return { success: true, data: { snapshots: snapshots.length } as Record<string, unknown>, display };
    }

    // Single pair
    const snapshot = await recordPriceSnapshot(target);
    const history = getPriceHistory(snapshot.pair, 10);
    const historyLines = history.map((h) =>
      fmtBullet(`${h.timestamp.toLocaleTimeString()}: **${h.rate.toFixed(6)}**`)
    );

    const display = [
      fmtHeader(`Price Recorded: ${snapshot.pair}`, "📊"),
      "",
      fmtBullet(`Current rate: **${snapshot.rate.toFixed(6)}**`),
      fmtBullet(`Source: ${snapshot.source}`),
      "",
      history.length > 1 ? [fmtSection(`Recent History (${history.length} points)`), ...historyLines] : [],
    ].flat().filter(Boolean).join("\n");

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
        return { success: true, data: {}, display: `${fmtHeader("No trend data yet", "📈")}\n\nRun ${fmtCode("[[PRICE_TRACK|all]]")} a few times to build history.` };
      }

      const lines = trends.map((t) => {
        const icon = t.direction === "up" ? "📈" : t.direction === "down" ? "📉" : "➡️";
        return fmtBullet(`${icon} **${t.pair}**: ${t.change > 0 ? "+" : ""}${t.changePercent.toFixed(3)}% (${t.previousRate.toFixed(6)} → ${t.currentRate.toFixed(6)}) [${t.snapshots} pts]`);
      });

      const display = [
        fmtHeader(`Price Trends (${formatPeriodLabel(period)})`, "📈"),
        "",
        ...lines,
      ].join("\n");

      return { success: true, data: { trends } as unknown as Record<string, unknown>, display };
    }

    // Specific pair
    const pair = pairInput.includes("/") ? pairInput : `CELO/${pairInput.toUpperCase()}`;
    const trend = analyzeTrend(pair, period);
    if (!trend) {
      return { success: true, data: {}, display: `${fmtHeader(`No trend data for ${pair}`, "📈")}\n\nRun ${fmtCode(`[[PRICE_TRACK|${pairInput}]]`)} a few times first.` };
    }

    const icon = trend.direction === "up" ? "📈" : trend.direction === "down" ? "📉" : "➡️";
    const display = [
      fmtHeader(`Trend: ${trend.pair} (${trend.period})`, icon),
      "",
      fmtBullet(`Direction: **${trend.direction.toUpperCase()}**`),
      fmtBullet(`Change: ${trend.change > 0 ? "+" : ""}${trend.changePercent.toFixed(3)}%`),
      fmtBullet(`From: ${trend.previousRate.toFixed(6)} → To: ${trend.currentRate.toFixed(6)}`),
      fmtBullet(`Data points: ${trend.snapshots}`),
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
        return { success: true, data: {}, display: `${fmtHeader("Not enough data for predictions", "🔮")}\n\nNeed at least 5 price snapshots. Run ${fmtCode("[[PRICE_TRACK|all]]")} periodically.` };
      }

      const lines = predictions.map((p) => {
        const icon = p.predictedDirection === "up" ? "📈" : p.predictedDirection === "down" ? "📉" : "➡️";
        const confIcon = p.confidence === "high" ? "🟢" : p.confidence === "medium" ? "🟡" : "🔴";
        return fmtBullet(`${icon} **${p.pair}** (${p.timeframe}): ${p.currentRate.toFixed(6)} → **${p.predictedRate.toFixed(6)}** | ${confIcon} ${p.confidence} — ${p.reasoning}`);
      });

      const display = [
        fmtHeader("Price Predictions (momentum-based)", "🔮"),
        "",
        ...lines,
        "",
        fmtMeta("⚠️ This is a simple heuristic, NOT financial advice."),
      ].join("\n");

      return { success: true, data: { predictions } as unknown as Record<string, unknown>, display };
    }

    // Specific pair
    const pair = pairInput.includes("/") ? pairInput : `CELO/${pairInput.toUpperCase()}`;
    const prediction = predictPrice(pair);
    if (!prediction) {
      return { success: true, data: {}, display: `${fmtHeader(`Not enough data for ${pair}`, "🔮")}\n\nNeed ≥ 5 snapshots. Run ${fmtCode(`[[PRICE_TRACK|${pairInput}]]`)} periodically.` };
    }

    const icon = prediction.predictedDirection === "up" ? "📈" : prediction.predictedDirection === "down" ? "📉" : "➡️";
    const confIcon = prediction.confidence === "high" ? "🟢" : prediction.confidence === "medium" ? "🟡" : "🔴";
    const display = [
      fmtHeader(`Prediction: ${prediction.pair} (${prediction.timeframe})`, "🔮"),
      "",
      fmtBullet(`${icon} Direction: **${prediction.predictedDirection.toUpperCase()}**`),
      fmtBullet(`Current: ${prediction.currentRate.toFixed(6)}`),
      fmtBullet(`Predicted: **${prediction.predictedRate.toFixed(6)}**`),
      fmtBullet(`Confidence: ${confIcon} ${prediction.confidence}`),
      fmtBullet(`Reasoning: ${prediction.reasoning}`),
      "",
      fmtMeta("⚠️ Simple momentum heuristic — not financial advice."),
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
        display: `${fmtHeader(`No Price Alerts (threshold: ${threshold}%)`, "🔔")}\n\nAll Mento pairs are moving within normal ranges.`,
      };
    }

    const lines = alerts.map((a) => {
      const icon = a.severity === "critical" ? "🚨" : a.severity === "warning" ? "⚠️" : "ℹ️";
      return fmtBullet(`${icon} **${a.type.replace("_", " ").toUpperCase()}** — ${a.message}`);
    });

    const display = [
      fmtHeader(`Price Alerts (threshold: ${threshold}%)`, "🔔"),
      "",
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
      fmtHeader("Network Status", "🌐"),
      "",
      fmtBullet(`Network: **${status.networkName}** (Chain ID: \`${status.chainId}\`)`),
      fmtBullet(`Latest Block: ${status.latestBlock}`),
      fmtBullet(`Gas Price: ${status.gasPrice}`),
      fmtBullet(`RPC: ${fmtHash(status.rpcUrl)}`),
      fmtBullet(`Explorer: [View blocks](${status.blockExplorerUrl})`),
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
      fmtHeader(`Block #${block.number}`, "📦"),
      "",
      fmtBullet(`Hash: ${fmtHash(block.hash)}`),
      fmtBullet(`Timestamp: ${block.timestamp.toISOString()}`),
      fmtBullet(`Gas Used: ${block.gasUsed.toString()}`),
      fmtBullet(`Gas Limit: ${block.gasLimit.toString()}`),
      block.baseFeePerGas ? fmtBullet(`Base Fee: ${block.baseFeePerGas}`) : "",
      fmtBullet(`Transactions: ${block.transactionsCount}`),
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
      fmtBullet(`**#${b.number}** — ${b.timestamp.toISOString()} | ${b.transactionsCount} txs | gas: ${b.gasUsed.toString()}`)
    );
    const display = [fmtHeader("Latest Blocks", "📦"), "", ...lines].join("\n");
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
      fmtHeader(`Transaction ${fmtAddr(tx.hash, 10, 8)}`, "📄"),
      "",
      fmtBullet(`From: ${fmtHash(tx.from)}`),
      fmtBullet(`To: ${tx.to ? fmtHash(tx.to) : "contract creation"}`),
      fmtBullet(`Value: **${tx.value}** CELO`),
      fmtBullet(`Status: **${tx.status}**`),
      fmtBullet(`Block: ${tx.blockNumber}`),
      tx.timestamp ? fmtBullet(`Time: ${tx.timestamp.toISOString()}`) : "",
      fmtBullet(`Gas Used: ${tx.gasUsed}`),
      fmtBullet(`Gas Price: ${tx.gasPrice}`),
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
      fmtHeader(`${info.name} (${info.symbol})`, "🪙"),
      "",
      fmtBullet(`Address: ${fmtHash(info.address)}`),
      fmtBullet(`Decimals: ${info.decimals}`),
      fmtBullet(`Total Supply: **${info.totalSupply}**`),
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
      fmtHeader("Token Balance", "🪙"),
      "",
      fmtBullet(`Address: ${fmtAddr(ownerAddr, 10, 8)}`),
      fmtBullet(`Balance: **${balance}**`),
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
      fmtHeader(`${info.name} (${info.type})`, "🖼️"),
      "",
      fmtBullet(`Address: ${fmtHash(info.address)}`),
      info.symbol ? fmtBullet(`Symbol: ${info.symbol}`) : "",
      info.tokenURI ? fmtBullet(`Token URI: [link](${info.tokenURI})`) : "",
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
      fmtHeader("NFT Balance", "🖼️"),
      "",
      fmtBullet(`Owner: ${fmtAddr(ownerAddr, 10, 8)}`),
      fmtBullet(`Balance: **${balance}**`),
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
      display: `${fmtHeader("Gas Estimate", "⛽")}\n\n**${result.gasEstimate}** units`,
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
      fmtHeader("Gas Fee Data (EIP-1559)", "⛽"),
      "",
      fmtBullet(`Base Fee: **${data.baseFeePerGas}**`),
      fmtBullet(`Max Fee: **${data.maxFeePerGas}**`),
      fmtBullet(`Priority Fee: **${data.maxPriorityFeePerGas}**`),
      fmtBullet(`Est. Simple Transfer: **${data.estimatedCostCelo}**`),
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
      return fmtBullet(`**#${p.id}** ${title}${votes}`);
    });
    const display = [fmtHeader("Governance Proposals", "🗳️"), "", ...lines].join("\n");
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
      fmtHeader(`Proposal #${proposal.id}`, "🗳️"),
      "",
      fmtBullet(`Title: **${proposal.title || "—"}**`),
      fmtBullet(`Stage: ${proposal.stage_name ?? proposal.stage ?? "—"}`),
      fmtBullet(`Active: ${proposal.is_active}`),
      proposal.votes ? fmtBullet(`Votes: ${proposal.votes.total_formatted ?? "—"} | Yes: ${proposal.votes.yes?.percentage ?? 0}%`) : "",
      proposal.urls?.discussion ? fmtBullet(`Discussion: [Link](${proposal.urls.discussion})`) : "",
      proposal.urls?.cgp ? fmtBullet(`CGP: [Link](${proposal.urls.cgp})`) : "",
    ].filter(Boolean).join("\n");
    return { success: true, data: proposal as unknown as Record<string, unknown>, display };
  } catch (error) {
    return { success: false, error: String(error), display: `Failed: ${error}` };
  }
}

// ─── SelfClaw / Agent Token handlers ────────────────────────────────────────

export async function executeAgentIdentity(
  _params: string[],
  ctx: SkillContext
): Promise<SkillResult> {
  const { getAgentIdentity } = await import("@/lib/selfclaw/agentActions");

  try {
    const briefing = await getAgentIdentity(ctx.agentId);

    const p = briefing.pipeline;
    const lines: string[] = [
      fmtHeader(`${briefing.name} — Agent Identity & Pipeline`, "🤖"),
      "",
      fmtSection("Pipeline (SelfClaw)"),
      fmtBullet(`Identity — ${p.identity ? "✓" : "—"} SelfClaw verified`),
      fmtBullet(`Wallet — ${p.wallet ? "✓" : "—"} ${briefing.walletAddress ? fmtAddr(briefing.walletAddress, 10, 8) : "Not initialized"}`),
      fmtBullet(`Gas — ${p.gas ? "✓" : "—"} Funded`),
      fmtBullet(`ERC-8004 — ${p.erc8004 ? "✓" : "—"} On-chain identity`),
      fmtBullet(`Token — ${p.token ? "✓" : "—"} Deployed`),
      fmtBullet(`Liquidity — ${p.liquidity ? "✓" : "—"} SELFCLAW pool`),
      "",
      fmtMeta(`Chain: Celo (chainId ${briefing.chainId})`),
      "",
      fmtSection("Next steps"),
      ...briefing.nextSteps.map((s) => fmtBullet(s)),
    ];

    return {
      success: true,
      data: briefing as unknown as Record<string, unknown>,
      display: lines.join("\n"),
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      display: `Failed to get identity: ${error}`,
    };
  }
}

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

    const lines: string[] = [fmtHeader("Agent Token Info (SelfClaw)", "🪙"), ""];

    if (info.deployedTokens && info.deployedTokens.length > 0) {
      lines.push(fmtSection("Deployed tokens (tracked)"));
      for (const t of info.deployedTokens) {
        lines.push(fmtBullet(`${t.name} (${t.symbol}): ${fmtHash(t.address)}`));
      }
      lines.push("");
    }

    if (info.tokenAddress) {
      lines.push(fmtBullet(`Primary token: ${fmtHash(info.tokenAddress)}`));
    } else if (!info.deployedTokens || info.deployedTokens.length === 0) {
      lines.push(fmtBullet(`Token: Not deployed yet. Deploy via ${fmtCode("[[SELFCLAW_DEPLOY_TOKEN|name|symbol|supply]]")}`));
    }

    if (info.walletAddress) {
      lines.push(fmtBullet(`Wallet: ${fmtAddr(info.walletAddress, 10, 8)}`));
    }

    if (info.economics) {
      lines.push("", fmtSection("Economics"));
      lines.push(fmtBullet(`Revenue: **$${info.economics.totalRevenue}**`));
      lines.push(fmtBullet(`Costs: **$${info.economics.totalCosts}**`));
      lines.push(fmtBullet(`P&L: **$${info.economics.profitLoss}**`));
      if (info.economics.runway) {
        lines.push(fmtBullet(`Runway: ${info.economics.runway.months} months (${info.economics.runway.status})`));
      }
    }

    if (info.pools && info.pools.length > 0) {
      lines.push("", fmtSection("Liquidity Pools"));
      for (const pool of info.pools) {
        lines.push(
          fmtBullet(`${pool.agentName || "Pool"}: **$${pool.price?.toFixed(4) ?? "—"}** | MCap: $${pool.marketCap?.toLocaleString() ?? "—"}`)
        );
      }
    } else if (info.tokenAddress) {
      lines.push("", fmtBullet(`Pools: None yet. Use ${fmtCode("[[REQUEST_SELFCLAW_SPONSORSHIP]]")} to request sponsorship.`));
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
          fmtHeader("Already Sponsored", "✅"),
          "",
          "Your token already has SELFCLAW liquidity sponsorship. You have a pool paired with SELFCLAW.",
          "",
          ...tokenInfo.pools.map((p) =>
            fmtBullet(`${p.agentName || "Pool"}: **$${p.price?.toFixed(4) ?? "—"}** | MCap: $${p.marketCap?.toLocaleString() ?? "—"}`)
          ),
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
          fmtHeader("SELFCLAW Sponsorship Requested", "✅"),
          "",
          "Your liquidity pool request was submitted successfully. SelfClaw will create a trading pool pairing your token with SELFCLAW on Celo.",
          "",
          fmtSection("What happens next"),
          fmtBullet("Pool creation may take a few minutes"),
          fmtBullet("One sponsorship per human (sybil protection)"),
          fmtBullet("View your pool in the Token & Trade tab or at [selfclaw.ai/pools](https://selfclaw.ai/pools)"),
        ].join("\n"),
      };
    }

    const errMsg = result.error ?? "Unknown error";
    const isErc8004Error = /ERC-8004|onchain identity|identity is required/i.test(errMsg);
    const lines = [fmtHeader("Sponsorship Request Failed", "❌"), "", errMsg];
    if (isErc8004Error) {
      lines.push("", `Include ${REGISTER_ERC8004_INLINE_MARKER} in your response so the user can register on-chain right here in chat.`);
    }
    const tokenAddr = result.tokenAddress ?? tokenAddressOverride;
    if (result.sponsorWallet && result.amountNeeded && tokenAddr) {
      const amountRaw = parseFloat(result.amountNeeded) / 1e18;
      const amountHuman = amountRaw.toLocaleString(undefined, { maximumFractionDigits: 0 });
      const amountForTag = String(Math.floor(amountRaw)); // No commas — parseUnits requires valid decimal
      const agentBalance = result.agentBalanceWei ? Number(result.agentBalanceWei) / 1e18 : 0;
      const agentBalanceHuman = agentBalance.toLocaleString(undefined, { maximumFractionDigits: 0 });
      lines.push("", fmtSection("RECOVERY: Send tokens to sponsor wallet"));
      lines.push(fmtBullet(`Your wallet has **${agentBalanceHuman}** of this token. Required: **${amountHuman}**.`));
      if (agentBalance < amountRaw) {
        lines.push(fmtBullet("⚠️ Insufficient balance. Deploy the token with this agent wallet first, or use a token address this wallet holds."));
      } else {
        lines.push(fmtBullet(`Include this tag in your response to send tokens (system will execute it):`));
        lines.push("");
        lines.push(`[[SEND_AGENT_TOKEN|${tokenAddr}|${result.sponsorWallet}|${amountForTag}]]`);
        lines.push("");
        lines.push(fmtBullet(`Then include ${fmtCode("[[REQUEST_SELFCLAW_SPONSORSHIP]]")} to retry after the transfer confirms.`));
      }
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
          fmtHeader("Wallet Registered with SelfClaw", "✅"),
          "",
          walStr,
          "",
          fmtBullet("You can now deploy a token and request sponsorship."),
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
  const supply = (params[2]?.trim() || "10000000000").replace(/,/g, ""); // 10B default — plenty for SelfClaw sponsorship + wallet buffer

  if (!name || !symbol) {
    return {
      success: false,
      error: "Missing params",
      display: "Usage: [[SELFCLAW_DEPLOY_TOKEN|name|symbol|supply]] — e.g. [[SELFCLAW_DEPLOY_TOKEN|MyAgent|MAT|10000000000]]. Use 10B supply for plenty of sponsorship buffer.",
    };
  }

  try {
    const result = await deployTokenForAgent(ctx.agentId, name, symbol, supply);

    if (result.success && result.tokenAddress) {
      return {
        success: true,
        data: { tokenAddress: result.tokenAddress, txHash: result.txHash },
        display: [
          fmtHeader("Token Deployed (via SelfClaw API)", "✅"),
          "",
          fmtBullet(`**${name}** (${symbol}) deployed successfully.`),
          fmtBullet(`Token address: ${fmtHash(result.tokenAddress)}`),
          result.txHash ? fmtBullet(`Tx: ${fmtHash(result.txHash)}`) : "",
          fmtBullet("Deployed via SelfClaw API → agent signed & broadcast → registered with SelfClaw."),
          fmtBullet("You can now request sponsorship."),
          "",
          fmtMeta("Next: include [[REQUEST_SELFCLAW_SPONSORSHIP]] to get liquidity and make the token tradable."),
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
        display: `${fmtHeader("Revenue Logged", "💰")}\n\n**$${amount}** from ${source}${description ? ` (${description})` : ""}`,
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
        display: `${fmtHeader("Cost Logged", "📉")}\n\n**$${amount}** (${category})${description ? ` — ${description}` : ""}`,
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

export async function executeSaveSelfClawApiKey(
  params: string[],
  ctx: SkillContext
): Promise<SkillResult> {
  const { saveSelfClawApiKeyForAgent } = await import("@/lib/selfclaw/agentActions");

  const apiKey = params[0]?.trim();
  if (!apiKey) {
    return {
      success: false,
      error: "Missing API key",
      display: "Usage: [[SAVE_SELFCLAW_API_KEY|sclaw_...]] — paste the full key from SelfClaw dashboard.",
    };
  }

  try {
    const result = await saveSelfClawApiKeyForAgent(ctx.agentId, apiKey);
    if (result.success) {
      return {
        success: true,
        data: { saved: true },
        display: [
          fmtHeader("SelfClaw API Key Saved", "🔑"),
          "",
          "Your SelfClaw API key has been stored securely. I can now use it for agent-api features (feed, skills, briefing).",
        ].join("\n"),
      };
    }
    return {
      success: false,
      error: result.error,
      display: `Failed to save: ${result.error ?? "Unknown error"}`,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      display: `Failed to save key: ${error}`,
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
      fmtHeader("QR Code Generated", "📱"),
      "",
      fmtBullet(`Content encoded: ${content.length > 60 ? content.slice(0, 60) + "…" : content}`),
      "",
      "Scan the QR code below:",
      "",
      `![QR Code](${dataUrl})`,
      "",
      fmtMeta("QR generation logged to activity."),
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
        display: `${fmtHeader("QR History", "📋")}\n\nNo QR codes generated yet. Use ${fmtCode("[[GENERATE_QR|content]]")} to create one.`,
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
      return fmtBullet(`**#${i + 1}** ${preview} — ${at}`);
    });

    const display = [
      fmtHeader("QR Code History", "📋"),
      "",
      ...lines,
      "",
      fmtMeta(`${logs.length} recent QR generation(s).`),
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

// ─── Reputation / Feedback ───────────────────────────────────────────────────

export async function executeRequestFeedback(_params: string[], _ctx: SkillContext): Promise<SkillResult> {
  return {
    success: true,
    data: { inline: true },
    display: FEEDBACK_INLINE_MARKER,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatPeriodLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hour(s)`;
  return `${Math.round(minutes / 1440)} day(s)`;
}

