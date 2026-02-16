"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Send,
  Loader2,
  ArrowLeft,
  Shield,
  ImagePlus,
  X,
  Coins,
  HandCoins,
  List,
  Zap,
  Trash2,
} from "lucide-react";
import { useERC8004 } from "@/hooks/useERC8004";
import { ChatMessageContent } from "@/components/chat/ChatMessageContent";
import { VerifyInChat } from "./_components/VerifyInChat";

type FundWalletPayload = {
  agentName: string;
  walletAddress: string;
  publicKey?: string;
  qrDataUrl: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  attachmentPreview?: string;
  needsSign?: boolean;
  agentId?: string;
  agentName?: string;
  link?: string;
  verifySession?: {
    agentId: string;
    agentName: string;
    selfAppConfig: Record<string, unknown>;
    sessionId: string;
  };
  fundWallet?: FundWalletPayload;
};

const QUICK_ACTIONS = [
  { label: "My Agents", prompt: "How many agents do I have? Which are verified?", icon: List },
  { label: "Deploy Token", prompt: "I want to deploy a token for my verified agent", icon: Coins },
  { label: "Request Sponsorship", prompt: "Request sponsorship for my agent", icon: HandCoins },
  { label: "Templates", prompt: "What agent templates can I deploy?", icon: Zap },
];

const CHAT_STORAGE_KEY = "agenthaus-beta-chat";
const MAX_MESSAGES = 30;
const EXPIRY_DAYS = 3;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result : `data:${file.type};base64,${result}`);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadPersistedChat(walletAddress: string): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${CHAT_STORAGE_KEY}-${walletAddress.toLowerCase()}`);
    if (!raw) return [];
    const { messages, savedAt } = JSON.parse(raw) as { messages: Message[]; savedAt: number };
    const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - savedAt > expiryMs) return [];
    return Array.isArray(messages) ? messages : [];
  } catch {
    return [];
  }
}

function savePersistedChat(walletAddress: string, messages: Message[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = messages.slice(-MAX_MESSAGES);
    const toSave = trimmed.map((m) => ({
      ...m,
      attachmentPreview: undefined, // blob URLs can't be restored
    }));
    localStorage.setItem(
      `${CHAT_STORAGE_KEY}-${walletAddress.toLowerCase()}`,
      JSON.stringify({ messages: toSave, savedAt: Date.now() })
    );
  } catch {
    // ignore
  }
}

export default function BetaCreatePage() {
  const { address, isConnected } = useAccount();
  const { register: registerOnChain } = useERC8004();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [attachment, setAttachment] = React.useState<{ file: File; preview: string } | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [signingAgentId, setSigningAgentId] = React.useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Load persisted chat when wallet connects or changes
  useEffect(() => {
    if (address) {
      setMessages(loadPersistedChat(address));
    } else {
      setMessages([]);
    }
  }, [address]);

  // Save to localStorage when messages change (last 30, 3-day expiry)
  useEffect(() => {
    if (address && messages.length > 0) {
      savePersistedChat(address, messages);
    }
  }, [address, messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;
    setAttachment({
      file,
      preview: URL.createObjectURL(file),
    });
    e.target.value = "";
  };

  const handleSend = async (overridePrompt?: string) => {
    const rawText = (overridePrompt ?? input).trim();
    const hasAttachment = !!attachment;
    if ((!rawText && !hasAttachment) || isSending) return;

    const text = rawText || (hasAttachment ? "Use this image as the agent logo" : "");
    let imageBase64: string | undefined;
    if (attachment) {
      imageBase64 = await fileToBase64(attachment.file);
      setAttachment(null);
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
        attachmentPreview: attachment?.preview,
      },
    ]);
    setInput("");
    setIsSending(true);

    try {
      const lastCreatedAgent = [...messages]
        .reverse()
        .find((m) => m.role === "assistant" && m.agentId && m.agentName);
      const recentAgentNames = [
        ...new Set(
          messages
            .filter((m) => m.role === "assistant" && m.agentName)
            .map((m) => m.agentName!)
        ),
      ].slice(-10);
      const sessionContext: Record<string, unknown> = {};
      if (lastCreatedAgent?.agentId && lastCreatedAgent?.agentName) {
        sessionContext.lastCreatedAgent = {
          id: lastCreatedAgent.agentId,
          name: lastCreatedAgent.agentName,
        };
      }
      if (recentAgentNames.length > 0) {
        sessionContext.recentAgentNames = recentAgentNames;
      }

      const res = await fetch("/api/beta/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          walletAddress: address || undefined,
          imageBase64,
          conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
          sessionContext,
        }),
      });

      const data = await res.json();
      const reply = data.response || data.error || "Failed to get response.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          needsSign: data.needsSign,
          agentId: data.agentId,
          agentName: data.agentName,
          link: data.link,
          verifySession: data.verifySession,
          fundWallet: data.fundWallet,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Make sure you have an API key in Settings (OpenRouter free tier works).",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSignToRegister = async (agentId: string, agentName: string) => {
    if (!address) return;
    setSigningAgentId(agentId);
    try {
      const result = await registerOnChain(address as `0x${string}`, agentId, agentName);
      await fetch(`/api/agents/${agentId}/deploy`, {
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
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `${agentName} is registered and active!`,
          agentId,
          agentName,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Registration failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
      ]);
    } finally {
      setSigningAgentId(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gypsum p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <Bot className="w-16 h-16 text-forest-faint mx-auto" />
          <h2 className="text-2xl font-bold text-forest">Connect Your Wallet</h2>
          <p className="text-forest-muted">
            Connect your wallet to create and deploy agents via chat.
          </p>
          <ConnectWalletButton size="lg" />
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-forest-muted">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gypsum">
      {/* Sticky header — Agent Control Interface */}
      <header className="sticky top-0 z-10 border-b border-forest/10 bg-gypsum/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-forest-muted hover:text-forest">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-base font-semibold text-forest">Agent Haus</h1>
            <p className="text-xs text-forest-muted">Create & deploy on Celo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-forest-muted hover:text-forest text-xs"
              onClick={() => {
                setMessages([]);
                if (address) {
                  localStorage.removeItem(`${CHAT_STORAGE_KEY}-${address.toLowerCase()}`);
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Clear chat
            </Button>
          )}
          <span className="text-xs text-forest-muted">Network: Celo</span>
          <span className="text-xs font-mono text-forest/80">
            {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—"}
          </span>
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 sm:p-6">
        <div className="flex-1 overflow-auto space-y-3 mb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-forest/10 flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-forest" />
              </div>
              <h3 className="text-forest font-medium mb-1">Agent Control</h3>
              <p className="text-sm text-forest-muted max-w-xs mb-6">
                Create agents, deploy tokens, request sponsorship. Type or use quick actions.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_ACTIONS.map(({ label, prompt, icon: Icon }) => (
                  <Button
                    key={label}
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-forest/20 text-forest hover:bg-forest/5"
                    onClick={() => handleSend(prompt)}
                  >
                    <Icon className="w-3.5 h-3.5 mr-1.5" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-forest text-white rounded-br-md"
                    : "bg-white border border-forest/10 shadow-sm rounded-bl-md"
                }`}
              >
                {msg.role === "user" && msg.attachmentPreview && (
                  <div className="mb-2 rounded-lg overflow-hidden w-20 h-20">
                    <img
                      src={msg.attachmentPreview}
                      alt="Attachment"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <ChatMessageContent
                  content={msg.content}
                  variant={msg.role === "user" ? "user" : "assistant"}
                />
                {msg.role === "assistant" && msg.needsSign && msg.agentId && msg.agentName && (
                  <div className="mt-3 flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-forest hover:bg-forest-light text-white rounded-lg"
                      disabled={signingAgentId === msg.agentId}
                      onClick={() => handleSignToRegister(msg.agentId!, msg.agentName!)}
                    >
                      {signingAgentId === msg.agentId ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      ) : (
                        <Shield className="w-4 h-4 mr-1.5" />
                      )}
                      Sign to Register ERC-8004
                    </Button>
                    {msg.link && (
                      <Link
                        href={msg.link}
                        className="text-xs text-forest-light hover:underline"
                      >
                        View agent →
                      </Link>
                    )}
                  </div>
                )}
                {msg.role === "assistant" && msg.verifySession && (
                  <VerifyInChat
                    agentId={msg.verifySession.agentId}
                    agentName={msg.verifySession.agentName}
                    selfAppConfig={msg.verifySession.selfAppConfig}
                    sessionId={msg.verifySession.sessionId}
                    onVerified={() => {}}
                  />
                )}
                {msg.role === "assistant" && msg.fundWallet && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50/80 border border-amber-200/60">
                    <p className="text-xs font-medium text-amber-800/90 mb-2">
                      ⚠️ Fund {msg.fundWallet.agentName} — CELO or cUSD for gas
                    </p>
                    <div className="flex gap-3 items-start">
                      {msg.fundWallet.qrDataUrl && (
                        <img
                          src={msg.fundWallet.qrDataUrl}
                          alt="Wallet QR"
                          className="w-20 h-20 rounded-lg border border-amber-200/60"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <code className="text-xs break-all text-forest/80 block">
                          {msg.fundWallet.walletAddress}
                        </code>
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg text-xs h-7"
                            onClick={() =>
                              navigator.clipboard.writeText(msg.fundWallet!.walletAddress)
                            }
                          >
                            Copy
                          </Button>
                          <Link href={`/dashboard/agents`}>
                            <Button size="sm" variant="outline" className="rounded-lg text-xs h-7">
                              Retry later
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-white border border-forest/10 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-forest-muted">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span className="text-sm">
                    <span className="typing-dots">...</span>
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input — attachment + text + send */}
        <div className="flex flex-col gap-2">
          {attachment && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-forest/10">
              <img
                src={attachment.preview}
                alt="Preview"
                className="w-12 h-12 rounded-lg object-cover"
              />
              <span className="text-xs text-forest-muted flex-1 truncate">{attachment.file.name}</span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="p-1 rounded hover:bg-forest/10 text-forest-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAttachment}
            />
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl h-12 w-12 border-forest/20 text-forest-muted hover:text-forest hover:bg-forest/5"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              title="Attach image (agent logo)"
            >
              <ImagePlus className="w-5 h-5" />
            </Button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Create agent, deploy token, my agents..."
              className="flex-1 h-12 px-4 bg-white border border-forest/20 rounded-xl text-sm text-forest placeholder:text-forest-muted/70 focus:outline-none focus:ring-2 focus:ring-forest/20"
              disabled={isSending}
            />
            <Button
              size="icon"
              variant="glow"
              onClick={() => handleSend()}
              disabled={(!input.trim() && !attachment) || isSending}
              className="rounded-xl h-12 w-12 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-forest-muted/80">
            Attach image for agent logo • PNG, JPG, WebP up to 5MB
          </p>
          {messages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_ACTIONS.map(({ label, prompt, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  disabled={isSending}
                  className="text-xs px-2 py-1 rounded-md text-forest-muted hover:text-forest hover:bg-forest/5 transition-colors"
                >
                  <Icon className="w-3 h-3 inline mr-1 align-middle" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
