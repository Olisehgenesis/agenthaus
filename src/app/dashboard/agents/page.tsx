"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useAccount } from "wagmi";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
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
  ArrowUpRight,
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
import { getBlockExplorer, DEPLOYMENT_ATTRIBUTION } from "@/lib/constants";
import { ipfsToPublicGatewayUrl } from "@/lib/ipfs-url";

interface AgentData {
  id: string;
  name: string;
  description: string | null;
  templateType: string;
  imageUrl: string | null;
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white border-4 border-forest shadow-hard">
        <Wallet className="w-20 h-20 text-forest mb-6" />
        <h2 className="text-4xl font-black uppercase tracking-tighter text-forest mb-4">Access Denied</h2>
        <p className="text-forest text-lg max-w-sm font-medium mb-8">
          Connect your wallet to manage your AI agent fleet.
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
        <span className="mt-4 font-bold uppercase tracking-widest">Scanning Network...</span>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b-4 border-forest">
        <div>
          <h1 className="text-6xl font-black uppercase tracking-tighter text-forest leading-none">
            Registry
          </h1>
          <p className="text-forest font-bold uppercase tracking-widest mt-4">
            Total Capacity: {agents.length} Nodes Operational
          </p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button size="lg" className="text-xl px-12 h-16">
            <Plus className="w-6 h-6 stroke-[3px]" />
            New Deployment
          </Button>
        </Link>
      </div>

      {/* Agents Grid */}
      {agents.length === 0 ? (
        <Card className="p-24 text-center bg-gypsum-dark border-4 border-dashed border-forest/20 shadow-none">
          <Bot className="w-20 h-20 text-forest/10 mx-auto mb-6" />
          <h3 className="text-2xl font-black uppercase tracking-tighter mb-4">No Agents Online</h3>
          <p className="text-forest font-medium max-w-sm mx-auto mb-8">
            Deploy your first autonomous node to start interacting with the Celo ecosystem.
          </p>
          <Link href="/dashboard/agents/new">
            <Button size="lg">Initialize First Agent</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {agents.map((agent) => (
            <div key={agent.id} className="group relative">
              <div className="absolute inset-0 bg-forest translate-x-1.5 translate-y-1.5 group-hover:translate-x-2.5 group-hover:translate-y-2.5 transition-transform" />
              <div className="relative bg-white border-2 border-forest p-6 flex flex-col h-full transition-transform group-hover:-translate-y-0.5">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 border-2 border-forest bg-celo flex items-center justify-center text-3xl">
                      {agent.imageUrl ? (
                        <Image
                          src={ipfsToPublicGatewayUrl(agent.imageUrl)}
                          alt={agent.name}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                          unoptimized={agent.imageUrl.startsWith("ipfs://")}
                        />
                      ) : (
                        getTemplateIcon(agent.templateType)
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black uppercase leading-tight">{agent.name}</h3>
                        {agent.verification?.selfxyzVerified && (
                          <BadgeCheck className="w-5 h-5 text-forest" />
                        )}
                      </div>
                      <p className="text-xs font-bold uppercase text-forest/50 mt-1">
                        {agent.templateType} NODE
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === agent.id ? null : agent.id)}
                      className="w-10 h-10 border-2 border-forest flex items-center justify-center hover:bg-celo transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {menuOpen === agent.id && (
                      <div className="absolute right-0 top-12 z-20 w-56 bg-white border-4 border-forest shadow-hard p-1">
                        <button
                          onClick={() =>
                            agent.status === "active"
                              ? handlePause(agent.id)
                              : handleResume(agent.id)
                          }
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-black uppercase hover:bg-celo transition-colors text-left"
                        >
                          {agent.status === "active" ? (
                            <><Pause className="w-4 h-4" /> Pause Node</>
                          ) : (
                            <><Play className="w-4 h-4" /> Resume Node</>
                          )}
                        </button>
                        {agent.agentWalletAddress && (
                          <a
                            href={`${getBlockExplorer(agent.erc8004ChainId ?? chainId ?? 42220)}/address/${agent.agentWalletAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-black uppercase hover:bg-celo transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" /> Explorer
                          </a>
                        )}
                        <div className="h-1 bg-forest mx-1 my-1" />
                        <button
                          onClick={() => handleDelete(agent.id)}
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-black uppercase bg-red-500 text-white hover:bg-red-600 transition-colors text-left"
                        >
                          <Trash2 className="w-4 h-4" /> Terminate
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm font-bold leading-relaxed mb-6 flex-grow">
                  {agent.description || "NO DATA AVAILABLE"}
                </p>

                {/* Status Section */}
                <div className="grid grid-cols-2 gap-2 mb-6">
                  <div className={`border-2 border-forest p-2 text-center text-[10px] font-black uppercase ${agent.status === "active" ? "bg-green-400" : "bg-amber-400"
                    }`}>
                    {agent.status}
                  </div>
                  {agent.verification?.selfxyzVerified ? (
                    <div className="border-2 border-forest bg-celo p-2 text-center text-[10px] font-black uppercase">
                      Verified
                    </div>
                  ) : (
                    <div className="border-2 border-forest bg-gypsum p-2 text-center text-[10px] font-black uppercase">
                      Unverified
                    </div>
                  )}
                </div>

                {/* Stats Bar */}
                <div className="space-y-4 pt-6 border-t-2 border-forest">
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase mb-1.5">
                      <div className="flex items-center gap-1.5 cursor-help" onClick={() => setSpendingModalAgent(agent)}>
                        <span>Spending</span>
                        <Info className="w-3 h-3" />
                      </div>
                      <span>
                        {formatCurrency(agent.spendingUsed)} / {formatCurrency(agent.spendingLimit)}
                      </span>
                    </div>
                    <div className="h-3 border-2 border-forest bg-gypsum overflow-hidden">
                      <div
                        className="h-full bg-forest transition-all"
                        style={{ width: `${Math.min(100, (agent.spendingUsed / agent.spendingLimit) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                      <Activity className="w-4 h-4" />
                      {agent.transactions?.length ?? 0} Ops
                    </div>
                    <Link href={`/dashboard/agents/${agent.id}`}>
                      <Button size="sm" variant="outline" className="h-8 px-4 text-[10px]">
                        Details
                        <ArrowUpRight className="w-3 h-3 h-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
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
