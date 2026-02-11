"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wallet, RefreshCw, Copy, ExternalLink, Send,
  Loader2, AlertCircle, CheckCircle, Info,
} from "lucide-react";
import { formatAddress } from "@/lib/utils";
import { getBlockExplorer } from "@/lib/constants";
import type { AgentData, WalletBalanceData, SendResult } from "../_types";

interface WalletCardProps {
  agent: AgentData;
  /** Chain ID for explorer links (agent's chain or connected) */
  agentChainId?: number;
  walletBalance: WalletBalanceData | null;
  balanceLoading: boolean;
  fetchBalance: () => void;
  walletIniting: boolean;
  handleInitWallet: () => void;
  connectedChainId: number | undefined;
  // Send form
  showSendForm: boolean;
  setShowSendForm: (v: boolean) => void;
  sendTo: string;
  setSendTo: (v: string) => void;
  sendAmount: string;
  setSendAmount: (v: string) => void;
  sendCurrency: string;
  setSendCurrency: (v: string) => void;
  sendLoading: boolean;
  sendResult: SendResult | null;
  setSendResult: (v: SendResult | null) => void;
  handleSendTx: () => void;
}

export function WalletCard({
  agent,
  agentChainId,
  walletBalance,
  balanceLoading,
  fetchBalance,
  walletIniting,
  handleInitWallet,
  connectedChainId,
  showSendForm,
  setShowSendForm,
  sendTo,
  setSendTo,
  sendAmount,
  setSendAmount,
  sendCurrency,
  setSendCurrency,
  sendLoading,
  sendResult,
  setSendResult,
  handleSendTx,
}: WalletCardProps) {
  const hasDedicatedWallet = agent.agentWalletAddress && agent.walletDerivationIndex != null;
  const chainId = agentChainId ?? agent.erc8004ChainId ?? connectedChainId ?? 42220;
  const explorer = getBlockExplorer(chainId);

  if (!agent.agentWalletAddress) {
    return (
      <Card className="border-amber-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-400" />
            <CardTitle className="text-base">No Wallet</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-forest-muted">
            This agent doesn&apos;t have a blockchain wallet yet. Initialize one to enable
            on-chain transactions, token transfers, and balance tracking.
          </p>
          <Button variant="glow" size="sm" className="w-full" onClick={handleInitWallet} disabled={walletIniting}>
            {walletIniting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Initializing...</>
            ) : (
              <><Wallet className="w-3.5 h-3.5 mr-1.5" /> Initialize Wallet</>
            )}
          </Button>
          <p className="text-[10px] text-forest-faint">
            Requires AGENT_MNEMONIC in .env — wallet derived via HD path.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Using owner wallet (receive only) — show upgrade option
  if (!hasDedicatedWallet) {
    return (
      <Card className="border-amber-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-400" />
            <CardTitle className="text-base">Receive-Only Wallet</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-forest-muted">
            This agent uses your connected wallet for receiving. Create a dedicated wallet to enable sending transactions.
          </p>
          <div className="p-3 rounded-lg bg-gypsum">
            <div className="text-xs text-forest-muted/70 mb-1">Address</div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-forest font-mono">{formatAddress(agent.agentWalletAddress)}</div>
              <button
                onClick={() => navigator.clipboard.writeText(agent.agentWalletAddress!)}
                className="text-forest-muted/70 hover:text-forest transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3" />
              </button>
              <a
                href={`${explorer}/address/${agent.agentWalletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-forest-muted/70 hover:text-forest-light transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          {walletBalance ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-gypsum/80">
                <span className="text-sm text-forest/80">CELO</span>
                <span className="text-sm font-mono text-forest">
                  {parseFloat(walletBalance.nativeBalance).toFixed(4)}
                </span>
              </div>
            </div>
          ) : balanceLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 text-forest-muted animate-spin" />
            </div>
          ) : null}
          <Button variant="glow" size="sm" className="w-full" onClick={handleInitWallet} disabled={walletIniting}>
            {walletIniting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Creating...</>
            ) : (
              <><Wallet className="w-3.5 h-3.5 mr-1.5" /> Create Dedicated Wallet</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-forest/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-forest-light" />
            <CardTitle className="text-base">Agent Wallet</CardTitle>
          </div>
          <button
            onClick={fetchBalance}
            disabled={balanceLoading}
            className="p-1.5 rounded hover:bg-gypsum-dark transition-colors cursor-pointer"
            title="Refresh balance"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-forest-muted ${balanceLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Address */}
        <div className="p-3 rounded-lg bg-gypsum">
          <div className="text-xs text-forest-muted/70 mb-1">Address</div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-forest font-mono">{formatAddress(agent.agentWalletAddress)}</div>
            <button
              onClick={() => navigator.clipboard.writeText(agent.agentWalletAddress!)}
              className="text-forest-muted/70 hover:text-forest transition-colors cursor-pointer"
            >
              <Copy className="w-3 h-3" />
            </button>
            <a
              href={`${explorer}/address/${agent.agentWalletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-forest-muted/70 hover:text-forest-light transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Balances */}
        {walletBalance ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gypsum/80">
              <span className="text-sm text-forest/80">CELO</span>
              <span className="text-sm font-mono text-forest">
                {parseFloat(walletBalance.nativeBalance).toFixed(4)}
              </span>
            </div>
            {walletBalance.tokens
              .filter((t) => t.symbol !== "CELO")
              .map((token) => (
                <div key={token.symbol} className="flex items-center justify-between p-2.5 rounded-lg bg-gypsum/80">
                  <span className="text-sm text-forest/80">{token.symbol}</span>
                  <span className="text-sm font-mono text-forest">
                    {parseFloat(token.balance).toFixed(4)}
                  </span>
                </div>
              ))}
          </div>
        ) : balanceLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 text-forest-muted animate-spin" />
          </div>
        ) : (
          <div className="text-xs text-forest-muted/70 text-center py-2">Could not load balances</div>
        )}

        {/* Send / Withdraw */}
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => { setShowSendForm(!showSendForm); setSendResult(null); }}
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {showSendForm ? "Cancel" : "Send / Withdraw"}
          </Button>

          {showSendForm && (
            <div className="p-3 rounded-lg bg-gypsum space-y-2">
              <input
                type="text"
                placeholder="Recipient 0x address"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                className="w-full h-8 px-3 bg-white/60 border border-forest/15 rounded text-xs text-forest placeholder:text-forest-faint focus:outline-none focus:ring-1 focus:ring-celo/50"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Amount"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  className="flex-1 h-8 px-3 bg-white/60 border border-forest/15 rounded text-xs text-forest placeholder:text-forest-faint focus:outline-none focus:ring-1 focus:ring-celo/50"
                />
                <select
                  value={sendCurrency}
                  onChange={(e) => setSendCurrency(e.target.value)}
                  className="h-8 px-2 bg-white/60 border border-forest/15 rounded text-xs text-forest focus:outline-none focus:ring-1 focus:ring-celo/50"
                >
                  <option value="CELO">CELO</option>
                  <option value="cUSD">cUSD</option>
                  <option value="cEUR">cEUR</option>
                  <option value="cREAL">cREAL</option>
                </select>
              </div>
              <Button size="sm" variant="glow" className="w-full" disabled={!sendTo || !sendAmount || sendLoading} onClick={handleSendTx}>
                {sendLoading ? (
                  <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Sending...</>
                ) : (
                  <><Send className="w-3 h-3 mr-1" /> Send {sendCurrency}</>
                )}
              </Button>

              {sendResult && (
                <div className={`p-2 rounded text-xs ${sendResult.success ? "bg-forest/10 text-forest-light" : "bg-red-500/10 text-red-400"}`}>
                  {sendResult.success ? (
                    <>
                      ✅ Sent!{" "}
                      <a href={`${explorer}/tx/${sendResult.txHash}`} target="_blank" rel="noopener noreferrer" className="underline">
                        View TX
                      </a>
                    </>
                  ) : (
                    <>❌ {sendResult.error}</>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wallet Network Info */}
        {connectedChainId === 11142220 ? (
          <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-forest-muted">Celo Sepolia testnet wallet. Fund with test tokens:</p>
                <a
                  href="https://faucet.celo.org/celo-sepolia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-forest-light hover:text-forest font-medium flex items-center gap-1 mt-1"
                >
                  Celo Sepolia Faucet <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        ) : connectedChainId === 42220 ? (
          <div className="p-3 rounded-lg bg-forest/5 border border-forest/20">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-forest-light mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-forest-muted">Celo Mainnet wallet. Fund with real CELO or stablecoins.</p>
                <a
                  href={`${explorer}/address/${agent.agentWalletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-forest-light hover:text-forest font-medium flex items-center gap-1 mt-1"
                >
                  View in Explorer <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-gypsum/80 border border-forest/15/30">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-forest-muted mt-0.5 flex-shrink-0" />
              <p className="text-xs text-forest-muted">Connected to chain {connectedChainId || "unknown"}.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

