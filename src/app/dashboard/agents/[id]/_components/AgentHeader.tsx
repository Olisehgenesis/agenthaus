"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Pause, Play, ExternalLink, Shield,
  ShieldCheck, BadgeCheck, AlertCircle, Loader2, ScanLine,
  Coins, ScanSearch, Upload,
} from "lucide-react";
import { getTemplateIcon, getStatusColor } from "@/lib/utils";
import { ipfsToPublicGatewayUrl } from "@/lib/ipfs-url";
import { getBlockExplorer, get8004ScanAgentUrl, DEPLOYMENT_ATTRIBUTION } from "@/lib/constants";
import type { AgentData, VerificationStatus } from "../_types";

interface AgentHeaderProps {
  agent: AgentData;
  /** Chain ID for explorer links (agent's chain: erc8004ChainId or connected) */
  agentChainId?: number;
  onImageUploaded?: () => void;
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
  onOpenTokenTab?: () => void;
}

export function AgentHeader({
  agent,
  agentChainId,
  onImageUploaded,
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
  onOpenTokenTab,
}: AgentHeaderProps) {
  const [imageUploading, setImageUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/agents/${agent.id}/image`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) onImageUploaded?.();
    } finally {
      setImageUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="relative group">
            {agent.imageUrl ? (
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-gypsum border border-forest/15 shrink-0">
                <Image
                  src={ipfsToPublicGatewayUrl(agent.imageUrl)}
                  alt={agent.name}
                  width={56}
                  height={56}
                  className="object-cover w-full h-full"
                  unoptimized={agent.imageUrl.startsWith("ipfs://")}
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gypsum border border-forest/15 flex items-center justify-center text-2xl shrink-0">
                {getTemplateIcon(agent.templateType)}
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={imageUploading}
              />
              {imageUploading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-white" aria-label="Upload image" />
              )}
            </label>
          </div>
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
            <p className="text-[10px] text-forest-faint mt-1">{DEPLOYMENT_ATTRIBUTION}</p>
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
            href={`${getBlockExplorer(agentChainId ?? agent.erc8004ChainId ?? 42220)}/address/${agent.agentWalletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary" size="sm">
              <ExternalLink className="w-4 h-4" /> View On-Chain
            </Button>
          </a>
        )}

        {agent.erc8004AgentId && (
          <>
            <a
              href={get8004ScanAgentUrl(agent.erc8004ChainId ?? agentChainId ?? 42220, agent.erc8004AgentId)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="secondary"
                size="sm"
                className="border-accent/30 text-accent hover:bg-accent/10"
              >
                <ScanSearch className="w-4 h-4" /> View on 8004scan
              </Button>
            </a>
            <Button
              variant="secondary"
              size="sm"
              className="border-accent/30 text-accent hover:bg-accent/10"
              onClick={onOpenIdentityModal}
            >
              <Shield className="w-4 h-4" /> Identity
            </Button>
          </>
        )}

        {onOpenTokenTab && (
          <Button
            variant="secondary"
            size="sm"
            className="border-celo/30 text-celo hover:bg-celo/10"
            onClick={onOpenTokenTab}
          >
            <Coins className="w-4 h-4" /> Token & Trade
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
          <Button variant="secondary" size="sm" className="border-[#AB9FF2]/30 text-[#AB9FF2] bg-[#AB9FF2]/5" disabled>
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
            className="border-accent/30 text-accent hover:bg-accent/10"
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

