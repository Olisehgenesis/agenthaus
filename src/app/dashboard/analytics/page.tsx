"use client";

import React from "react";
import { useAccount, useChainId } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  DollarSign,
  Activity,
  Fuel,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Wallet,
  BarChart3,
} from "lucide-react";
import { getTemplateIcon } from "@/lib/utils";

interface Metrics {
  totalValueTransferred: number;
  totalTransactions: number;
  successRate: number;
  totalGasSpent: number;
  avgReputation: number;
}

interface DailyData {
  day: string;
  date: string;
  transactions: number;
  volume: number;
}

interface AgentPerformance {
  id: string;
  name: string;
  templateType: string;
  transactions: number;
  volume: number;
  reputation: number;
  gasSpent: number;
}

export default function AnalyticsPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [metrics, setMetrics] = React.useState<Metrics | null>(null);
  const [dailyData, setDailyData] = React.useState<DailyData[]>([]);
  const [agentPerformance, setAgentPerformance] = React.useState<AgentPerformance[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/analytics?ownerAddress=${address}`);
        if (res.ok) {
          const data = await res.json();
          setMetrics(data.metrics);
          setDailyData(data.dailyData);
          setAgentPerformance(data.agentPerformance);
        }
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [address]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Wallet className="w-16 h-16 text-forest-faint mb-4" />
        <h2 className="text-xl font-bold text-forest mb-2">Connect Your Wallet</h2>
        <p className="text-forest-muted max-w-sm">
          Connect your wallet to view analytics across your agents.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-forest animate-spin" />
      </div>
    );
  }

  const maxVolume = Math.max(...dailyData.map((d) => d.volume), 1);
  const maxTxns = Math.max(...dailyData.map((d) => d.transactions), 1);

  const metricsDisplay = [
    {
      label: "Total Value Transferred",
      value: metrics ? `$${metrics.totalValueTransferred.toFixed(2)}` : "$0.00",
      icon: DollarSign,
      color: "text-forest",
    },
    {
      label: "Total Transactions",
      value: metrics?.totalTransactions?.toString() ?? "0",
      icon: Activity,
      color: "text-blue-400",
    },
    {
      label: "Success Rate",
      value: metrics ? `${metrics.successRate.toFixed(1)}%` : "—",
      icon: TrendingUp,
      color: "text-purple-400",
    },
    {
      label: "Total Gas Spent",
      value: metrics ? `${metrics.totalGasSpent} CELO` : "0 CELO",
      icon: Fuel,
      color: "text-orange-400",
    },
    {
      label: "Avg Reputation",
      value: metrics && metrics.avgReputation > 0 ? `${metrics.avgReputation}/5.0` : "—",
      icon: Star,
      color: "text-amber-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-forest">Analytics</h1>
        <p className="text-forest-muted text-sm mt-1">
          Performance metrics and insights across all agents
          <Badge variant="outline" className="ml-2 text-[10px]">
            {chainId === 42220 ? "Celo Mainnet" : chainId === 11142220 ? "Celo Sepolia Testnet" : `Chain ${chainId}`}
          </Badge>
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {metricsDisplay.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <metric.icon className={`w-4 h-4 ${metric.color}`} />
                <span className="text-[11px] text-forest-muted/70 leading-tight">{metric.label}</span>
              </div>
              <div className="text-lg font-bold text-forest">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {dailyData.length > 0 && dailyData.some((d) => d.volume > 0 || d.transactions > 0) ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Transaction Volume Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Weekly Transaction Volume</CardTitle>
                <Badge variant="secondary">Last 7 days</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-2 h-48">
                {dailyData.map((day) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-xs text-forest-muted/70">${day.volume}</div>
                    <div className="w-full relative" style={{ height: `${Math.max((day.volume / maxVolume) * 150, 4)}px` }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-forest to-forest-light rounded-t-md opacity-80 hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-xs text-forest-muted">{day.day}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Transaction Count Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Daily Transactions</CardTitle>
                <Badge variant="secondary">Last 7 days</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-2 h-48">
                {dailyData.map((day) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-xs text-forest-muted/70">{day.transactions}</div>
                    <div className="w-full relative" style={{ height: `${Math.max((day.transactions / maxTxns) * 150, 4)}px` }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md opacity-80 hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-xs text-forest-muted">{day.day}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="w-12 h-12 text-forest-faint mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-forest mb-2">No Data Yet</h3>
            <p className="text-forest-muted">
              Deploy agents and process transactions to see analytics here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Agent Performance Table */}
      {agentPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Agent Performance</CardTitle>
              <Badge variant="secondary">{agentPerformance.length} agents</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-forest/10">
                    <th className="text-left text-xs font-medium text-forest-muted/70 pb-3">Agent</th>
                    <th className="text-right text-xs font-medium text-forest-muted/70 pb-3">Transactions</th>
                    <th className="text-right text-xs font-medium text-forest-muted/70 pb-3">Volume</th>
                    <th className="text-right text-xs font-medium text-forest-muted/70 pb-3">Reputation</th>
                    <th className="text-right text-xs font-medium text-forest-muted/70 pb-3">Gas Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {agentPerformance.map((agent) => (
                    <tr key={agent.id} className="border-b border-forest/10/50 last:border-0">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="text-lg">{getTemplateIcon(agent.templateType)}</div>
                          <span className="text-sm font-medium text-forest">{agent.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-sm text-forest/80">{agent.transactions}</td>
                      <td className="py-3 text-right text-sm text-forest/80">${agent.volume.toFixed(2)}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span className="text-sm text-forest/80">
                            {agent.reputation > 0 ? agent.reputation : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-sm text-forest/80">{agent.gasSpent} CELO</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
