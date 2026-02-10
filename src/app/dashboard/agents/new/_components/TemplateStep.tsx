"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap } from "lucide-react";
import { AGENT_TEMPLATES } from "@/lib/constants";
import type { AgentTemplate } from "@/lib/types";

/** Skills preview per template (static data) */
const TEMPLATE_SKILLS: Record<string, { name: string; icon: string; category: string }[]> = {
  payment: [
    { name: "Send CELO", icon: "💸", category: "transfer" },
    { name: "Send Tokens", icon: "💰", category: "transfer" },
    { name: "Check Balance", icon: "🔍", category: "data" },
    { name: "Query Rate", icon: "📊", category: "oracle" },
    { name: "Gas Price", icon: "⛽", category: "data" },
  ],
  trading: [
    { name: "Oracle Rates", icon: "📊", category: "oracle" },
    { name: "Mento Quote", icon: "💱", category: "mento" },
    { name: "Mento Swap", icon: "🔄", category: "mento" },
    { name: "Forex Analysis", icon: "📈", category: "forex" },
    { name: "Portfolio", icon: "💼", category: "forex" },
    { name: "Send CELO", icon: "💸", category: "transfer" },
    { name: "Balance Check", icon: "🔍", category: "data" },
    { name: "Gas Price", icon: "⛽", category: "data" },
  ],
  forex: [
    { name: "SortedOracles", icon: "📊", category: "oracle" },
    { name: "Mento Quote", icon: "💱", category: "mento" },
    { name: "Mento Swap", icon: "🔄", category: "mento" },
    { name: "Forex Analysis", icon: "📈", category: "forex" },
    { name: "Portfolio Tracker", icon: "💼", category: "forex" },
    { name: "All Rates", icon: "📉", category: "oracle" },
    { name: "Send CELO", icon: "💸", category: "transfer" },
    { name: "Send Tokens", icon: "💰", category: "transfer" },
    { name: "Balance Check", icon: "🔍", category: "data" },
    { name: "Gas Price", icon: "⛽", category: "data" },
  ],
  social: [
    { name: "Send CELO", icon: "💸", category: "transfer" },
    { name: "Send Tokens (Tips)", icon: "💰", category: "transfer" },
    { name: "Check Balance", icon: "🔍", category: "data" },
  ],
  custom: [
    { name: "Send CELO", icon: "💸", category: "transfer" },
    { name: "Send Tokens", icon: "💰", category: "transfer" },
    { name: "Oracle Rates", icon: "📊", category: "oracle" },
    { name: "Mento Quote", icon: "💱", category: "mento" },
    { name: "Balance Check", icon: "🔍", category: "data" },
    { name: "Gas Price", icon: "⛽", category: "data" },
  ],
};

interface TemplateStepProps {
  selectedTemplate: AgentTemplate | null;
  onSelect: (templateId: AgentTemplate) => void;
}

export function TemplateStep({ selectedTemplate, onSelect }: TemplateStepProps) {
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {AGENT_TEMPLATES.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all duration-300 hover:border-forest/20 ${
              selectedTemplate === template.id
                ? "border-celo ring-1 ring-celo/20"
                : ""
            }`}
            onClick={() => onSelect(template.id)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${template.color} text-2xl`}
                  >
                    {template.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-forest">{template.name}</h3>
                  </div>
                </div>
                {selectedTemplate === template.id && (
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-forest">
                    <Check className="w-4 h-4 text-forest" />
                  </div>
                )}
              </div>
              <p className="text-sm text-forest-muted mb-4">{template.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {template.features.slice(0, 3).map((feature) => (
                  <Badge key={feature} variant="secondary" className="text-[10px]">
                    {feature}
                  </Badge>
                ))}
                {template.features.length > 3 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{template.features.length - 3} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Skills preview for selected template */}
      {selectedTemplate && (
        <Card className="border-forest/15">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-forest">Agent Skills</span>
              <Badge variant="secondary" className="text-[10px]">OpenClaw-compatible</Badge>
            </div>
            <p className="text-xs text-forest-muted mb-3">
              Skills are auto-injected into the agent&apos;s system prompt. The agent invokes them via command tags in its responses to fetch real data and execute on-chain actions.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(TEMPLATE_SKILLS[selectedTemplate] || []).map((s) => (
                <Badge key={s.name} variant="outline" className="text-[10px] gap-1">
                  {s.icon} {s.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

