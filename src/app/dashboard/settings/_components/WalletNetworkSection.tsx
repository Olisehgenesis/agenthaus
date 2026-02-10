"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Copy,
  Network,
  ExternalLink,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WalletNetworkSectionProps {
  address: string | undefined;
  chainId: number;
}

export function WalletNetworkSection({ address, chainId }: WalletNetworkSectionProps) {
  return (
    <>
      {/* Wallet Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-forest-light" />
            <CardTitle>Wallet</CardTitle>
          </div>
          <CardDescription>Your connected wallet information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gypsum">
            <div>
              <div className="text-xs text-forest-muted/70">Connected Address</div>
              <div className="text-sm font-mono text-forest mt-1">
                {address || "Not connected"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">Connected</Badge>
              {address && (
                <button
                  onClick={() => navigator.clipboard.writeText(address)}
                  className="p-1.5 rounded hover:bg-gypsum-darker transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-forest-muted" />
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Network Configuration */}
      <Card className="border-cyan-500/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-cyan-400" />
            <CardTitle>Network</CardTitle>
          </div>
          <CardDescription>Active blockchain network for agent operations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gypsum">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-3 h-3 rounded-full",
                  chainId === 42220
                    ? "bg-forest-light"
                    : chainId === 11142220
                    ? "bg-amber-400"
                    : "bg-forest-faint"
                )}
              />
              <div>
                <div className="text-sm text-forest font-medium">
                  {chainId === 42220
                    ? "Celo Mainnet"
                    : chainId === 11142220
                    ? "Celo Sepolia (Testnet)"
                    : `Chain ${chainId}`}
                </div>
                <div className="text-xs text-forest-muted/70">Chain ID: {chainId}</div>
              </div>
            </div>
            <Badge
              variant={chainId === 42220 ? "default" : "secondary"}
              className={cn(
                "text-[10px]",
                chainId === 42220
                  ? "bg-forest/20 text-forest-light border-forest/30"
                  : "bg-amber-500/20 text-amber-400 border-amber-500/30"
              )}
            >
              {chainId === 42220 ? "Production" : "Testnet"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-gypsum">
              <div className="text-[10px] text-forest-muted/70 uppercase tracking-wider mb-1">
                Block Explorer
              </div>
              <a
                href={
                  chainId === 42220
                    ? "https://celoscan.io"
                    : "https://celo-sepolia.blockscout.com"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                {chainId === 42220 ? "celoscan.io" : "blockscout.com"}{" "}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="p-3 rounded-lg bg-gypsum">
              <div className="text-[10px] text-forest-muted/70 uppercase tracking-wider mb-1">
                SelfClaw Verification
              </div>
              <div className="text-xs text-forest/80">
                {chainId === 42220 ? (
                  <span className="text-forest-light flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Available
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Requires Celo Mainnet
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

