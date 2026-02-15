"use client";

import React from "react";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useERC8004 } from "@/hooks/useERC8004";
import { useAccount } from "wagmi";

interface InlineFeedbackWidgetProps {
  erc8004AgentId: string | null;
  erc8004ChainId: number | null;
  isOwner: boolean;
  agentName: string;
}

export function InlineFeedbackWidget({
  erc8004AgentId,
  erc8004ChainId,
  isOwner,
  agentName,
}: InlineFeedbackWidgetProps) {
  const [rating, setRating] = React.useState(0);
  const [hoverRating, setHoverRating] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { address, isConnected } = useAccount();
  const { giveFeedback, chainId, contractAddresses } = useERC8004();

  const canSubmit =
    erc8004AgentId &&
    erc8004ChainId &&
    isConnected &&
    !isOwner &&
    contractAddresses &&
    chainId === erc8004ChainId &&
    rating > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !erc8004AgentId) return;
    setError(null);
    setSubmitting(true);
    try {
      // value: 1-5 stars, scaled by 10 for 1 decimal (4.5 → 45)
      const value = rating * 10;
      await giveFeedback(
        BigInt(erc8004AgentId),
        value,
        1,
        "starred",
        "chat"
      );
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("self") || msg.includes("owner") ? "You can't rate your own agent." : msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!erc8004AgentId) return null;

  if (submitted) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-forest-light">
        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
        <span>Thanks for your feedback! Recorded on-chain.</span>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-forest/10">
      <p className="text-xs text-forest-muted mb-2">Rate {agentName} on-chain (ERC-8004)</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRating(s)}
              onMouseEnter={() => setHoverRating(s)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 rounded transition-colors hover:scale-110"
              disabled={submitting}
            >
              <Star
                className={`w-5 h-5 transition-colors ${
                  (hoverRating || rating) >= s
                    ? "fill-amber-400 text-amber-400"
                    : "text-forest-muted/60 hover:text-amber-400/70"
                }`}
              />
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="h-8 text-xs rounded-lg border-forest/20"
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            "Submit"
          )}
        </Button>
      </div>
      {!isConnected && (
        <p className="text-xs text-forest-muted mt-1">Connect wallet to rate</p>
      )}
      {isOwner && (
        <p className="text-xs text-forest-muted mt-1">You can&apos;t rate your own agent</p>
      )}
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
