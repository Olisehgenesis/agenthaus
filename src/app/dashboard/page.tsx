"use client";

import React from "react";
import Link from "next/link";
import { useAccount, useChainId } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Activity,
  TrendingUp,
  DollarSign,
  Star,
  Fuel,
  Plus,
  ArrowUpRight,
  Clock,
  Loader2,
  Wallet,
  CheckCircle2,
} from "lucide-react";
import { formatAddress, formatCurrency, getTemplateIcon, formatDate, formatCompactNumber, formatCompactCurrency } from "@/lib/utils";
import { DEPLOYMENT_ATTRIBUTION } from "@/lib/constants";

interface DashboardStats {
  totalAgents: number;
  activeAgents: number;
  totalTransactions: number;
  totalValueTransferred: number;
  averageReputation: number;
  totalGasSpent: number;
}

interface AgentSummary {
  id: string;
  name: string;
  templateType: string;
  status: string;
  reputationScore: number;
  spendingUsed: number;
  spendingLimit: number;
}

interface RecentActivityItem {
  id: string;
  type: string;
  message: string;
  agentName: string;
  agentId: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [agents, setAgents] = React.useState<AgentSummary[]>([]);
  const [activity, setActivity] = React.useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const res = await fetch(`/api/dashboard/stats?ownerAddress=${address}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          setAgents(data.agents);
          setActivity(data.recentActivity);
        }
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [address]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white border-4 border-forest shadow-hard">
        <Wallet className="w-20 h-20 text-forest mb-6" />
        <h2 className="text-4xl font-black uppercase tracking-tighter text-forest mb-4">Connect Wallet</h2>
        <p className="text-forest text-lg max-w-sm font-medium mb-8">
          Connect your wallet to access your AI agent dashboard and manage your Celo assets.
        </p>
        <div className="border-4 border-forest shadow-hard bg-celo p-1">
          <ConnectWalletButton size="lg" />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-forest animate-spin" />
        <span className="mt-4 font-bold uppercase tracking-widest">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b-2 border-forest">
        <div>
          <h1 className="text-6xl font-black uppercase tracking-tighter text-forest leading-none">
            Dashboard
          </h1>
          <div className="flex items-center gap-3 mt-4">
            <span className="bg-forest text-white px-3 py-1 font-bold text-sm uppercase">
              {address ? formatAddress(address) : "UNKNOWN"}
            </span>
            <span className="bg-celo border-2 border-forest px-3 py-1 font-bold text-sm uppercase">
              {chainId === 42220 ? "Celo Mainnet" : "Celo Testnet"}
            </span>
          </div>
        </div>
        <Link href="/dashboard/agents/new">
          <Button size="lg" className="text-xl px-12 h-16">
            <Plus className="w-6 h-6 stroke-[3px]" />
            Create Agent
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Agents", value: stats?.totalAgents ?? 0, icon: Bot },
          { label: "Active Nodes", value: stats?.activeAgents ?? 0, icon: Activity },
          { label: "Transactions", value: stats?.totalTransactions ?? 0, icon: TrendingUp },
          { label: "Value (USD)", value: formatCompactCurrency(stats?.totalValueTransferred ?? 0), icon: DollarSign },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border-2 border-forest p-6 neobrutal-shadow hover:-translate-y-1 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-black uppercase tracking-widest text-forest">
                {stat.label}
              </span>
              <stat.icon className="w-6 h-6 text-forest stroke-[2.5px]" />
            </div>
            <div className="text-4xl font-black text-forest">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-12">
        {/* Agents List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black uppercase tracking-tighter">Your Agents</h2>
            <Link href="/dashboard/agents" className="text-sm font-bold uppercase underline decoration-4 underline-offset-4 hover:text-accent">
              View All
            </Link>
          </div>

          <div className="space-y-4">
            {agents.length === 0 ? (
              <div className="border-2 border-forest p-12 text-center bg-gypsum-dark">
                <Bot className="w-16 h-16 text-forest/20 mx-auto mb-4" />
                <p className="font-bold uppercase">No records found</p>
              </div>
            ) : (
              agents.map((agent) => (
                <Link key={agent.id} href={``}>
                  <div className="group relative">
                    <div className="absolute inset-0 bg-forest translate-x-1 translate-y-1 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform" />
                    <div className="relative bg-white border-2 border-forest p-4 flex items-center justify-between group-hover:-translate-y-0.5 transition-transform">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 border-2 border-forest bg-celo flex items-center justify-center text-2xl">
                          {getTemplateIcon(agent.templateType)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <div className="font-black uppercase text-lg leading-tight">{agent.name}</div>
                            {agent.status === "active" && (
                              <CheckCircle2 className="w-5 h-5 text-blue-500 fill-blue-500/10" />
                            )}
                          </div>
                          <div className="text-xs font-bold uppercase text-forest/60">{agent.templateType} • AGENTHAUS v1</div>
                        </div>
                      </div>
                      <div className={`px-3 py-1 text-xs font-black uppercase border-2 border-forest ${agent.status === "active" ? "bg-green-400" : "bg-amber-400"
                        }`}>
                        {agent.status}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="lg:col-span-3 space-y-6">
          <h2 className="text-3xl font-black uppercase tracking-tighter">Activity Feed</h2>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/logs" className="text-xs font-bold uppercase underline decoration-2 underline-offset-4 hover:text-accent">
              System Logs
            </Link>
            <div className="bg-forest text-white px-3 py-1 text-xs font-bold uppercase">
              {activity.length} Events
            </div>
          </div>

          <div className="border-2 border-forest bg-white neobrutal-shadow min-h-[400px]">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] p-12 text-center">
                <Activity className="w-16 h-16 text-forest/10 mb-4" />
                <p className="font-bold uppercase text-lg">System Idle</p>
                <p className="text-sm font-medium mt-2">Deploy an agent to begin logging</p>
              </div>
            ) : (
              <div className="divide-y-2 divide-forest">
                {activity.map((item) => (
                  <div key={item.id} className="p-4 flex gap-4 hover:bg-gypsum transition-colors">
                    <div className="w-10 h-10 border-2 border-forest bg-white flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-bold text-sm uppercase bg-forest text-white px-2 py-0.5 inline-block">
                          {item.agentName}
                        </p>
                        <span className="text-[10px] font-black uppercase text-forest/40">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm font-bold mt-2 leading-snug">
                        {item.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
