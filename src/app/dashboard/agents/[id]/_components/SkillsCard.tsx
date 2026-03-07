"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const TEMPLATE_SKILL_LABELS: Record<string, { name: string; icon: string }[]> = {
  payment: [
    { name: "Send CELO", icon: "💸" },
    { name: "Send Tokens", icon: "💰" },
    { name: "Check Balance", icon: "🔍" },
    { name: "Query Rate", icon: "📊" },
    { name: "Gas Price", icon: "⛽" },
  ],
  trading: [
    { name: "Send CELO", icon: "💸" },
    { name: "Send Tokens", icon: "💰" },
    { name: "Oracle Rates", icon: "📊" },
    { name: "Mento Quote", icon: "💱" },
    { name: "Mento Swap", icon: "🔄" },
    { name: "Forex Analysis", icon: "📈" },
    { name: "Portfolio", icon: "💼" },
  ],
  forex: [
    { name: "Oracle Rates", icon: "📊" },
    { name: "Mento Quote", icon: "💱" },
    { name: "Mento Swap", icon: "🔄" },
    { name: "Forex Analysis", icon: "📈" },
    { name: "Portfolio", icon: "💼" },
    { name: "Send CELO", icon: "💸" },
    { name: "Balance Check", icon: "🔍" },
    { name: "Gas Price", icon: "⛽" },
  ],
  social: [
    { name: "Send CELO", icon: "💸" },
    { name: "Send Tokens", icon: "💰" },
    { name: "Check Balance", icon: "🔍" },
  ],
  custom: [
    { name: "Send CELO", icon: "💸" },
    { name: "Send Tokens", icon: "💰" },
    { name: "Oracle Rates", icon: "📊" },
    { name: "Mento Quote", icon: "💱" },
    { name: "Gas Price", icon: "⛽" },
  ],
};

interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface SkillsCardProps {
  agentId: string;
  templateType: string;
}

export function SkillsCard({ agentId, templateType }: SkillsCardProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSkills = async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/skills`);
      const data = await res.json();
      if (res.ok) {
        setSkills(data.skills);
      }
    } catch (err) {
      console.error("Failed to fetch skills", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, [agentId]);

  const handleToggle = async (skillId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_skill", skillId }),
      });
      if (res.ok) {
        setSkills(prev => prev.map(s => s.id === skillId ? { ...s, enabled: !s.enabled } : s));
        toast.success("Skill updated");
      } else {
        toast.error("Failed to update skill");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-forest-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">⚡ Skills</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {skills.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 p-2 rounded-lg bg-gypsum/50 border border-forest/5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-forest truncate">{s.name}</p>
                <p className="text-[10px] text-forest-muted line-clamp-1">{s.description}</p>
              </div>
              <Switch
                checked={s.enabled}
                onCheckedChange={() => handleToggle(s.id)}
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-forest-muted/70 mt-2">
          Skills are auto-injected into the agent&apos;s system prompt. Disabled skills are hidden from the agent.
        </p>
      </CardContent>
    </Card>
  );
}

