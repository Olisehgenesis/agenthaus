"use client";

import React from "react";
import Image from "next/image";
import { useAccount, useBalance, useChainId } from "wagmi";
import { Modal } from "@/components/ui/modal";
import { formatAddress } from "@/lib/utils";
import { getChainName, FEE_CURRENCIES } from "@/lib/constants";
import { Coins, Copy } from "lucide-react";

function getTokensForChain(chainId: number): { symbol: string; address?: `0x${string}` }[] {
  const fees = FEE_CURRENCIES[chainId];
  if (!fees) {
    return [
      { symbol: "CELO" },
      { symbol: "cUSD", address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as `0x${string}` },
      { symbol: "cEUR", address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73" as `0x${string}` },
    ];
  }
  const tokens: { symbol: string; address?: `0x${string}` }[] = [{ symbol: "CELO" }];
  if (fees.cUSD) tokens.push({ symbol: "cUSD", address: fees.cUSD.token as `0x${string}` });
  if (fees.cEUR) tokens.push({ symbol: "cEUR", address: fees.cEUR.token as `0x${string}` });
  if (fees.cREAL) tokens.push({ symbol: "cREAL", address: fees.cREAL.token as `0x${string}` });
  return tokens;
}

function TokenBalanceRow({
  symbol,
  address,
  userAddress,
  chainId,
}: {
  symbol: string;
  address?: `0x${string}`;
  userAddress: `0x${string}`;
  chainId: number;
}) {
  const { data: balance } = useBalance({
    address: userAddress,
    token: address,
    chainId,
  });

  const formatted = balance
    ? Number(balance.formatted).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      })
    : "—";

  return (
    <div className="flex items-center justify-between py-2 border-b border-forest/10 last:border-0">
      <div className="flex items-center gap-2">
        <Coins className="w-4 h-4 text-forest-muted shrink-0" />
        <span className="font-medium text-forest">{symbol}</span>
      </div>
      <span className="text-forest-muted tabular-nums truncate max-w-[140px] text-right">{formatted}</span>
    </div>
  );
}

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
}

export function WalletModal({ open, onClose }: WalletModalProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  if (!isConnected || !address) {
    return null;
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6 pt-12">
        <h2 className="text-xl font-bold text-forest mb-4">Wallet</h2>

        {/* Profile */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-gypsum border border-forest/10 mb-6">
          <div className="relative h-14 w-14 rounded-full overflow-hidden bg-forest/20 flex items-center justify-center">
            <Image
              src={`https://api.dicebear.com/7.x/identicon/svg?seed=${address}`}
              alt="Profile"
              width={56}
              height={56}
              className="object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium text-forest truncate">
                {formatAddress(address)}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(address)}
                className="p-1 rounded text-forest-muted hover:text-forest hover:bg-forest/10 transition-colors cursor-pointer"
                title="Copy"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-forest-muted mt-0.5">{getChainName(chainId)}</p>
          </div>
        </div>

        {/* Token balances */}
        <div className="rounded-xl border border-forest/10 bg-white p-4">
          <h3 className="text-sm font-semibold text-forest mb-3">Balances</h3>
          {getTokensForChain(chainId).map((t) => (
            <TokenBalanceRow
              key={t.symbol}
              symbol={t.symbol}
              address={t.address}
              userAddress={address}
              chainId={chainId}
            />
          ))}
        </div>

        <p className="text-xs text-forest-muted mt-0.5">
          Prices are approximate. View on explorer for exact values.
        </p>
      </div>
    </Modal>
  );
}
