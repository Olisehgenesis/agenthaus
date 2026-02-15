"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Plus,
  ChevronRight,
  Loader2,
  Wallet,
  BadgeCheck,
  ArrowLeft,
} from "lucide-react";
import { getTemplateIcon, getStatusColor } from "@/lib/utils";
import { ipfsToPublicGatewayUrl } from "@/lib/ipfs-url";

interface AgentData {
  id: string;
  name: string;
  description: string | null;
  templateType: string;
  imageUrl: string | null;
  status: string;
  spendingLimit: number;
  spendingUsed: number;
  reputationScore: number;
  agentWalletAddress: string | null;
  erc8004AgentId: string | null;
  transactions: { id: string }[];
  verification?: {
    selfxyzVerified: boolean;
    humanId: string | null;
    verifiedAt: string | null;
  } | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [agents, setAgents] = React.useState<AgentData[]>([]);
  const [loading, setLoading] = React.useState(true);

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

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <Wallet className="w-16 h-16 text-forest-faint mb-4" />
        <h2 className="text-xl font-bold text-forest mb-2">Connect Your Wallet</h2>
        <p className="text-forest-muted max-w-sm">
          Connect your wallet to view your agents.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-forest animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gypsum">
      {/* Sticky header — beta/create style */}
      <header className="sticky top-0 z-10 border-b border-forest/10 bg-gypsum/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-forest-muted hover:text-forest"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-base font-semibold text-forest">Profile</h1>
            <p className="text-xs text-forest-muted">Your agents</p>
          </div>
        </div>
        <Link href="/dashboard/agents/new">
          <Button variant="glow" size="sm" className="rounded-lg">
            <Plus className="w-4 h-4" />
            New
          </Button>
        </Link>
      </header>

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 sm:p-6">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-forest/10 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-forest" />
            </div>
            <h3 className="text-forest font-medium mb-1">No Agents Yet</h3>
            <p className="text-sm text-forest-muted max-w-xs mb-6">
              Create your first AI agent to get started on Celo.
            </p>
            <Link href="/dashboard/agents/new">
              <Button variant="glow" className="rounded-lg">
                <Plus className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent, i) => {
              const avatarSrc = agent.imageUrl
                ? ipfsToPublicGatewayUrl(agent.imageUrl)
                : `/api/random-avatar?t=${agent.id}-${i}-${Date.now()}`;
              return (
              <Link
                key={agent.id}
                href={`/dashboard/agents/${agent.id}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-white border border-forest/10 hover:border-forest/20 transition-colors"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gypsum border border-forest/15 shrink-0">
                  <Image
                    src={avatarSrc}
                    alt={agent.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                    unoptimized={agent.imageUrl?.startsWith("ipfs://") || !agent.imageUrl}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-forest truncate">{agent.name}</h3>
                    {agent.verification?.selfxyzVerified && (
                      <BadgeCheck className="w-4 h-4 text-forest-light shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge className={getStatusColor(agent.status)}>
                      {agent.status === "active" && (
                        <span className="w-1.5 h-1.5 bg-forest rounded-full mr-1 animate-pulse" />
                      )}
                      {agent.status}
                    </Badge>
                    {agent.transactions?.length > 0 && (
                      <span className="text-xs text-forest-muted">
                        {agent.transactions.length} txns
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-forest-muted shrink-0" />
              </Link>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
