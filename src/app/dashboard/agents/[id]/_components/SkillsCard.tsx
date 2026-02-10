"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

interface SkillsCardProps {
  templateType: string;
}

export function SkillsCard({ templateType }: SkillsCardProps) {
  const skills = TEMPLATE_SKILL_LABELS[templateType] || TEMPLATE_SKILL_LABELS.custom;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">⚡ Skills</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <Badge key={s.name} variant="secondary" className="text-[10px] gap-1">
              {s.icon} {s.name}
            </Badge>
          ))}
        </div>
        <p className="text-[10px] text-forest-muted/70 mt-2">
          Skills are auto-injected into the agent&apos;s system prompt. The agent uses command tags to invoke skills in real-time.
        </p>
      </CardContent>
    </Card>
  );
}

