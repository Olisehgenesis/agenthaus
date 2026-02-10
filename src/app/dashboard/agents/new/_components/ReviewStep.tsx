"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Rocket, AlertCircle, Loader2 } from "lucide-react";
import type { AgentTemplate, LLMProvider } from "@/lib/types";

type DeployStatus = "idle" | "creating" | "signing" | "confirming" | "activating" | "done" | "error";

interface ReviewStepProps {
  name: string;
  selectedTemplate: AgentTemplate | null;
  llmProvider: LLMProvider;
  llmModel: string;
  spendingLimit: number;
  systemPrompt: string;
  address: string | undefined;
  deployStatus: DeployStatus;
  isDeploying: boolean;
  deployError: string | null;
  erc8004Error: string | null;
  erc8004Deployed: boolean | null;
  erc8004Contracts: { identityRegistry: string; reputationRegistry: string } | null;
  currentChainId: number | undefined;
  onDeploy: () => void;
}

const DEPLOY_STEPS = [
  { key: "creating", label: "Creating agent & HD wallet..." },
  { key: "signing", label: "Sign ERC-8004 registration transaction..." },
  { key: "confirming", label: "Waiting for on-chain confirmation..." },
  { key: "activating", label: "Activating agent & generating pairing code..." },
  { key: "done", label: "Agent deployed!" },
];

const STEP_ORDER = ["creating", "signing", "confirming", "activating", "done"];

export function ReviewStep({
  name,
  selectedTemplate,
  llmProvider,
  llmModel,
  spendingLimit,
  systemPrompt,
  address,
  deployStatus,
  isDeploying,
  deployError,
  erc8004Error,
  erc8004Deployed,
  erc8004Contracts,
  currentChainId,
  onDeploy,
}: ReviewStepProps) {
  const currentIdx = STEP_ORDER.indexOf(deployStatus);

  return (
    <div className="space-y-6">
      {/* Review Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Review Configuration</CardTitle>
          <CardDescription>Verify your agent&apos;s settings before deployment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { label: "Name", value: name.trim() || "(auto-generated #XXXXXX)" },
                { label: "Template", value: selectedTemplate },
                { label: "LLM Provider", value: llmProvider },
                { label: "Model", value: llmModel },
                { label: "Spending Limit", value: `$${spendingLimit}` },
                { label: "Owner", value: address || "Not connected" },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-lg bg-gypsum">
                  <div className="text-xs text-forest-muted/70 mb-1">{item.label}</div>
                  <div className="text-sm text-forest font-medium truncate">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-gypsum">
              <div className="text-xs text-forest-muted/70 mb-1">System Prompt</div>
              <div className="text-sm text-forest/80 font-mono whitespace-pre-wrap max-h-32 overflow-auto">
                {systemPrompt.slice(0, 300)}
                {systemPrompt.length > 300 && "..."}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deploy Card */}
      <Card className="border-celo/20 bg-forest/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-forest/20">
              <Rocket className="w-6 h-6 text-forest-light" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-forest mb-1">Ready to Deploy</h3>

              {/* Deploy status steps */}
              {deployStatus !== "idle" && deployStatus !== "error" && (
                <div className="space-y-2 mb-4">
                  {DEPLOY_STEPS.map((step) => {
                    const stepIdx = STEP_ORDER.indexOf(step.key);
                    const isDone = stepIdx < currentIdx;
                    const isCurrent = step.key === deployStatus;

                    return (
                      <div key={step.key} className="flex items-center gap-2">
                        {isDone ? (
                          <Check className="w-4 h-4 text-forest-light" />
                        ) : isCurrent ? (
                          <Loader2 className="w-4 h-4 text-forest-light animate-spin" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-forest-faint" />
                        )}
                        <span
                          className={`text-sm ${
                            isCurrent
                              ? "text-forest"
                              : isDone
                              ? "text-forest-light"
                              : "text-forest-muted/70"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Error message */}
              {(deployError || erc8004Error) && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-300">{deployError || erc8004Error}</p>
                  </div>
                </div>
              )}

              {deployStatus === "idle" && (
                <>
                  <p className="text-sm text-forest-muted mb-4">
                    Your agent will be registered on-chain via the ERC-8004 IdentityRegistry. This
                    mints an identity NFT and requires a wallet signature to pay gas.
                  </p>

                  {/* ERC-8004 deployment status */}
                  {erc8004Deployed === false && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-amber-300">
                            ERC-8004 contracts not found on chain {currentChainId}.
                          </p>
                          <p className="text-xs text-forest-muted mt-1">
                            Switch to Celo Mainnet (42220) to deploy your agent.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {erc8004Contracts && (
                    <div className="p-3 rounded-lg bg-forest/10 border border-celo/20 mb-4">
                      <p className="text-xs text-forest-light">
                        ✓ ERC-8004 IdentityRegistry found on chain {currentChainId}
                      </p>
                      <p className="text-xs text-forest-muted/70 mt-1">
                        Contract: {erc8004Contracts.identityRegistry.slice(0, 18)}...
                      </p>
                    </div>
                  )}
                </>
              )}

              <Button
                variant="glow"
                size="lg"
                loading={isDeploying}
                disabled={isDeploying || !address || erc8004Deployed === false}
                onClick={onDeploy}
              >
                <Rocket className="w-5 h-5" />
                {isDeploying
                  ? deployStatus === "signing"
                    ? "Sign Transaction in Wallet..."
                    : deployStatus === "confirming"
                    ? "Confirming On-Chain..."
                    : "Deploying..."
                  : "Deploy & Register On-Chain"}
              </Button>

              {!address && (
                <p className="text-xs text-amber-400 mt-2">⚠️ Connect your wallet to deploy</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

