"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Loader2, ArrowRight } from "lucide-react";
import { getAgentHausAgentId } from "@/lib/constants";

interface DeploySuccessFeedbackProps {
  chainId: number;
  giveFeedback: (
    agentId: bigint,
    value: number,
    valueDecimals: number,
    tag1?: string,
    tag2?: string
  ) => Promise<{ txHash: string }>;
  onDone: () => void;
}

export function DeploySuccessFeedback({
  chainId,
  giveFeedback,
  onDone,
}: DeploySuccessFeedbackProps) {
  const [rating, setRating] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const agentHausId = getAgentHausAgentId(chainId);

  const handleSubmit = async () => {
    if (!agentHausId || rating === 0) return;
    setSubmitting(true);
    try {
      // value: 1-5 stars, scaled by 10 for 1 decimal (4.5 → 45)
      const value = rating * 10;
      await giveFeedback(
        BigInt(agentHausId),
        value,
        1,
        "starred",
        "deployment"
      );
      setSubmitted(true);
    } catch (err) {
      console.error("Feedback failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!agentHausId) {
    return (
      <Card className="border-forest/20">
        <CardContent className="p-6">
          <p className="text-sm text-forest-muted mb-4">
            Agent Haus is not yet registered as an ERC-8004 agent on this chain.
            Set AGENT_HAUS_AGENT_ID_* in .env to enable reputation feedback.
          </p>
          <Button variant="glow" onClick={onDone}>
            Continue to Agent <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-forest/20 bg-forest/5">
      <CardContent className="p-6">
        <h4 className="text-forest font-semibold mb-1">
          Rate your deployment experience
        </h4>
        <p className="text-sm text-forest-muted mb-4">
          Help Agent Haus grow its reputation on ERC-8004. Your feedback is
          recorded on-chain.
        </p>

        {!submitted ? (
          <>
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  className={`p-2 rounded-lg transition-colors ${
                    rating >= s
                      ? "bg-amber-400/20 text-amber-400"
                      : "bg-gypsum text-forest-muted hover:bg-forest/10"
                  }`}
                >
                  <Star
                    className={`w-6 h-6 ${rating >= s ? "fill-amber-400" : ""}`}
                  />
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="glow"
                size="sm"
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Submit feedback
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={onDone}>
                Skip
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm text-forest-light">Thanks for your feedback!</p>
            <Button variant="glow" size="sm" onClick={onDone}>
              Continue to Agent <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
