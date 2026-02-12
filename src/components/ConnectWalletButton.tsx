"use client";

import React from "react";
import { modal } from "@reown/appkit/react";
import { useAccount } from "wagmi";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const CONNECT_COLOR = "#AB9FF2";

interface ConnectWalletButtonProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  /** When connected, show truncated address instead of "Wallet" */
  showAddress?: boolean;
}

export function ConnectWalletButton({
  className,
  size = "md",
  showLabel = true,
  showAddress = false,
}: ConnectWalletButtonProps) {
  const { address, isConnected } = useAccount();

  const openModal = () => {
    modal?.open(isConnected ? undefined : { view: "Connect" });
  };

  const sizeClasses = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  };

  const label = showAddress && isConnected && address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : isConnected
      ? "Wallet"
      : "Connect Wallet";

  return (
    <button
      type="button"
      onClick={openModal}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium text-white transition-colors hover:opacity-90 active:scale-[0.98]",
        sizeClasses[size],
        className
      )}
      style={{
        backgroundColor: CONNECT_COLOR,
      }}
    >
      <Wallet className={size === "sm" ? "w-4 h-4" : "w-5 h-5"} />
      {showLabel && label}
    </button>
  );
}
