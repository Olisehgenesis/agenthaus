"use client";

import React from "react";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InlineRegisterWidgetProps {
  onRegister: () => void;
  isRegistering: boolean;
  erc8004Error?: string | null;
  erc8004Deployed?: boolean | null;
  hasUserAddress?: boolean;
  isOwner: boolean;
}

export function InlineRegisterWidget({
  onRegister,
  isRegistering,
  erc8004Error = null,
  erc8004Deployed = true,
  hasUserAddress = false,
  isOwner,
}: InlineRegisterWidgetProps) {
  if (!isOwner) return null;

  return (
    <div className="mt-3 pt-3 border-t border-forest/10">
      <p className="text-xs text-forest-muted mb-2">Register on-chain (ERC-8004) — required for sponsorship</p>
      {erc8004Error && <p className="text-xs text-red-500 mb-2">{erc8004Error}</p>}
      <Button
        variant="outline"
        size="sm"
        onClick={onRegister}
        disabled={isRegistering || !hasUserAddress || erc8004Deployed === false}
        className="h-8 text-xs rounded-lg border-forest/20"
      >
        {isRegistering ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Registering...</>
        ) : !hasUserAddress ? (
          "Connect wallet first"
        ) : erc8004Deployed === false ? (
          "Contracts not deployed"
        ) : (
          <><Shield className="w-3.5 h-3.5 mr-1" /> Register On-Chain (ERC-8004)</>
        )}
      </Button>
    </div>
  );
}
