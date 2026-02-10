"use client";

import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Bell, Search } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-forest/10 bg-white/80 backdrop-blur-sm">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-muted" />
          <input
            type="text"
            placeholder="Search agents, transactions..."
            className="w-full h-9 pl-10 pr-4 bg-gypsum border border-forest/10 rounded-lg text-sm text-forest placeholder:text-forest-muted/60 focus:outline-none focus:ring-2 focus:ring-celo/50 focus:border-forest-light transition-all"
          />
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-forest-muted hover:text-forest hover:bg-gypsum-dark transition-colors cursor-pointer">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-celo rounded-full border border-white" />
        </button>

        {/* Wallet Connect */}
        <ConnectButton
          chainStatus="icon"
          showBalance={true}
          accountStatus="avatar"
        />
      </div>
    </header>
  );
}
