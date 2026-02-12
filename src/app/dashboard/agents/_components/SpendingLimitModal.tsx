"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { DollarSign, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface SpendingLimitModalProps {
  open: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  spendingUsed: number;
  spendingLimit: number;
  onUpdated: () => void;
}

export function SpendingLimitModal({
  open,
  onClose,
  agentId,
  agentName,
  spendingUsed,
  spendingLimit,
  onUpdated,
}: SpendingLimitModalProps) {
  const [limit, setLimit] = React.useState(spendingLimit);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setLimit(spendingLimit);
      setError(null);
    }
  }, [open, spendingLimit]);

  const handleSave = async () => {
    const num = Number(limit);
    if (isNaN(num) || num < 0) {
      setError("Enter a valid limit");
      return;
    }
    if (num < spendingUsed) {
      setError(`Limit cannot be less than current spending (${formatCurrency(spendingUsed)})`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spendingLimit: num }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update");
      }
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold text-forest">Spending Limit</h2>
        </div>
        <p className="text-sm text-forest-muted mb-4">
          {agentName}
        </p>

        <div className="mb-4 p-3 rounded-lg bg-gypsum border border-forest/10">
          <div className="text-xs text-forest-muted mb-1">Current</div>
          <div className="text-lg font-semibold text-forest">
            {formatCurrency(spendingUsed)} / {formatCurrency(spendingLimit)}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-forest/80 block mb-2">
            New spending limit (USD)
          </label>
          <input
            type="number"
            min={Math.max(0, spendingUsed)}
            max={100000}
            step={10}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 0)}
            className="w-full h-10 px-3 rounded-lg border border-forest/15 bg-white text-forest placeholder:text-forest-muted focus:outline-none focus:ring-2 focus:ring-celo/50"
            placeholder="e.g. 200"
          />
        </div>

        <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-forest/5 border border-forest/10">
          <Info className="w-4 h-4 text-forest-muted mt-0.5 flex-shrink-0" />
          <p className="text-xs text-forest-muted">
            Spending is tracked in USD. Only CELO, cUSD, cEUR, and cREAL are counted. Agent tokens
            and custom tokens without prices are not included.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500 mb-4">{error}</p>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
