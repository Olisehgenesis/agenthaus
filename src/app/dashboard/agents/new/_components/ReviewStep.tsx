"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Rocket, AlertCircle, Loader2 } from "lucide-react";
import type { AgentTemplate, LLMProvider } from "@/lib/types";
import { DEPLOYMENT_ATTRIBUTION } from "@/lib/constants";
import type { WalletOption } from "./SecurityStep";

type DeployStatus = "idle" | "creating" | "uploading" | "signing" | "confirming" | "activating" | "done" | "error";

const WALLET_OPTION_LABELS: Record<WalletOption, string> = {
  dedicated: "Create dedicated wallet",
  owner: "Use my connected wallet",
  later: "Initialize later",
};

interface ReviewStepProps {
  name: string;
  selectedTemplate: AgentTemplate | null;
  walletOption: WalletOption;
  llmProvider: LLMProvider;
  llmModel: string;
  spendingLimit: number;
  systemPrompt: string;
  address: string | undefined;
  hasImage?: boolean;
  webUrl?: string;
  contactEmail?: string;
  deployStatus: DeployStatus;
  isDeploying: boolean;
  deployError: string | null;
  erc8004Error: string | null;
  erc8004Deployed: boolean | null;
  erc8004Contracts: { identityRegistry: string; reputationRegistry: string } | null;
  currentChainId: number | undefined;
  onDeploy: () => void;
}

const DEPLOY_STEPS = [
  { key: "creating", label: "Creating agent..." },
  { key: "uploading", label: "Uploading image..." },
  { key: "signing", label: "Sign ERC-8004 registration transaction..." },
  { key: "confirming", label: "Waiting for on-chain confirmation..." },
  { key: "activating", label: "Activating agent & generating pairing code..." },
  { key: "done", label: "Agent deployed!" },
];

const STEP_ORDER = ["creating", "uploading", "signing", "confirming", "activating", "done"];

export function ReviewStep({
  name,
  selectedTemplate,
  walletOption,
  llmProvider,
  llmModel,
  spendingLimit,
  systemPrompt,
  address,
  hasImage,
  webUrl,
  contactEmail,
  deployStatus,
  isDeploying,
  deployError,
  erc8004Error,
  erc8004Deployed,
  erc8004Contracts,
  currentChainId,
  onDeploy,
}: ReviewStepProps) {
  const currentIdx = STEP_ORDER.indexOf(deployStatus);

  return (
    <div className="space-y-12">
      {/* Configuration Manifest */}
      <div className="space-y-8">
        <div className="flex items-center gap-4 border-b-4 border-forest pb-4">
          <div className="w-12 h-12 bg-forest text-white flex items-center justify-center font-black text-2xl">
            06
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tighter">Validation check</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: "NODE ID", value: name.trim() || "AUTO_GEN" },
            { label: "PROTOCOL", value: selectedTemplate || "CUSTOM" },
            { label: "ASSETS", value: hasImage ? "IMAGE_LOADED" : "NULL" },
            { label: "ENDPOINT", value: webUrl || "NULL" },
            { label: "MAINTAINER", value: contactEmail || "NULL" },
            { label: "VAULT", value: WALLET_OPTION_LABELS[walletOption].toUpperCase() },
            { label: "INTERFACE", value: llmProvider.toUpperCase() },
            { label: "CORE", value: llmModel.toUpperCase() },
            { label: "LIMIT", value: `$${spendingLimit}.00` },
            { label: "AUTHORITY", value: address?.slice(0, 8) + "..." || "NULL" },
            { label: "APP", value: DEPLOYMENT_ATTRIBUTION.toUpperCase() },
          ].map((item) => (
            <div key={item.label} className="p-4 border-2 border-forest bg-gypsum flex flex-col justify-between">
              <div className="text-[10px] font-black uppercase text-forest/40 tracking-widest leading-none mb-1">{item.label}</div>
              <div className="text-sm font-black uppercase truncate">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="border-4 border-forest bg-white p-6 shadow-hard space-y-2">
          <div className="text-[10px] font-black uppercase text-forest/40 tracking-widest leading-none">BEHAVIORAL_LOG</div>
          <div className="text-xs font-bold font-mono text-forest/80 whitespace-pre-wrap max-h-32 overflow-auto bg-gypsum/30 p-4 border-2 border-forest/5">
            {systemPrompt.slice(0, 500)}
            {systemPrompt.length > 500 && "..."}
          </div>
        </div>
      </div>

      {/* Deployment Status & Execution */}
      <div className="space-y-8 pb-12">
        <div className="flex items-center gap-4 border-b-4 border-forest pb-4">
          <div className="w-12 h-12 bg-forest text-white flex items-center justify-center font-black text-2xl">
            07
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tighter">Execution phase</h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Status Indicators */}
          <div className="space-y-4">
            {deployStatus !== "idle" && deployStatus !== "error" ? (
              <div className="border-4 border-forest bg-white p-8 shadow-hard space-y-6">
                <h3 className="text-xl font-black uppercase tracking-tight">System Initialization...</h3>
                <div className="space-y-4">
                  {DEPLOY_STEPS.map((step) => {
                    const stepIdx = STEP_ORDER.indexOf(step.key);
                    const isDone = stepIdx < currentIdx;
                    const isCurrent = step.key === deployStatus;

                    return (
                      <div key={step.key} className={`flex items-center gap-4 p-3 border-2 transition-colors ${isCurrent ? 'bg-celo border-forest' : isDone ? 'bg-forest/5 border-forest/20' : 'border-forest/10 opacity-40'}`}>
                        <div className={`w-8 h-8 border-2 border-forest flex items-center justify-center ${isDone ? 'bg-forest text-white' : 'bg-white'}`}>
                          {isDone ? (
                            <Check className="w-5 h-5 stroke-[4px]" />
                          ) : isCurrent ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : null}
                        </div>
                        <span className={`text-xs font-black uppercase tracking-wide ${isCurrent ? 'text-forest' : 'text-forest/60'}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="border-4 border-forest bg-celo p-8 shadow-hard space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white border-2 border-forest flex items-center justify-center">
                    <Rocket className="w-7 h-7 stroke-[2.5px]" />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Protocol Armed</h3>
                </div>
                <p className="text-sm font-bold uppercase leading-relaxed text-forest/70">
                  Initializing deployment will register your identity on the Celo blockchain.
                  This creates an immutable node ID and persistent vault.
                </p>
                <div className="pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-forest">
                    <Check className="w-3 h-3 stroke-[3px]" /> Verify Gas Availability
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-forest">
                    <Check className="w-3 h-3 stroke-[3px]" /> Confirm Owner Signature
                  </div>
                </div>
              </div>
            )}

            {/* ERC-8004 specific status */}
            {deployStatus === "idle" && erc8004Contracts && (
              <div className="p-4 border-2 border-forest bg-forest/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-forest-light" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Network Verified: CHAIN {currentChainId}</span>
                </div>
                <span className="text-[10px] font-mono text-forest/40">{erc8004Contracts.identityRegistry.slice(0, 10)}...</span>
              </div>
            )}
          </div>

          {/* Execution Button & Errors */}
          <div className="space-y-6">
            {/* Error message */}
            {(deployError || erc8004Error) && (
              <div className="p-6 border-4 border-forest bg-red-50 shadow-[6px_6px_0px_0px_rgba(239,68,68,1)]">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-7 h-7 text-red-600 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-black uppercase text-red-900">Deployment Breach</h4>
                    <p className="text-xs font-bold text-red-800/70 uppercase leading-normal mt-2">
                      {deployError || erc8004Error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {erc8004Deployed === false && (
              <div className="p-6 border-4 border-forest bg-amber-50 shadow-[6px_6px_0px_0px_rgba(245,158,11,1)]">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-7 h-7 text-amber-600 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-black uppercase text-amber-900">Network Compatibility Error</h4>
                    <p className="text-xs font-bold text-amber-800/70 uppercase leading-normal mt-2">
                      ERC-8004 IdentityRegistry unavailable on Chain {currentChainId}.
                      Switch to CELO MAINNET (42220) or SEPOLIA.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              disabled={isDeploying || !address || erc8004Deployed === false}
              onClick={onDeploy}
              className={`w-full h-24 border-4 border-forest font-black text-2xl uppercase tracking-tighter flex items-center justify-center gap-4 transition-all hover:bg-celo shadow-hard active:translate-y-1 active:shadow-hard-active disabled:opacity-40 disabled:cursor-not-allowed ${isDeploying ? 'bg-gypsum' : 'bg-white'}`}
            >
              {isDeploying ? (
                <Loader2 className="w-10 h-10 animate-spin" />
              ) : (
                <Rocket className="w-10 h-10 stroke-[2.5px]" />
              )}
              {isDeploying
                ? deployStatus === "signing"
                  ? "Awaiting Sign..."
                  : "Processing..."
                : "Initialize Protocol"}
            </button>

            {!address && (
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-red-500 animate-pulse">
                Critical: Owner Wallet Not Detected
              </p>
            )}

            {deployStatus === "idle" && (
              <div className="text-[10px] font-bold text-forest/40 uppercase leading-relaxed text-center px-8">
                By initializing, you authorize the creation of a persistent identity
                on the decentralized registry. This action is irreversible once confirmed.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

