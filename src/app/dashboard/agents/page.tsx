"use client";

import React from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Bot,
  Plus,
  Star,
  Activity,
  DollarSign,
  MoreVertical,
  ExternalLink,
  Pause,
  Play,
  Trash2,
  Loader2,
  Wallet,
  BadgeCheck,
  Info,
} from "lucide-react";
import { SpendingLimitModal } from "./_components/SpendingLimitModal";
import { getTemplateIcon, getStatusColor, formatCurrency, formatDate, formatAddress } from "@/lib/utils";
import { getBlockExplorer } from "@/lib/constants";

interface AgentData {
  id: string;
  name: string;
  description: string | null;
  templateType: string;
  status: string;
  llmProvider: string;
  llmModel: string;
  spendingLimit: number;
  spendingUsed: number;
  reputationScore: number;
  agentWalletAddress: string | null;
  erc8004AgentId: string | null;
  erc8004ChainId?: number | null;
  createdAt: string;
  deployedAt: string | null;
  transactions: { id: string }[];
  verification?: {
    selfxyzVerified: boolean;
    humanId: string | null;
    verifiedAt: string | null;
  } | null;
}

export default function AgentsPage() {
  const { address, isConnected, chainId } = useAccount();
  const [agents, setAgents] = React.useState<AgentData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState<string | null>(null);
  const [spendingModalAgent, setSpendingModalAgent] = React.useState<AgentData | null>(null);

  const fetchAgents = React.useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/agents?ownerAddress=${address}`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error("Failed to load agents:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  React.useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchAgents();
  }, [address, fetchAgents]);

  const handlePause = async (agentId: string) => {
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paused" }),
      });
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, status: "paused" } : a))
      );
    } catch (err) {
      console.error("Failed to pause agent:", err);
    }
    setMenuOpen(null);
  };

  const handleResume = async (agentId: string) => {
    try {
      await fetch(`/api/agents/${agentId}/deploy`, { method: "POST" });
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, status: "active" } : a))
      );
    } catch (err) {
      console.error("Failed to resume agent:", err);
    }
    setMenuOpen(null);
  };

  const handleDelete = async (agentId: string) => {
    try {
      await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    } catch (err) {
      console.error("Failed to delete agent:", err);
    }
    setMenuOpen(null);
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Wallet className="w-16 h-16 text-forest-faint mb-4" />
        <h2 className="text-xl font-bold text-forest mb-2">Connect Your Wallet</h2>
        <p className="text-forest-muted max-w-sm">
          Connect your wallet to view and manage your AI agents.
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest">My Agents</h1>
          <p className="text-forest-muted text-sm mt-1">
            Manage and monitor your deployed AI agents
          </p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button variant="glow">
            <Plus className="w-4 h-4" />
            New Agent
          </Button>
        </Link>
      </div>

      {/* Agents Grid */}
      {agents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bot className="w-12 h-12 text-forest-faint mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-forest mb-2">No Agents Yet</h3>
            <p className="text-forest-muted mb-6">
              Create your first AI agent to get started on Celo.
            </p>
            <Link href="/dashboard/agents/new">
              <Button variant="glow">
                <Plus className="w-4 h-4" />
                Create Your First Agent
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <Card key={agent.id} className="group hover:border-forest/20 transition-all duration-300">
              <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{getTemplateIcon(agent.templateType)}</div>
                    <div>
                      <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-forest">{agent.name}</h3>
                        {agent.verification?.selfxyzVerified && (
                          <span title="SelfClaw Verified">
                            <BadgeCheck className="w-4 h-4 text-forest-light flex-shrink-0" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-forest-muted capitalize">{agent.templateType} agent</p>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === agent.id ? null : agent.id)}
                      className="p-1 rounded hover:bg-gypsum-dark transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4 text-forest-muted" />
                    </button>
                    {menuOpen === agent.id && (
                      <div className="absolute right-0 top-8 z-10 w-44 bg-white border border-forest/10 rounded-lg shadow-xl p-1">
                        <button
                          onClick={() =>
                            agent.status === "active"
                              ? handlePause(agent.id)
                              : handleResume(agent.id)
                          }
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-forest hover:bg-gypsum rounded-md cursor-pointer"
                        >
                          {agent.status === "active" ? (
                            <><Pause className="w-4 h-4" /> Pause Agent</>
                          ) : (
                            <><Play className="w-4 h-4" /> Resume Agent</>
                          )}
                        </button>
                        {agent.agentWalletAddress && (
                          <a
                            href={`${getBlockExplorer(agent.erc8004ChainId ?? chainId ?? 42220)}/address/${agent.agentWalletAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-forest hover:bg-gypsum rounded-md"
                          >
                            <ExternalLink className="w-4 h-4" /> View On-Chain
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(agent.id)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Agent
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-forest-muted mb-4 line-clamp-2">
                  {agent.description || "No description"}
                </p>

                {/* Status & Reputation */}
                <div className="flex items-center gap-2 mb-4">
                  <Badge className={getStatusColor(agent.status)}>
                    {agent.status === "active" && <span className="w-1.5 h-1.5 bg-forest rounded-full mr-1 animate-pulse" />}
                    {agent.status}
                  </Badge>
                  {agent.reputationScore > 0 && (
                    <div className="flex items-center gap-1 text-xs text-forest-muted">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      {agent.reputationScore}
                    </div>
                  )}
                  {agent.erc8004AgentId && (
                    <Badge variant="outline" className="text-[10px]">
                      ERC-8004 #{agent.erc8004AgentId}
                    </Badge>
                  )}
                  {agent.verification?.selfxyzVerified && (
                    <Badge variant="outline" className="text-[10px] border-forest/30 text-forest gap-1">
                      <BadgeCheck className="w-3 h-3" />
                      Verified
                    </Badge>
                  )}
                </div>

                {/* Wallet Address */}
                {agent.agentWalletAddress && (
                  <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-gypsum">
                    <Wallet className="w-3.5 h-3.5 text-forest flex-shrink-0" />
                    <span className="text-xs font-mono text-forest/80">{formatAddress(agent.agentWalletAddress)}</span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        navigator.clipboard.writeText(agent.agentWalletAddress!);
                      }}
                      className="text-forest-muted hover:text-forest transition-colors cursor-pointer ml-auto"
                      title="Copy address"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Spending */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setSpendingModalAgent(agent);
                      }}
                      className="flex items-center gap-1.5 text-forest-muted hover:text-celo transition-colors cursor-pointer"
                      title="Adjust spending limit"
                    >
                      <span>Spending</span>
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-forest/70">
                      {formatCurrency(agent.spendingUsed)} / {formatCurrency(agent.spendingLimit)}
                    </span>
                  </div>
                  <Progress value={agent.spendingUsed} max={agent.spendingLimit} />
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between pt-3 border-t border-forest/10">
                  <div className="flex items-center gap-1 text-xs text-forest-muted">
                    <Activity className="w-3 h-3" />
                    {agent.transactions?.length ?? 0} txns
                  </div>
                  <div className="flex items-center gap-1 text-xs text-forest-muted">
                    <DollarSign className="w-3 h-3" />
                    {agent.llmModel.split("/").pop()?.split(":")[0] || agent.llmModel}
                  </div>
                </div>

                {/* Action */}
                <Link href={`/dashboard/agents/${agent.id}`} className="block mt-4">
                  <Button variant="secondary" size="sm" className="w-full">
                    View Details
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {spendingModalAgent && (
        <SpendingLimitModal
          open={!!spendingModalAgent}
          onClose={() => setSpendingModalAgent(null)}
          agentId={spendingModalAgent.id}
          agentName={spendingModalAgent.name}
          spendingUsed={spendingModalAgent.spendingUsed}
          spendingLimit={spendingModalAgent.spendingLimit}
          onUpdated={() => fetchAgents()}
        />
      )}
    </div>
  );
}
