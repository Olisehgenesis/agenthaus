"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, DollarSign, Activity, Fuel, BadgeCheck, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { AgentData, VerificationStatus, TransactionData } from "../_types";

interface StatsCardsProps {
  agent: AgentData;
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
  verificationStatus,
  isConnected,
  isCeloMainnet,
  transactions,
  confirmedCount,
  totalGas,
  onOpenVerify,
  onSwitchToCelo,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {/* Verification Status */}
      <Card
        className={`cursor-pointer transition-all ${
          verificationStatus?.verified
            ? "border-forest/30 hover:border-forest/50"
            : !isCeloMainnet
              ? "border-amber-500/20 hover:border-amber-500/40"
              : "border-violet-500/20 hover:border-violet-500/40"
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
              <ShieldCheck className="w-4 h-4 text-violet-400" />
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
              <div className="text-xs text-forest-muted/70 mt-1">Connect wallet</div>
            </>
          ) : !isCeloMainnet ? (
            <>
              <div className="text-xl font-bold text-amber-400">⚠</div>
              <div className="text-xs text-amber-400/80 mt-1">Switch to Celo</div>
            </>
          ) : verificationStatus && ["pending", "qr_ready", "challenge_signed"].includes(verificationStatus.status) ? (
            <>
              <div className="text-xl font-bold text-violet-400">Pending</div>
              <div className="text-xs text-violet-400/60 mt-1 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Scan QR
              </div>
            </>
          ) : (
            <>
              <div className="text-xl font-bold text-forest-muted">—</div>
              <div className="text-xs text-violet-400 mt-1">Click to verify</div>
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
          <div className="text-xl font-bold text-forest">
            {agent.reputationScore > 0 ? `${agent.reputationScore}/5.0` : "—"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-purple-400" />
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

