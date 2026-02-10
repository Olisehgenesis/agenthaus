/**
 * Skill Definitions
 *
 * Declarative metadata for every skill the agent system knows about.
 * Each entry describes id, name, command tag, params, examples, and flags.
 *
 * Imported by the registry (registry.ts) which wires each definition to
 * its handler and exposes the public API.
 */

import type { SkillDefinition } from "./types";

const SKILL_DEFINITIONS: SkillDefinition[] = [
  // ── Transfer Skills ───────────────────────────────────────────────
  {
    id: "send_celo",
    name: "Send CELO",
    description: "Send native CELO to an address",
    category: "transfer",
    commandTag: "SEND_CELO",
    params: [
      { name: "to", description: "Recipient 0x address", required: true, example: "0xABC...123" },
      { name: "amount", description: "Amount in CELO", required: true, example: "1.5" },
    ],
    examples: [
      { input: "send 2 CELO to 0xABC...123", output: "[[SEND_CELO|0xABC...123|2]]" },
    ],
    requiresWallet: true,
    mutatesState: true,
  },
  {
    id: "send_token",
    name: "Send Token",
    description: "Send ERC-20 tokens (cUSD, cEUR, cREAL)",
    category: "transfer",
    commandTag: "SEND_TOKEN",
    params: [
      { name: "currency", description: "Token symbol (cUSD, cEUR, cREAL)", required: true, example: "cUSD" },
      { name: "to", description: "Recipient 0x address", required: true, example: "0xDEF...456" },
      { name: "amount", description: "Amount", required: true, example: "10" },
    ],
    examples: [
      { input: "send 5 cUSD to 0xDEF...456", output: "[[SEND_TOKEN|cUSD|0xDEF...456|5]]" },
    ],
    requiresWallet: true,
    mutatesState: true,
  },

  // ── Oracle / Price Feed Skills ────────────────────────────────────
  {
    id: "query_rate",
    name: "Query Exchange Rate",
    description: "Get the current CELO exchange rate for a stablecoin from SortedOracles",
    category: "oracle",
    commandTag: "QUERY_RATE",
    params: [
      { name: "currency", description: "Stable token symbol (cUSD, cEUR, cREAL)", required: true, example: "cUSD" },
    ],
    examples: [
      { input: "what's the CELO/cUSD rate?", output: "[[QUERY_RATE|cUSD]]" },
      { input: "check cEUR price", output: "[[QUERY_RATE|cEUR]]" },
    ],
    requiresWallet: false,
    mutatesState: false,
  },
  {
    id: "query_all_rates",
    name: "Query All Rates",
    description: "Get all available CELO exchange rates from SortedOracles",
    category: "oracle",
    commandTag: "QUERY_ALL_RATES",
    params: [],
    examples: [
      { input: "show me all exchange rates", output: "[[QUERY_ALL_RATES]]" },
    ],
    requiresWallet: false,
    mutatesState: false,
  },

  // ── Mento Exchange Skills ─────────────────────────────────────────
  {
    id: "mento_quote",
    name: "Mento Swap Quote",
    description: "Get a swap quote from Mento Protocol (CELO ↔ stablecoins)",
    category: "mento",
    commandTag: "MENTO_QUOTE",
    params: [
      { name: "sell_currency", description: "Currency to sell (CELO, cUSD, cEUR, cREAL)", required: true, example: "CELO" },
      { name: "buy_currency", description: "Currency to buy", required: true, example: "cUSD" },
      { name: "amount", description: "Amount to sell", required: true, example: "10" },
    ],
    examples: [
      { input: "how much cUSD for 10 CELO?", output: "[[MENTO_QUOTE|CELO|cUSD|10]]" },
      { input: "quote 50 cUSD to CELO", output: "[[MENTO_QUOTE|cUSD|CELO|50]]" },
    ],
    requiresWallet: false,
    mutatesState: false,
  },
  {
    id: "mento_swap",
    name: "Mento Swap Execute",
    description: "Execute a swap on Mento Protocol (CELO ↔ stablecoins)",
    category: "mento",
    commandTag: "MENTO_SWAP",
    params: [
      { name: "sell_currency", description: "Currency to sell", required: true, example: "CELO" },
      { name: "buy_currency", description: "Currency to buy", required: true, example: "cUSD" },
      { name: "amount", description: "Amount to sell", required: true, example: "10" },
    ],
    examples: [
      { input: "swap 5 CELO for cUSD", output: "[[MENTO_SWAP|CELO|cUSD|5]]" },
    ],
    requiresWallet: true,
    mutatesState: true,
  },

  // ── Data Skills ───────────────────────────────────────────────────
  {
    id: "check_balance",
    name: "Check Balance",
    description: "Check CELO and stablecoin balances for any address",
    category: "data",
    commandTag: "CHECK_BALANCE",
    params: [
      { name: "address", description: "0x address to check", required: true, example: "0xABC...123" },
    ],
    examples: [
      { input: "check balance of 0xABC...123", output: "[[CHECK_BALANCE|0xABC...123]]" },
      { input: "what's my balance?", output: "[[CHECK_BALANCE|<agent_wallet_address>]]" },
    ],
    requiresWallet: false,
    mutatesState: false,
  },
  {
    id: "gas_price",
    name: "Gas Price",
    description: "Get current gas price on Celo network",
    category: "data",
    commandTag: "GAS_PRICE",
    params: [],
    examples: [
      { input: "what's the current gas price?", output: "[[GAS_PRICE]]" },
    ],
    requiresWallet: false,
    mutatesState: false,
  },

  // ── Forex / Analysis Skills ───────────────────────────────────────
  {
    id: "forex_analysis",
    name: "Forex Analysis",
    description: "Analyze current Mento stablecoin rates and provide trading signals",
    category: "forex",
    commandTag: "FOREX_ANALYSIS",
    params: [
      { name: "pair", description: "Trading pair (e.g. CELO/cUSD, cUSD/cEUR)", required: false, example: "CELO/cUSD" },
    ],
    examples: [
      { input: "analyze CELO/cUSD", output: "[[FOREX_ANALYSIS|CELO/cUSD]]" },
      { input: "give me a market overview", output: "[[FOREX_ANALYSIS]]" },
    ],
    requiresWallet: false,
    mutatesState: false,
  },
  {
    id: "portfolio_status",
    name: "Portfolio Status",
    description: "Show agent portfolio with balances valued in USD",
    category: "forex",
    commandTag: "PORTFOLIO_STATUS",
    params: [],
    examples: [
      { input: "show my portfolio", output: "[[PORTFOLIO_STATUS]]" },
      { input: "what are my holdings worth?", output: "[[PORTFOLIO_STATUS]]" },
    ],
    requiresWallet: true,
    mutatesState: false,
  },
  {
    id: "price_track",
    name: "Record & Show Prices",
    description: "Record current Mento asset prices and show recent price history",
    category: "forex",
    commandTag: "PRICE_TRACK",
    params: [
      { name: "pair", description: "Pair to track (e.g. cUSD) or 'all'", required: false, example: "all" },
    ],
    examples: [
      { input: "track all prices", output: "[[PRICE_TRACK|all]]" },
      { input: "record cUSD price", output: "[[PRICE_TRACK|cUSD]]" },
    ],
    requiresWallet: false,
    mutatesState: false,
  },
  {
    id: "price_trend",
    name: "Price Trend Analysis",
    description: "Analyze price trends for Mento assets: direction, change %, momentum",
    category: "forex",
    commandTag: "PRICE_TREND",
    params: [
      { name: "pair", description: "Pair to analyze (e.g. CELO/cUSD) or 'all'", required: false, example: "CELO/cUSD" },
      { name: "period", description: "Period in minutes (default 60)", required: false, example: "60" },
    ],
    examples: [
      { input: "what's the cUSD trend?", output: "[[PRICE_TREND|CELO/cUSD|60]]" },
      { input: "show all trends for the last hour", output: "[[PRICE_TREND|all|60]]" },
    ],
    requiresWallet: false,
    mutatesState: false,
  },
  {
    id: "price_predict",
    name: "Price Prediction",
    description: "Momentum-based price prediction for Mento assets with confidence levels",
    category: "forex",
    commandTag: "PRICE_PREDICT",
    params: [
      { name: "pair", description: "Pair to predict (e.g. CELO/cUSD) or 'all'", required: false, example: "CELO/cUSD" },
    ],
    examples: [
      { input: "predict CELO/cUSD price", output: "[[PRICE_PREDICT|CELO/cUSD]]" },
      { input: "give me predictions for all pairs", output: "[[PRICE_PREDICT|all]]" },
    ],
    requiresWallet: false,
    mutatesState: false,
  },
  {
    id: "price_alerts",
    name: "Price Alerts",
    description: "Check for significant price movements, volatility spikes, and crossovers",
    category: "forex",
    commandTag: "PRICE_ALERTS",
    params: [
      { name: "threshold", description: "Minimum % change to alert (default 2)", required: false, example: "2" },
    ],
    examples: [
      { input: "any price alerts?", output: "[[PRICE_ALERTS|2]]" },
      { input: "check for big moves", output: "[[PRICE_ALERTS|1]]" },
    ],
    requiresWallet: false,
    mutatesState: false,
  },
];

export default SKILL_DEFINITIONS;

