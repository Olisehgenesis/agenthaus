"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, DollarSign, Activity, Fuel, BadgeCheck, ShieldCheck, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { get8004ScanAgentUrl } from "@/lib/constants";
import type { AgentData, VerificationStatus, TransactionData } from "../_types";

interface StatsCardsProps {
  agent: AgentData;
  agentId: string;
  verificationStatus: VerificationStatus | null;
  isConnected: boolean;
  isCeloMainnet: boolean;
  transactions: TransactionData[];
  confirmedCount: number;
  totalGas: number;
  onOpenVerify: () => void;
  onSwitchToCelo: () => void;
}

export function StatsCards({
  agent,
  agentId,
  verificationStatus,
  isConnected,
  isCeloMainnet,
  transactions,
  confirmedCount,
  totalGas,
  onOpenVerify,
  onSwitchToCelo,
}: StatsCardsProps) {
  const [scanScore, setScanScore] = React.useState<{ score: number; url: string } | null>(null);
  React.useEffect(() => {
    if (!agent.erc8004AgentId || !agentId) return;
    fetch(`/api/agents/${agentId}/8004scan-score`)
      .then((r) => r.json())
      .then((d) => {
        if (d.score != null && d.url) setScanScore({ score: d.score, url: d.url });
      })
      .catch(() => {});
  }, [agentId, agent.erc8004AgentId]);

  const reputationDisplay = scanScore
    ? `${scanScore.score}`
    : agent.reputationScore > 0
      ? `${agent.reputationScore}/5.0`
      : "—";
  const scanUrl =
    scanScore?.url ?? (agent.erc8004AgentId ? get8004ScanAgentUrl(agent.erc8004ChainId ?? 42220, agent.erc8004AgentId) : null);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {/* Verification Status */}
      <Card
        className={`cursor-pointer transition-all ${
          verificationStatus?.verified
            ? "border-forest/30 hover:border-forest/50"
            : !isCeloMainnet
              ? "border-amber-500/20 hover:border-amber-500/40"
              : "border-accent/20 hover:border-accent/40"
        }`}
        onClick={() => {
          if (!isConnected || !isCeloMainnet) {
            if (!isCeloMainnet && isConnected) onSwitchToCelo();
            return;
          }
          onOpenVerify();
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            {verificationStatus?.verified ? (
              <BadgeCheck className="w-4 h-4 text-forest-light" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-accent" />
            )}
            <span className="text-xs text-forest-muted/70">Verification</span>
          </div>
          {verificationStatus?.verified ? (
            <>
              <div className="text-xl font-bold text-forest-light">Active</div>
              <div className="text-xs text-forest-light/60 mt-1">✅ Human Verified</div>
            </>
          ) : !isConnected ? (
            <>
              <div className="text-xl font-bold text-forest-muted/70">—</div>
              <div className="text-xs text-[#AB9FF2] mt-1">Connect wallet</div>
            </>
          ) : !isCeloMainnet ? (
            <>
              <div className="text-xl font-bold text-amber-400">⚠</div>
              <div className="text-xs text-amber-400/80 mt-1">Switch to Celo</div>
            </>
          ) : verificationStatus && ["pending", "qr_ready", "challenge_signed"].includes(verificationStatus.status) ? (
            <>
              <div className="text-xl font-bold text-accent">Pending</div>
              <div className="text-xs text-accent/60 mt-1 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Scan QR
              </div>
            </>
          ) : (
            <>
              <div className="text-xl font-bold text-forest-muted">—</div>
              <div className="text-xs text-accent mt-1">Click to verify</div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-xs text-forest-muted/70">Reputation</span>
          </div>
          <div className="text-xl font-bold text-forest">{reputationDisplay}</div>
          {scanUrl && agent.erc8004AgentId && (
            <a
              href={scanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-accent hover:text-accent-light flex items-center gap-1 mt-1"
            >
              View on 8004scan <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-accent" />
            <span className="text-xs text-forest-muted/70">Spending</span>
          </div>
          <div className="text-xl font-bold text-forest">{formatCurrency(agent.spendingUsed)}</div>
          <Progress value={agent.spendingUsed} max={agent.spendingLimit} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-forest-muted/70">Transactions</span>
          </div>
          <div className="text-xl font-bold text-forest">{transactions.length}</div>
          <div className="text-xs text-forest-muted/70 mt-1">{confirmedCount} confirmed</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Fuel className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-forest-muted/70">Gas Spent</span>
          </div>
          <div className="text-xl font-bold text-forest">{totalGas.toFixed(3)} CELO</div>
        </CardContent>
      </Card>
    </div>
  );
}

