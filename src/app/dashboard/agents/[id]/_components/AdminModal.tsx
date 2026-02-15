"use client";

import React from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Shield, Coins, Wallet, ExternalLink, AlertCircle, Loader2 } from "lucide-react";
import { get8004ScanAgentUrl } from "@/lib/constants";
import type { AgentData, VerificationStatus } from "../_types";

interface AdminModalProps {
  open: boolean;
  onClose: () => void;
  agent: AgentData;
  verificationStatus: VerificationStatus | null;
  onOpenVerifyModal: () => void;
  /** ERC-8004 registration (required for sponsorship). Pass from useAgentDetail when available. */
  onRegisterOnChain?: () => void;
  isRegistering?: boolean;
  erc8004Error?: string | null;
  erc8004Deployed?: boolean | null;
  hasUserAddress?: boolean;
  /** Sync existing ERC-8004 to SelfClaw (for agents registered before auto-sync). */
  onSyncToSelfClaw?: () => void;
  isSyncingToSelfClaw?: boolean;
}

export function AdminModal({
  open,
  onClose,
  agent,
  verificationStatus,
  onOpenVerifyModal,
  onRegisterOnChain,
  isRegistering = false,
  erc8004Error = null,
  erc8004Deployed = true,
  hasUserAddress = false,
  onSyncToSelfClaw,
  isSyncingToSelfClaw = false,
}: AdminModalProps) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-md max-h-[90vh] overflow-auto">
      <div className="p-6 space-y-5">
        <h2 className="text-lg font-semibold text-forest">Admin</h2>

        <div>
          <h3 className="text-sm font-medium text-forest mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Verification
          </h3>
          {verificationStatus?.verified ? (
            <p className="text-sm text-forest-muted">Agent is verified with SelfClaw.</p>
          ) : (
            <Button variant="glow" size="sm" onClick={() => { onClose(); onOpenVerifyModal(); }}>
              Verify with Self
            </Button>
          )}
        </div>

        {agent.agentWalletAddress && (
          <div>
            <h3 className="text-sm font-medium text-forest mb-2 flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Agent Wallet
            </h3>
            <code className="text-xs text-forest-muted break-all block bg-gypsum px-2 py-2 rounded-lg">
              {agent.agentWalletAddress}
            </code>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-forest mb-2 flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Token & Trade
          </h3>
          <p className="text-sm text-forest-muted mb-2">
            Deploy token, request sponsorship, log revenue/costs.
          </p>
          <Link href={`/dashboard/agents/${agent.id}`}>
            <Button variant="outline" size="sm" onClick={onClose}>
              Open Token tab
            </Button>
          </Link>
        </div>

        <div>
          <h3 className="text-sm font-medium text-forest mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            ERC-8004 Identity
          </h3>
          {agent.erc8004AgentId && agent.erc8004ChainId ? (
            <div className="space-y-2">
              <a
                href={get8004ScanAgentUrl(agent.erc8004ChainId, agent.erc8004AgentId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-forest-light hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Registered — View on 8004scan
              </a>
              {verificationStatus?.verified && onSyncToSelfClaw && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-8"
                  disabled={isSyncingToSelfClaw}
                  onClick={onSyncToSelfClaw}
                >
                  {isSyncingToSelfClaw ? (
                    <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Syncing...</>
                  ) : (
                    "Sync to SelfClaw (for sponsorship)"
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-500/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-amber-400 font-medium">Not Registered On-Chain</span>
              </div>
              <p className="text-xs text-forest-muted mb-3">
                Required for SelfClaw sponsorship. Register your agent on the ERC-8004 IdentityRegistry.
              </p>
              {erc8004Error && (
                <p className="text-xs text-red-400 mb-2">{erc8004Error}</p>
              )}
              {onRegisterOnChain && (
                <Button
                  size="sm"
                  variant="glow"
                  className="w-full text-xs h-8"
                  disabled={isRegistering || !hasUserAddress || erc8004Deployed === false}
                  onClick={onRegisterOnChain}
                >
                  {isRegistering ? (
                    <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Registering...</>
                  ) : !hasUserAddress ? (
                    "Connect Wallet First"
                  ) : erc8004Deployed === false ? (
                    "Contracts Not Deployed"
                  ) : (
                    <><Shield className="w-3 h-3 mr-1" /> Register On-Chain (ERC-8004)</>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
