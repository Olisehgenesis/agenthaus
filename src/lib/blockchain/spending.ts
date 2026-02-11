/**
 * Spending limits — USD equivalent conversion
 *
 * Only known tokens with USD-equivalent prices are counted toward spending.
 * CELO: uses SortedOracles CELO/cUSD rate (cUSD ≈ $1)
 * cUSD, cEUR, cREAL: fixed approximations
 * Unknown tokens (e.g. agent tokens): not counted — no Uniswap price
 */

const STABLE_USD_APPROX: Record<string, number> = {
  CUSD: 1,
  CEUR: 1.08,
  CREAL: 0.2,
};

/**
 * Convert transaction amount to USD for spending limit.
 * Returns null for unknown tokens (agent tokens, custom ERC20s) — caller should skip increment.
 */
export async function getAmountUsd(
  currency: string,
  amount: number
): Promise<number | null> {
  const upper = currency.toUpperCase();

  if (upper === "AGENT_TOKEN" || upper.startsWith("0X")) {
    return null;
  }

  if (STABLE_USD_APPROX[upper] !== undefined) {
    return amount * STABLE_USD_APPROX[upper];
  }

  if (upper === "CELO") {
    try {
      const { getOracleRate } = await import("./mento");
      const rate = await getOracleRate("cUSD");
      return amount * rate.rate;
    } catch {
      return amount * 0.55;
    }
  }

  return null;
}
