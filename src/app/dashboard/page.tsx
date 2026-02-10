"use client";

import React from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { formatAddress, formatCurrency, getTemplateIcon, formatDate } from "@/lib/utils";

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
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Wallet className="w-16 h-16 text-slate-600 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
        <p className="text-slate-400 max-w-sm">
          Connect your wallet to view your dashboard, manage agents, and interact with the Celo Sepolia testnet.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Welcome back, {address ? formatAddress(address) : "user"}
            <Badge variant="outline" className="ml-2 text-[10px]">Celo Sepolia Testnet</Badge>
          </p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button variant="glow">
            <Plus className="w-4 h-4" />
            Create Agent
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Agents", value: stats?.totalAgents ?? 0, icon: Bot, color: "text-emerald-400" },
          { label: "Active", value: stats?.activeAgents ?? 0, icon: Activity, color: "text-green-400" },
          { label: "Transactions", value: stats?.totalTransactions ?? 0, icon: TrendingUp, color: "text-blue-400" },
          { label: "Value Moved", value: formatCurrency(stats?.totalValueTransferred ?? 0), icon: DollarSign, color: "text-purple-400" },
          { label: "Avg Reputation", value: stats?.averageReputation ? `${stats.averageReputation}/5` : "—", icon: Star, color: "text-amber-400" },
          { label: "Gas Spent", value: stats?.totalGasSpent ? `${stats.totalGasSpent} CELO` : "0 CELO", icon: Fuel, color: "text-orange-400" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-xs text-slate-500">{stat.label}</span>
              </div>
              <div className="text-lg font-bold text-white">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active Agents */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Your Agents</CardTitle>
                <Link href="/dashboard/agents">
                  <Button variant="ghost" size="sm" className="text-xs">
                    View All <ArrowUpRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <div className="text-center py-8">
                  <Bot className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 mb-3">No agents yet</p>
                  <Link href="/dashboard/agents/new">
                    <Button variant="secondary" size="sm">
                      <Plus className="w-3 h-3" /> Create First Agent
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <Link key={agent.id} href={`/dashboard/agents/${agent.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="text-xl">{getTemplateIcon(agent.templateType)}</div>
                          <div>
                            <div className="text-sm font-medium text-white">{agent.name}</div>
                            <div className="text-xs text-slate-500 capitalize">{agent.templateType}</div>
                          </div>
                        </div>
                        <Badge variant={agent.status === "active" ? "default" : "warning"}>
                          {agent.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <Badge variant="secondary">{activity.length} events</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    No activity yet. Create and deploy an agent to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activity.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30"
                    >
                      <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                        item.type === "action" ? "bg-emerald-500" :
                        item.type === "warning" ? "bg-amber-500" :
                        item.type === "error" ? "bg-red-500" : "bg-blue-500"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-300">{item.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">{item.agentName}</span>
                          <span className="text-slate-700">•</span>
                          <span className="text-xs text-slate-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
