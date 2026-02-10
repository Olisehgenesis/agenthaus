"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Key, ExternalLink, Info } from "lucide-react";
import { AGENT_TEMPLATES, LLM_MODELS, LLM_PROVIDER_INFO } from "@/lib/constants";
import type { AgentTemplate, LLMProvider, AgentConfig } from "@/lib/types";

interface ConfigureStepProps {
  selectedTemplate: AgentTemplate | null;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
  llmProvider: LLMProvider;
  setLlmProvider: (v: LLMProvider) => void;
  llmModel: string;
  setLlmModel: (v: string) => void;
  config: AgentConfig;
  setConfig: (v: AgentConfig) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  apiKeySaving: boolean;
  apiKeySaved: boolean;
  hasKeyForProvider: boolean;
  onSaveApiKey: () => void;
  onResetKey: () => void;
}

export function ConfigureStep({
  selectedTemplate,
  name,
  setName,
  description,
  setDescription,
  systemPrompt,
  setSystemPrompt,
  llmProvider,
  setLlmProvider,
  llmModel,
  setLlmModel,
  config,
  setConfig,
  apiKey,
  setApiKey,
  apiKeySaving,
  apiKeySaved,
  hasKeyForProvider,
  onSaveApiKey,
  onResetKey,
}: ConfigureStepProps) {
  const providerInfo = LLM_PROVIDER_INFO[llmProvider];
  const currentTemplate = AGENT_TEMPLATES.find((t) => t.id === selectedTemplate);

  return (
    <div className="space-y-6">
      {/* Agent Details */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Details</CardTitle>
          <CardDescription>Configure your agent&apos;s basic settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              label="Agent Name (optional)"
              placeholder={
                selectedTemplate
                  ? `e.g. My ${AGENT_TEMPLATES.find((t) => t.id === selectedTemplate)?.name || "Agent"}`
                  : "My Agent"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-[10px] text-forest-muted/70 mt-1">
              Leave blank to auto-generate a random ID (e.g.{" "}
              <span className="font-mono text-forest-muted">#A3F9B2</span>)
            </p>
          </div>
          <Input
            label="Description"
            placeholder="A brief description of what this agent does"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="grid md:grid-cols-2 gap-4">
            <Select
              label="LLM Provider"
              value={llmProvider}
              onChange={(e) => {
                const provider = e.target.value as LLMProvider;
                setLlmProvider(provider);
                setLlmModel(LLM_MODELS[provider][0].id);
                setApiKey("");
              }}
              options={[
                { value: "openrouter", label: "OpenRouter (Free Models)" },
                { value: "groq", label: "Groq (Fast Inference)" },
                { value: "openai", label: "OpenAI (ChatGPT)" },
                { value: "grok", label: "Grok (xAI)" },
                { value: "gemini", label: "Google Gemini" },
                { value: "deepseek", label: "DeepSeek" },
                { value: "zai", label: "Z.AI (GLM-4)" },
              ]}
            />
            <Select
              label="Model"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              options={LLM_MODELS[llmProvider].map((m) => ({
                value: m.id,
                label: m.name,
              }))}
            />
          </div>

          {/* Inline API Key Configuration */}
          <div className="mt-4 p-4 rounded-lg bg-gypsum border border-forest/15/50">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-forest/80">
                {providerInfo.label} API Key
              </span>
              {hasKeyForProvider && (
                <Badge variant="default" className="text-[10px] bg-forest/20 text-forest-light border-celo/30">
                  ✓ Configured
                </Badge>
              )}
              {apiKeySaved && (
                <Badge variant="default" className="text-[10px] bg-forest/20 text-forest-light border-celo/30">
                  Saved!
                </Badge>
              )}
            </div>

            {hasKeyForProvider ? (
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-forest-muted">
                    Your {providerInfo.label} API key is already configured. You can update it in{" "}
                    <a href="/dashboard/settings" className="text-forest-light hover:text-forest underline">
                      Settings
                    </a>
                    .
                  </p>
                  <div className="mt-2">
                    <button
                      onClick={onResetKey}
                      className="text-xs text-forest-muted/70 hover:text-forest-muted underline cursor-pointer"
                    >
                      Enter a new key instead
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-forest-muted/70 mb-2">
                  {providerInfo.description}
                  {providerInfo.hasFreeModels && (
                    <span className="text-forest-light ml-1">• Free models available</span>
                  )}
                </p>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder={providerInfo.keyPlaceholder}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onSaveApiKey}
                    loading={apiKeySaving}
                    disabled={!apiKey}
                    className="whitespace-nowrap"
                  >
                    Save Key
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <a
                    href={providerInfo.keyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    Get API Key <ExternalLink className="w-3 h-3" />
                  </a>
                  <p className="text-xs text-forest-faint">Optional — can be set later in Settings</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle>System Prompt</CardTitle>
          <CardDescription>Define your agent&apos;s behavior and capabilities</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Enter your agent's system prompt..."
            className="min-h-[250px] font-mono text-sm"
          />
          <p className="text-xs text-forest-muted/70 mt-2">
            {systemPrompt.length} characters • Defines how your agent processes requests
          </p>
        </CardContent>
      </Card>

      {/* Template-specific: Payment */}
      {currentTemplate && selectedTemplate === "payment" && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Settings</CardTitle>
            <CardDescription>Configure payment-specific parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Max Transaction Amount ($)"
              type="number"
              value={config.maxTransactionAmount?.toString() || "1000"}
              onChange={(e) => setConfig({ ...config, maxTransactionAmount: Number(e.target.value) })}
            />
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="requireConfirmation"
                checked={config.requireConfirmation ?? true}
                onChange={(e) => setConfig({ ...config, requireConfirmation: e.target.checked })}
                className="rounded border-forest/15"
              />
              <label htmlFor="requireConfirmation" className="text-sm text-forest/80">
                Require confirmation for transactions over $100
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template-specific: Trading */}
      {currentTemplate && selectedTemplate === "trading" && (
        <Card>
          <CardHeader>
            <CardTitle>Trading Settings</CardTitle>
            <CardDescription>Configure trading-specific parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Max Slippage (%)"
              type="number"
              step="0.1"
              value={config.maxSlippage?.toString() || "1.0"}
              onChange={(e) => setConfig({ ...config, maxSlippage: Number(e.target.value) })}
            />
            <Input
              label="Stop Loss (%)"
              type="number"
              step="0.5"
              value={config.stopLossPercentage?.toString() || "5.0"}
              onChange={(e) => setConfig({ ...config, stopLossPercentage: Number(e.target.value) })}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

