"use client";

import { useState, useCallback, useEffect } from "react";

export interface EconomicsData {
  totalRevenue: string;
  totalCosts: string;
  profitLoss: string;
  runway?: { months: number; status: string };
}

/** Normalize API response - SelfClaw may return totalRevenueUsd/netUsd etc. */
export function normalizeEconomics(raw: Record<string, unknown> | null): EconomicsData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const toStr = (v: unknown): string =>
    typeof v === "string" ? v : typeof v === "number" ? String(v) : "0";
  let runway: { months: number; status: string } | undefined;
  if (r.runway && typeof r.runway === "object" && !Array.isArray(r.runway)) {
    const rw = r.runway as Record<string, unknown>;
    const months = typeof rw.months === "number" ? rw.months : 0;
    const status = typeof rw.status === "string" ? rw.status : "";
    runway = { months, status };
  }
  return {
    totalRevenue: toStr(r.totalRevenue ?? r.totalRevenueUsd ?? 0),
    totalCosts: toStr(r.totalCosts ?? r.totalCostUsd ?? 0),
    profitLoss: toStr(r.profitLoss ?? r.netUsd ?? 0),
    runway,
  };
}

export interface PoolData {
  agentName?: string;
  tokenAddress?: string;
  price?: number;
  volume24h?: number;
  marketCap?: number;
}

export function useSelfClawEconomy(agentId: string | undefined, verified: boolean) {
  const [economics, setEconomics] = useState<EconomicsData | null>(null);
  const [pools, setPools] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletRegistering, setWalletRegistering] = useState(false);
  const [tokenDeploying, setTokenDeploying] = useState(false);
  const [logSending, setLogSending] = useState(false);
  const [sponsorRequesting, setSponsorRequesting] = useState(false);

  const fetchEconomics = useCallback(async () => {
    if (!agentId || !verified) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/selfclaw/economics`);
      if (res.ok) {
        const data = await res.json();
        setEconomics(normalizeEconomics(data));
      } else {
        const err = await res.json();
        setError(err.error || "Failed to fetch economics");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [agentId, verified]);

  const fetchPools = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/selfclaw/pools`);
      if (res.ok) {
        const data = await res.json();
        setPools(data.pools || []);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (verified) {
      fetchEconomics();
      fetchPools();
    }
  }, [verified, fetchEconomics, fetchPools]);

  const registerWallet = useCallback(async () => {
    if (!agentId) return;
    setWalletRegistering(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/selfclaw/create-wallet`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to register wallet");
      }
      await fetchEconomics();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setWalletRegistering(false);
    }
  }, [agentId, fetchEconomics]);

  const deployToken = useCallback(
    async (name: string, symbol: string, initialSupply: string) => {
      if (!agentId) return;
      setTokenDeploying(true);
      setError(null);
      try {
        const res = await fetch(`/api/agents/${agentId}/selfclaw/deploy-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, symbol, initialSupply }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to deploy token");
        }
        await fetchEconomics();
        await fetchPools();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
        throw e;
      } finally {
        setTokenDeploying(false);
      }
    },
    [agentId, fetchEconomics, fetchPools]
  );

  const logRevenue = useCallback(
    async (amount: string, source: string, currency?: string, description?: string) => {
      if (!agentId) return;
      setLogSending(true);
      setError(null);
      try {
        const res = await fetch(`/api/agents/${agentId}/selfclaw/log-revenue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, currency: currency || "USD", source, description }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to log revenue");
        }
        await fetchEconomics();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
        throw e;
      } finally {
        setLogSending(false);
      }
    },
    [agentId, fetchEconomics]
  );

  const logCost = useCallback(
    async (amount: string, category: string, currency?: string, description?: string) => {
      if (!agentId) return;
      setLogSending(true);
      setError(null);
      try {
        const res = await fetch(`/api/agents/${agentId}/selfclaw/log-cost`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, currency: currency || "USD", category, description }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to log cost");
        }
        await fetchEconomics();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
        throw e;
      } finally {
        setLogSending(false);
      }
    },
    [agentId, fetchEconomics]
  );

  const requestSponsorship = useCallback(async () => {
    if (!agentId) return;
    setSponsorRequesting(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/selfclaw/request-sponsorship`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to request sponsorship");
      }
      await fetchPools();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSponsorRequesting(false);
    }
  }, [agentId, fetchPools]);

  return {
    economics,
    pools,
    loading,
    error,
    walletRegistering,
    tokenDeploying,
    logSending,
    sponsorRequesting,
    registerWallet,
    deployToken,
    logRevenue,
    logCost,
    requestSponsorship,
    refresh: () => {
      fetchEconomics();
      fetchPools();
    },
  };
}
