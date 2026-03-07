"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { type Address } from "viem";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
  Rocket,
  Loader2,
} from "lucide-react";
import { AGENT_TEMPLATES, LLM_MODELS } from "@/lib/constants";
import type { AgentTemplate, LLMProvider, AgentConfig } from "@/lib/types";
import { useERC8004 } from "@/hooks/useERC8004";
import {
  TemplateStep,
  ConfigureStep,
  SecurityStep,
  ReviewStep,
  DeploySuccessFeedback,
  type WalletOption,
} from "./_components";


export default function NewAgentPage() {
  const router = useRouter();
  const { address, chainId, isConnected } = useAccount();
  const [isDeploying, setIsDeploying] = React.useState(false);
  const [deployStatus, setDeployStatus] = React.useState<
    "idle" | "creating" | "uploading" | "signing" | "confirming" | "activating" | "done" | "error"
  >("idle");
  const [deployError, setDeployError] = React.useState<string | null>(null);

  // ERC-8004 on-chain registration
  const {
    register: registerOnChain,
    giveFeedback,
    checkDeployed,
    isRegistering,
    error: erc8004Error,
    chainId: currentChainId,
    contractAddresses: erc8004Contracts,
    blockExplorerUrl,
  } = useERC8004();
  const [erc8004Deployed, setErc8004Deployed] = React.useState<boolean | null>(null);
  const [createdAgentId, setCreatedAgentId] = React.useState<string | null>(null);

  React.useEffect(() => {
    checkDeployed().then(setErc8004Deployed);
  }, [checkDeployed, currentChainId]);

  // ── Form State ──────────────────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = React.useState<AgentTemplate | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [llmProvider, setLlmProvider] = React.useState<LLMProvider>("groq");
  const [llmModel, setLlmModel] = React.useState("llama-3.3-70b-versatile");
  const [spendingLimit, setSpendingLimit] = React.useState(100);
  const [config, setConfig] = React.useState<AgentConfig>({});
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [walletOption, setWalletOption] = React.useState<WalletOption>("dedicated");
  const [apiKey, setApiKey] = React.useState("");
  const [apiKeySaving, setApiKeySaving] = React.useState(false);
  const [apiKeySaved, setApiKeySaved] = React.useState(false);

  // API key status per provider
  const [keyStatus, setKeyStatus] = React.useState<Record<string, boolean>>({
    openrouter: false,
    openai: false,
    groq: false,
    anthropic: false,
    grok: false,
    gemini: false,
    deepseek: false,
    zai: false,
  });

  React.useEffect(() => {
    if (!address) return;
    fetch(`/api/settings?walletAddress=${address}`)
      .then((res) => res.json())
      .then((data) => {
        setKeyStatus({
          openrouter: data.hasOpenrouterKey ?? false,
          openai: data.hasOpenaiKey ?? false,
          groq: data.hasGroqKey ?? false,
          anthropic: data.hasAnthropicKey ?? false,
          grok: data.hasGrokKey ?? false,
          gemini: data.hasGeminiKey ?? false,
          deepseek: data.hasDeepseekKey ?? false,
          zai: data.hasZaiKey ?? false,
        });
      })
      .catch(() => { });
  }, [address]);

  const hasKeyForProvider = keyStatus[llmProvider] || false;

  // ── Helpers ─────────────────────────────────────────────────────────
  const providerKeyField: Record<string, string> = {
    openrouter: "openrouterApiKey",
    openai: "openaiApiKey",
    groq: "groqApiKey",
    anthropic: "anthropicApiKey",
    grok: "grokApiKey",
    gemini: "geminiApiKey",
    deepseek: "deepseekApiKey",
    zai: "zaiApiKey",
  };

  const generateRandomName = () => {
    const hex = Math.random().toString(16).slice(2, 8).toUpperCase();
    return `#${hex}`;
  };

  const handleTemplateSelect = (templateId: AgentTemplate) => {
    setSelectedTemplate(templateId);
    const template = AGENT_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setSystemPrompt(template.defaultPrompt);
      setConfig(template.defaultConfig);
      setName("");
      setDescription(template.description);
    }
  };

  const handleSaveApiKey = async () => {
    if (!address || !apiKey) return;
    setApiKeySaving(true);
    try {
      const body: Record<string, string> = { walletAddress: address };
      body[providerKeyField[llmProvider]] = apiKey;

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setKeyStatus((prev) => ({ ...prev, [llmProvider]: true }));
        setApiKey("");
        setApiKeySaved(true);
        setTimeout(() => setApiKeySaved(false), 3000);
      }
    } catch (e) {
      console.error("Failed to save API key:", e);
    } finally {
      setApiKeySaving(false);
    }
  };

  const handleDeploy = async () => {
    if (!address) return;
    setIsDeploying(true);
    setDeployError(null);
    setDeployStatus("creating");

    try {
      // Create agent in DB
      const agentName = name.trim() || generateRandomName();
      const createRes = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agentName,
          description,
          templateType: selectedTemplate,
          systemPrompt,
          llmProvider,
          llmModel,
          spendingLimit,
          configuration: config,
          ownerAddress: address,
          walletOption,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || "Failed to create agent");
      }

      const agent = await createRes.json();

      // Upload agent image before registration (ERC-8004 best practice)
      if (imageFile) {
        setDeployStatus("uploading");
        const formData = new FormData();
        formData.append("file", imageFile);
        const imgRes = await fetch(`/api/agents/${agent.id}/image`, {
          method: "POST",
          body: formData,
        });
        if (!imgRes.ok) {
          const err = await imgRes.json();
          throw new Error(err.error || "Failed to upload image");
        }
      }

      // ERC-8004 On-Chain Registration
      setDeployStatus("signing");
      const result = await registerOnChain(address as Address, agent.id, agentName);

      setDeployStatus("confirming");

      // Record on-chain data + activate
      setDeployStatus("activating");
      await fetch(`/api/agents/${agent.id}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          erc8004AgentId: result.agentId,
          erc8004TxHash: result.txHash,
          erc8004ChainId: result.chainId,
          erc8004URI: result.agentURI,
        }),
      });

      setDeployStatus("done");
      setCreatedAgentId(agent.id);
    } catch (error) {
      console.error("Failed to deploy agent:", error);
      setDeployError(error instanceof Error ? error.message : "Deployment failed");
      setDeployStatus("error");
    } finally {
      setIsDeploying(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────
  const canProceed = selectedTemplate && name && spendingLimit > 0;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b-4 border-forest">
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.back()}
            className="w-16 h-16 border-4 border-forest bg-white flex items-center justify-center hover:bg-celo transition-colors shadow-hard active:translate-y-px active:shadow-hard-active cursor-pointer"
          >
            <ArrowLeft className="w-8 h-8 stroke-[3px]" />
          </button>
          <div>
            <h1 className="text-6xl font-black uppercase tracking-tighter text-forest leading-none">
              Create
            </h1>
            <p className="text-forest font-bold uppercase tracking-widest mt-4">
              Initialize New Autonomous Node
            </p>
          </div>
        </div>
      </div>

      {deployStatus === "done" && createdAgentId ? (
        <div className="bg-white border-4 border-forest shadow-hard p-12">
          <DeploySuccessFeedback
            chainId={currentChainId}
            giveFeedback={giveFeedback}
            onDone={() => router.push(`/dashboard/agents/${createdAgentId}`)}
            hasApiKey={hasKeyForProvider}
            llmProvider={llmProvider}
            onSaveApiKey={handleSaveApiKey}
            apiKey={apiKey}
            setApiKey={setApiKey}
            apiKeySaving={apiKeySaving}
            apiKeySaved={apiKeySaved}
          />
        </div>
      ) : (
        <>
          <div className="space-y-12">
            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-forest text-white flex items-center justify-center font-black">01</div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">Choose Purpose</h2>
              </div>
              <TemplateStep
                selectedTemplate={selectedTemplate}
                onSelect={handleTemplateSelect}
              />
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-forest text-white flex items-center justify-center font-black">02</div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">Identity</h2>
              </div>
              <ConfigureStep
                selectedTemplate={selectedTemplate}
                name={name}
                setName={setName}
                description={description}
                setDescription={setDescription}
                systemPrompt={systemPrompt}
                setSystemPrompt={setSystemPrompt}
                llmProvider={llmProvider}
                setLlmProvider={setLlmProvider}
                llmModel={llmModel}
                setLlmModel={setLlmModel}
                config={config}
                setConfig={setConfig}
                imageFile={imageFile}
                setImageFile={setImageFile}
                apiKey={apiKey}
                setApiKey={setApiKey}
                apiKeySaving={apiKeySaving}
                apiKeySaved={apiKeySaved}
                hasKeyForProvider={hasKeyForProvider}
                onSaveApiKey={handleSaveApiKey}
                onResetKey={() => setKeyStatus((prev) => ({ ...prev, [llmProvider]: false }))}
                isSimplified
              />
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-forest text-white flex items-center justify-center font-black">03</div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">Guardrails</h2>
              </div>
              <SecurityStep
                spendingLimit={spendingLimit}
                setSpendingLimit={setSpendingLimit}
                walletOption={walletOption}
                setWalletOption={setWalletOption}
              />
            </section>
          </div>

          <div className="pt-12 pb-24 border-t-4 border-forest flex flex-col items-center gap-6">
            {deployError && (
              <div className="w-full p-4 border-2 border-red-600 bg-red-50 text-red-600 font-bold uppercase text-sm">
                Error: {deployError}
              </div>
            )}
            <Button
              size="lg"
              onClick={handleDeploy}
              disabled={!canProceed || isDeploying}
              className="h-20 px-24 text-2xl w-full md:w-auto"
            >
              {isDeploying ? (
                <><Loader2 className="w-8 h-8 animate-spin mr-3" /> {deployStatus.toUpperCase()}...</>
              ) : (
                <>CREATE & DEPLOY AGENT <Rocket className="ml-3 w-8 h-8" /></>
              )}
            </Button>
            <p className="text-[10px] font-bold text-forest/40 uppercase tracking-[0.2em]">
              On-chain registration requires wallet signature
            </p>
          </div>
        </>
      )}
    </div>
  );
}
