"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Pause, Play, ExternalLink, Shield,
  ShieldCheck, BadgeCheck, AlertCircle, Loader2, ScanLine,
} from "lucide-react";
import { getTemplateIcon, getStatusColor } from "@/lib/utils";
import { BLOCK_EXPLORER } from "@/lib/constants";
import type { AgentData, VerificationStatus } from "../_types";

interface AgentHeaderProps {
  agent: AgentData;
  verificationStatus: VerificationStatus | null;
  isConnected: boolean;
  isCeloMainnet: boolean;
  isQrReady: boolean;
  isSessionActive: boolean;
  verifyLoading: boolean;
  onBack: () => void;
  onToggleStatus: () => void;
  onOpenIdentityModal: () => void;
  onOpenVerifyModal: () => void;
  onSwitchToCelo: () => void;
}

export function AgentHeader({
  agent,
  verificationStatus,
  isConnected,
  isCeloMainnet,
  isQrReady,
  isSessionActive,
  verifyLoading,
  onBack,
  onToggleStatus,
  onOpenIdentityModal,
  onOpenVerifyModal,
  onSwitchToCelo,
}: AgentHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="text-3xl">{getTemplateIcon(agent.templateType)}</div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-forest">{agent.name}</h1>
              {verificationStatus?.verified && (
                <span title="SelfClaw Verified">
                  <BadgeCheck className="w-5 h-5 text-forest-light" />
                </span>
              )}
              <Badge className={getStatusColor(agent.status)}>
                {agent.status === "active" && (
                  <span className="w-1.5 h-1.5 bg-forest rounded-full mr-1 animate-pulse" />
                )}
                {agent.status}
              </Badge>
            </div>
            <p className="text-forest-muted text-sm mt-1">
              {agent.description || "No description"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToggleStatus}>
          {agent.status === "active" ? (
            <><Pause className="w-4 h-4" /> Pause</>
          ) : (
            <><Play className="w-4 h-4" /> Resume</>
          )}
        </Button>

        {agent.agentWalletAddress && (
          <a
            href={`${BLOCK_EXPLORER}/address/${agent.agentWalletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary" size="sm">
              <ExternalLink className="w-4 h-4" /> View On-Chain
            </Button>
          </a>
        )}

        {agent.erc8004AgentId && (
          <Button
            variant="secondary"
            size="sm"
            className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
            onClick={onOpenIdentityModal}
          >
            <Shield className="w-4 h-4" /> Identity
          </Button>
        )}

        {/* SelfClaw Verify Button */}
        {verificationStatus?.verified ? (
          <Button
            variant="secondary"
            size="sm"
            className="bg-forest/10 border-forest/30 text-forest-light hover:bg-forest/20"
            onClick={onOpenVerifyModal}
          >
            <BadgeCheck className="w-4 h-4" /> Verified
          </Button>
        ) : !isConnected ? (
          <Button variant="secondary" size="sm" className="border-forest/20 text-forest-muted" disabled>
            <ShieldCheck className="w-4 h-4" /> Connect Wallet to Verify
          </Button>
        ) : !isCeloMainnet ? (
          <Button
            variant="secondary"
            size="sm"
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            onClick={onSwitchToCelo}
          >
            <AlertCircle className="w-4 h-4" /> Switch to Celo Mainnet
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
            onClick={onOpenVerifyModal}
            disabled={verifyLoading}
          >
            {verifyLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
            ) : isQrReady && isSessionActive ? (
              <><ScanLine className="w-4 h-4" /> Scan QR</>
            ) : (
              <><ShieldCheck className="w-4 h-4" /> Verify</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

