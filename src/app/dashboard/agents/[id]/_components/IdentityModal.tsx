"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import { Shield, Copy, ExternalLink, AlertCircle } from "lucide-react";
import { BLOCK_EXPLORER, BLOCK_EXPLORERS } from "@/lib/constants";
import type { AgentData, VerificationStatus } from "../_types";

interface IdentityModalProps {
  open: boolean;
  onClose: () => void;
  agent: AgentData;
  verificationStatus: VerificationStatus | null;
}

/** Small helper: label + value with a copy button */
function CopyRow({ label, value, mono = true, className }: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-gypsum border border-forest/15">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-forest-muted/70 uppercase tracking-wider mb-0.5">{label}</div>
        <div className={`text-sm ${mono ? "font-mono text-[11px] break-all leading-relaxed" : "font-medium"} text-forest truncate ${className ?? ""}`}>
          {value}
        </div>
      </div>
      <button
        onClick={() => navigator.clipboard.writeText(value)}
        className="ml-2 p-1.5 rounded-md hover:bg-gypsum-darker/60 text-forest-muted/70 hover:text-forest transition-colors cursor-pointer flex-shrink-0"
        title={`Copy ${label.toLowerCase()}`}
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function IdentityModal({ open, onClose, agent, verificationStatus }: IdentityModalProps) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <div className="p-6 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center shadow-lg shadow-accent/20">
            <Shield className="w-5 h-5 text-forest" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-forest">Agent Identity</h3>
            <p className="text-xs text-forest-muted">ERC-8004 On-Chain Registration</p>
          </div>
        </div>

        {agent.erc8004AgentId ? (
          <div className="space-y-3">
            {/* Agent Name */}
            <CopyRow label="Agent Name" value={agent.name} mono={false} />

            {/* On-Chain Agent ID */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gypsum border border-forest/15">
              <div>
                <div className="text-[10px] text-forest-muted/70 uppercase tracking-wider mb-0.5">On-Chain Agent ID</div>
                <div className="text-lg text-forest-light font-mono font-bold">#{agent.erc8004AgentId}</div>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(agent.erc8004AgentId!)}
                className="ml-2 p-1.5 rounded-md hover:bg-gypsum-darker/60 text-forest-muted/70 hover:text-forest transition-colors cursor-pointer flex-shrink-0"
                title="Copy agent ID"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Agent Public Key (from SelfClaw) */}
            {verificationStatus?.publicKey && (
              <CopyRow label="Agent Public Key" value={verificationStatus.publicKey} className="text-blue-500" />
            )}

            {/* Agent Registry Identifier */}
            {agent.erc8004ChainId && (
              <CopyRow
                label="Agent Registry"
                value={`eip155:${agent.erc8004ChainId}:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`}
                className="text-accent text-[10px]"
              />
            )}

            {/* IdentityRegistry Contract */}
            <CopyRow
              label="IdentityRegistry"
              value="0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
              className="text-blue-500"
            />

            {/* Tx Hash */}
            {agent.erc8004TxHash && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-gypsum border border-forest/15">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-forest-muted/70 uppercase tracking-wider mb-0.5">Tx Hash</div>
                  <div className="text-[11px] text-blue-500 font-mono">{agent.erc8004TxHash}</div>
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <button
                    onClick={() => navigator.clipboard.writeText(agent.erc8004TxHash!)}
                    className="p-1.5 rounded-md hover:bg-gypsum-darker/60 text-forest-muted/70 hover:text-forest transition-colors cursor-pointer"
                    title="Copy tx hash"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={`${BLOCK_EXPLORERS[agent.erc8004ChainId ?? 42220] || BLOCK_EXPLORER}/tx/${agent.erc8004TxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-gypsum-darker/60 text-forest-muted/70 hover:text-blue-400 transition-colors"
                    title="View on explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* Chain */}
            {agent.erc8004ChainId && (
              <div className="p-3 rounded-lg bg-gypsum border border-forest/15">
                <div className="text-[10px] text-forest-muted/70 uppercase tracking-wider mb-0.5">Chain</div>
                <div className="text-sm text-forest">
                  {agent.erc8004ChainId === 42220
                    ? "Celo Mainnet"
                    : agent.erc8004ChainId === 11142220
                      ? "Celo Sepolia"
                      : `Chain ${agent.erc8004ChainId}`}
                  <span className="text-[10px] text-forest-muted/70 ml-1.5">(ID: {agent.erc8004ChainId})</span>
                </div>
              </div>
            )}

            {/* Registration URI */}
            {agent.erc8004URI && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-gypsum border border-forest/15">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-forest-muted/70 uppercase tracking-wider mb-0.5">Registration URI</div>
                  <div className="text-[11px] text-blue-500 font-mono break-all leading-relaxed">{agent.erc8004URI}</div>
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <button
                    onClick={() => navigator.clipboard.writeText(agent.erc8004URI!)}
                    className="p-1.5 rounded-md hover:bg-gypsum-darker/60 text-forest-muted/70 hover:text-forest transition-colors cursor-pointer"
                    title="Copy URI"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={agent.erc8004URI}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-gypsum-darker/60 text-forest-muted/70 hover:text-blue-400 transition-colors"
                    title="Open URI"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="flex items-center justify-center gap-4 pt-2 border-t border-forest/15">
              {agent.erc8004TxHash && (
                <a
                  href={`${BLOCK_EXPLORERS[agent.erc8004ChainId ?? 42220] || BLOCK_EXPLORER}/tx/${agent.erc8004TxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  Explorer <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <a
                href="https://8004.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:text-accent-light flex items-center gap-1"
              >
                ERC-8004 Spec <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://github.com/erc-8004/erc-8004-contracts"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-forest-muted hover:text-forest/80 flex items-center gap-1"
              >
                GitHub <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-amber-900/20 border border-amber-500/30 text-center">
            <AlertCircle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-amber-300 font-medium">Not Registered On-Chain</p>
            <p className="text-xs text-forest-muted mt-1">
              Register this agent via the Agent Identity card to get an on-chain identity.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

