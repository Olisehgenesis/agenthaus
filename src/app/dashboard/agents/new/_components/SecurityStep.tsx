"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Check, Wallet, User, Clock } from "lucide-react";

export type WalletOption = "dedicated" | "owner" | "later";

interface SecurityStepProps {
  spendingLimit: number;
  setSpendingLimit: (v: number) => void;
  walletOption: WalletOption;
  setWalletOption: (v: WalletOption) => void;
}

export function SecurityStep({ spendingLimit, setSpendingLimit, walletOption, setWalletOption }: SecurityStepProps) {
  return (
    <div className="space-y-6">
      {/* Agent Wallet */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Wallet</CardTitle>
          <CardDescription>
            How should this agent receive and send on-chain?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {[
              {
                id: "dedicated" as const,
                icon: <Wallet className="w-4 h-4" />,
                title: "Create dedicated wallet",
                desc: "Derive a new HD wallet for this agent. Can send and receive. Recommended for production.",
              },
              {
                id: "owner" as const,
                icon: <User className="w-4 h-4" />,
                title: "Use my connected wallet",
                desc: "Agent uses your wallet address for receiving. Initialize a dedicated wallet later to enable sending.",
              },
              {
                id: "later" as const,
                icon: <Clock className="w-4 h-4" />,
                title: "Initialize later",
                desc: "Create agent without a wallet. Add one from the agent dashboard when needed.",
              },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setWalletOption(opt.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                  walletOption === opt.id
                    ? "border-forest bg-forest/5"
                    : "border-forest/15 hover:border-forest/30 bg-gypsum/30"
                }`}
              >
                <div className="mt-0.5 text-forest-muted">{opt.icon}</div>
                <div>
                  <div className="text-sm font-medium text-forest">{opt.title}</div>
                  <div className="text-xs text-forest-muted mt-0.5">{opt.desc}</div>
                </div>
                <div className="ml-auto w-4 h-4 rounded-full border-2 border-forest/40 flex items-center justify-center shrink-0 mt-0.5">
                  {walletOption === opt.id && <div className="w-2 h-2 rounded-full bg-forest" />}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Spending Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Spending Controls</CardTitle>
          <CardDescription>Set limits to protect your agent&apos;s wallet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium text-forest/80 block mb-3">
              Daily Spending Limit (cUSD)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="10"
                max="10000"
                step="10"
                value={spendingLimit}
                onChange={(e) => setSpendingLimit(Number(e.target.value))}
                className="flex-1 h-2 bg-gypsum-darker rounded-lg appearance-none cursor-pointer accent-forest"
              />
              <div className="w-24 text-right">
                <span className="text-lg font-bold text-forest">${spendingLimit}</span>
              </div>
            </div>
            <div className="flex justify-between text-xs text-forest-faint mt-1">
              <span>$10</span>
              <span>$10,000</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-amber-400">Security Notice</h4>
                <p className="text-xs text-forest-muted mt-1">
                  Spending limits are enforced at the smart contract level. Your agent cannot exceed
                  this limit without owner approval. You can adjust this at any time from the agent
                  dashboard.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ERC-8004 Registration */}
      <Card>
        <CardHeader>
          <CardTitle>ERC-8004 Registration</CardTitle>
          <CardDescription>
            Your agent will be registered on-chain for verifiable identity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              "Agent registered on Celo IdentityRegistry",
              "Unique on-chain identity (agentId) assigned",
              "Agent wallet address linked to identity",
              "Reputation tracking via ReputationRegistry",
              "Registration metadata on IPFS (when Pinata configured)",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-forest/10">
                  <Check className="w-3 h-3 text-forest" />
                </div>
                <span className="text-sm text-forest/80">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

