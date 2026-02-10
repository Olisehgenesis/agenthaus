"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, Globe, ExternalLink } from "lucide-react";
import { formatAddress } from "@/lib/utils";
import { ERC8004_CONTRACTS, BLOCK_EXPLORER, BLOCK_EXPLORERS } from "@/lib/constants";

export function NotificationsContractsSection() {
  return (
    <>
      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>Configure alert preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: "Spending limit approaching (>80%)", defaultChecked: true },
              { label: "Failed transactions", defaultChecked: true },
              { label: "Agent status changes", defaultChecked: true },
              { label: "Reputation score changes", defaultChecked: false },
              { label: "Low wallet balance warnings", defaultChecked: true },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between p-3 rounded-lg bg-gypsum"
              >
                <span className="text-sm text-forest/80">{item.label}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={item.defaultChecked}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gypsum-darker peer-focus:ring-2 peer-focus:ring-celo/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-forest-faint after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-forest peer-checked:after:bg-white" />
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ERC-8004 Contract Addresses */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            <CardTitle>ERC-8004 Contracts</CardTitle>
          </div>
          <CardDescription>
            On-chain agent registries —{" "}
            <a
              href="https://github.com/erc-8004/erc-8004-contracts"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              spec
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(ERC8004_CONTRACTS).map(([chainIdStr, addrs]) => {
            const cid = Number(chainIdStr);
            const chainName =
              cid === 42220
                ? "Celo Mainnet"
                : cid === 97
                ? "BSC Testnet"
                : `Chain ${cid}`;
            const explorer = BLOCK_EXPLORERS[cid] || BLOCK_EXPLORER;
            return (
              <div key={cid} className="space-y-2">
                <div className="text-xs text-forest-muted font-medium">{chainName}</div>
                <div className="p-3 rounded-lg bg-gypsum">
                  <div className="text-xs text-forest-muted/70 mb-1">IdentityRegistry</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-forest">
                      {formatAddress(addrs.identity)}
                    </span>
                    <a
                      href={`${explorer}/address/${addrs.identity}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-forest-muted hover:text-forest-light transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gypsum">
                  <div className="text-xs text-forest-muted/70 mb-1">ReputationRegistry</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-forest">
                      {formatAddress(addrs.reputation)}
                    </span>
                    <a
                      href={`${explorer}/address/${addrs.reputation}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-forest-muted hover:text-forest-light transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-forest-faint mt-2">
            Override for testnet: set NEXT_PUBLIC_ERC8004_IDENTITY and
            NEXT_PUBLIC_ERC8004_REPUTATION env vars.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

