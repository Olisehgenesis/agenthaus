"use client";

import React from "react";
import Image from "next/image";
import { useAccount } from "wagmi";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Zap } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gypsum">
        <div className="text-center space-y-6 max-w-lg">
          <div className="max-w-sm mx-auto">
            <Image
              src="/images/11-Connect_Wallet-Option_A-Bot_Inviting_Connect_v2.png"
              alt="AgentHaus bot inviting you to connect your wallet"
              width={512}
              height={288}
              className="w-full h-auto rounded-xl object-contain"
            />
          </div>
          <h2 className="text-2xl font-bold text-forest">Connect Your Wallet</h2>
          <p className="text-forest-muted">
            Connect your Celo wallet to access the AgentHAUS dashboard.
          </p>
          <div className="flex justify-center">
            <ConnectWalletButton size="lg" />
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-forest-faint">
            <Zap className="w-3 h-3" />
            <span>Supports WalletConnect & MiniPay</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-gypsum lg:flex-row">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden pt-20 lg:pt-0">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
