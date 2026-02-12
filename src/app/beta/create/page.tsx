"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Button } from "@/components/ui/button";
import { Bot, Send, Loader2, ArrowLeft, Shield } from "lucide-react";
import { useERC8004 } from "@/hooks/useERC8004";

type Message = {
  role: "user" | "assistant";
  content: string;
  needsSign?: boolean;
  agentId?: string;
  agentName?: string;
  link?: string;
};

export default function BetaCreatePage() {
  const { address, isConnected } = useAccount();
  const { register: registerOnChain } = useERC8004();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [signingAgentId, setSigningAgentId] = React.useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("/api/beta/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          walletAddress: address || undefined,
          conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
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
      <header className="border-b border-forest/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-forest">Create Agent via Chat</h1>
        </div>
        <div className="text-xs text-forest-muted">
          {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected"}
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-6">
        <div className="flex-1 overflow-auto space-y-4 mb-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bot className="w-14 h-14 text-forest-faint mb-4" />
              <h3 className="text-forest font-medium mb-2">Chat to create an agent</h3>
              <p className="text-sm text-forest-muted max-w-sm">
                Ask about templates, deploy agents, or view your agents. Example: &quot;Deploy a payment agent called RemiBot.&quot;
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  msg.role === "user"
                    ? "bg-forest text-white rounded-br-sm"
                    : "bg-gypsum-dark text-forest/70 rounded-bl-sm"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">
                  {msg.content.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                    part.startsWith("**") && part.endsWith("**") ? (
                      <strong key={j}>{part.slice(2, -2)}</strong>
                    ) : (
                      part
                    )
                  )}
                </p>
                {msg.role === "assistant" && msg.needsSign && msg.agentId && msg.agentName && (
                  <div className="mt-3 flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-forest hover:bg-forest-light"
                      disabled={signingAgentId === msg.agentId}
                      onClick={() => handleSignToRegister(msg.agentId!, msg.agentName!)}
                    >
                      {signingAgentId === msg.agentId ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Shield className="w-4 h-4 mr-1" />
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
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-gypsum-dark rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-2 text-forest-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Create or deploy an agent..."
            className="flex-1 h-12 px-4 bg-white border border-forest/20 rounded-xl text-sm text-forest placeholder:text-forest-muted/70 focus:outline-none focus:ring-2 focus:ring-forest/30"
            disabled={isSending}
          />
          <Button
            size="icon"
            variant="glow"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="rounded-xl h-12 w-12"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
