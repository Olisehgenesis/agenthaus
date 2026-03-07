"use client";

import React from "react";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Bell, Search } from "lucide-react";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-20 px-8 border-b-4 border-forest bg-white">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-forest" />
          <input
            type="text"
            placeholder="SEARCH AGENTS / OPERATIONS..."
            className="w-full h-12 pl-12 pr-6 bg-white border-2 border-forest rounded-none text-sm font-black uppercase tracking-widest text-forest placeholder:text-forest/30 focus:outline-none focus:bg-celo transition-all shadow-hard"
          />
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-6">
        {/* Notifications */}
        <button className="relative w-12 h-12 border-2 border-forest bg-white flex items-center justify-center hover:bg-celo transition-colors cursor-pointer shadow-hard active:translate-y-px active:shadow-hard-active">
          <Bell className="w-6 h-6" />
          <span className="absolute top-0 right-0 w-4 h-4 bg-celo border-2 border-forest -translate-y-1/2 translate-x-1/2 flex items-center justify-center text-[10px] font-black">
            3
          </span>
        </button>

        {/* Wallet Connect */}
        <div className="border-2 border-forest p-1 bg-celo shadow-hard">
          <ConnectWalletButton size="md" showAddress />
        </div>
      </div>
    </header>
  );
}
