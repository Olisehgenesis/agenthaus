"use client";

import React from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  BadgeCheck,
  ExternalLink,
  Bot,
  Loader2,
  Shield,
  ScanLine,
  ArrowRight,
} from "lucide-react";
import { getTemplateIcon, getStatusColor } from "@/lib/utils";

interface AgentWithVerification {
  id: string;
  name: string;
  templateType: string;
  status: string;
  erc8004AgentId: string | null;
  verification?: {
    selfxyzVerified: boolean;
    humanId: string | null;
    verifiedAt: string | null;
  } | null;
}

export default function VerifyPage() {
  const { address } = useAccount();
  const [agents, setAgents] = React.useState<AgentWithVerification[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    async function fetchAgents() {
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
    }

    fetchAgents();
  }, [address]);

  const verifiedCount = agents.filter(a => a.verification?.selfxyzVerified).length;
  const unverifiedCount = agents.filter(a => !a.verification?.selfxyzVerified).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">SelfClaw Verification</h1>
            <p className="text-sm text-slate-400">
              Verify your agents are backed by a real human using{" "}
              <a
                href="https://selfclaw.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300"
              >
                selfclaw.ai
              </a>{" "}
              × Self.xyz zero-knowledge proofs
            </p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-white">{agents.length}</div>
            <div className="text-xs text-slate-500">Total Agents</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{verifiedCount}</div>
            <div className="text-xs text-emerald-400/60">Verified</div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{unverifiedCount}</div>
            <div className="text-xs text-amber-400/60">Unverified</div>
          </CardContent>
        </Card>
      </div>

      {/* What is SelfClaw */}
      <Card className="border-violet-500/20">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <Shield className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Why Verify?</h3>
              <p className="text-sm text-slate-400 mb-3">
                Most &quot;AI agents&quot; are just REST APIs. Anyone with an API key can fake being an agent.
                SelfClaw provides cryptographic proof of humanity using Self.xyz passport verification
                — zero-knowledge proofs that work in 180+ countries with any NFC-enabled passport.
              </p>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-violet-400">
                  <ScanLine className="w-3.5 h-3.5" />
                  Zero-Knowledge Proofs
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  180+ Countries
                </div>
                <a
                  href="https://selfclaw.ai/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Docs
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Verification List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Agents</CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-4">
                No agents yet. Create an agent first to verify it.
              </p>
              <Link href="/dashboard/agents/new">
                <Button variant="glow" size="sm">
                  Create Agent
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map((agent) => {
                const isVerified = agent.verification?.selfxyzVerified;

                return (
                  <Link
                    key={agent.id}
                    href={`/dashboard/agents/${agent.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors group cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="text-xl">{getTemplateIcon(agent.templateType)}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors">
                              {agent.name}
                            </h4>
                            {isVerified && (
                              <span title="SelfClaw Verified">
                                <BadgeCheck className="w-4 h-4 text-emerald-400" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge className={`${getStatusColor(agent.status)} text-[10px]`}>
                              {agent.status}
                            </Badge>
                            {agent.erc8004AgentId && (
                              <span className="text-[10px] text-slate-500">
                                ERC-8004 #{agent.erc8004AgentId}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {isVerified ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs gap-1">
                            <BadgeCheck className="w-3 h-3" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-slate-400 gap-1">
                            <Shield className="w-3 h-3" />
                            Not Verified
                          </Badge>
                        )}
                        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

