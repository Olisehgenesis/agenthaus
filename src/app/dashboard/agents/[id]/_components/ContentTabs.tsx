"use client";

import React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import {
  Activity, TrendingUp, MessageSquare, Bot,
  Clock, Send, Loader2, Shield, ArrowUpRight,
  CheckCircle, XCircle, AlertCircle, Info,
  Coins,
} from "lucide-react";
import { TokenTradeTab } from "./TokenTradeTab";
import { ChatMessageContent } from "@/components/chat/ChatMessageContent";
import { formatAddress, formatDate } from "@/lib/utils";
import type { AgentData, ChatMessage, TransactionData, ActivityLogData } from "../_types";

interface ContentTabsProps {
  agent: AgentData;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  // Chat
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  isSending: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  handleSendMessage: () => void;
  // Data
  activityLogs: ActivityLogData[];
  transactions: TransactionData[];
  // Token & Trade (SelfClaw economy)
  verificationStatus?: { verified?: boolean };
  onOpenVerifyModal?: () => void;
}

function activityIcon(type: string) {
  switch (type) {
    case "action": return <CheckCircle className="w-4 h-4 text-forest-light" />;
    case "error": return <XCircle className="w-4 h-4 text-red-400" />;
    case "warning": return <AlertCircle className="w-4 h-4 text-amber-400" />;
    default: return <Info className="w-4 h-4 text-blue-400" />;
  }
}

export function ContentTabs({
  agent,
  activeTab,
  setActiveTab,
  chatMessages,
  chatInput,
  setChatInput,
  isSending,
  chatEndRef,
  handleSendMessage,
  activityLogs,
  transactions,
  verificationStatus,
  onOpenVerifyModal,
}: ContentTabsProps) {
  return (
    <div className="lg:col-span-2">
      <Card>
        <CardHeader className="pb-2">
          <Tabs
            tabs={[
              { id: "chat", label: "Chat", icon: <MessageSquare className="w-4 h-4" /> },
              { id: "activity", label: `Activity (${activityLogs.length})`, icon: <Activity className="w-4 h-4" /> },
              { id: "transactions", label: `Txns (${transactions.length})`, icon: <TrendingUp className="w-4 h-4" /> },
              { id: "token-trade", label: "Token & Trade", icon: <Coins className="w-4 h-4" /> },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </CardHeader>
        <CardContent>
          {/* Chat Tab */}
          {activeTab === "chat" && (
            <div className="flex flex-col h-[500px]">
              <div className="flex-1 overflow-auto space-y-3 mb-4">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Bot className="w-12 h-12 text-forest-faint mb-3" />
                    <h3 className="text-forest font-medium mb-1">Chat with {agent.name}</h3>
                    <p className="text-sm text-forest-muted/70 max-w-sm">
                      Send a message to interact with your agent. Powered by{" "}
                      <span className="capitalize">{agent.llmProvider}</span>.
                      {agent.agentWalletAddress
                        ? " This agent has a wallet and can execute real transactions."
                        : " No wallet — chat only, no on-chain transactions."}
                    </p>
                    {agent.status !== "active" && (
                      <Badge variant="warning" className="mt-3">
                        Agent is {agent.status} — deploy it first to chat
                      </Badge>
                    )}
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-celo text-forest rounded-br-sm"
                        : "bg-gypsum-dark text-forest/70 rounded-bl-sm"
                    }`}>
                      <ChatMessageContent content={msg.content} variant={msg.role === "user" ? "user" : "assistant"} />
                      <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-forest-light" : "text-forest-muted/70"}`}>
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
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
                <div ref={chatEndRef} />
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-forest/10">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  placeholder={`Message ${agent.name}...`}
                  className="flex-1 h-10 px-4 bg-gypsum border border-forest/15 rounded-full text-sm text-forest placeholder:text-forest-muted/70 focus:outline-none focus:ring-2 focus:ring-celo/50 focus:border-forest transition-all"
                  disabled={isSending || agent.status !== "active"}
                />
                <Button
                  size="icon"
                  variant="glow"
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isSending || agent.status !== "active"}
                  className="rounded-full h-10 w-10"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === "activity" && (
            <div className="space-y-2 max-h-[500px] overflow-auto">
              {activityLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-10 h-10 text-forest-faint mx-auto mb-3" />
                  <p className="text-sm text-forest-muted/70">No activity logs yet.</p>
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-gypsum/80 hover:bg-gypsum transition-colors">
                    {activityIcon(log.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-forest/80">{log.message}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-forest-faint">
                        <Clock className="w-3 h-3" />
                        {formatDate(log.createdAt)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Token & Trade Tab */}
          {activeTab === "token-trade" && (
            <TokenTradeTab
              agent={agent}
              agentId={agent.id}
              verified={!!verificationStatus?.verified}
              onOpenVerifyModal={onOpenVerifyModal}
            />
          )}

          {/* Transactions Tab */}
          {activeTab === "transactions" && (
            <div className="space-y-2 max-h-[500px] overflow-auto">
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="w-10 h-10 text-forest-faint mx-auto mb-3" />
                  <p className="text-sm text-forest-muted/70">No transactions yet.</p>
                </div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-gypsum/80 hover:bg-gypsum transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        tx.type === "send" ? "bg-accent/10" : "bg-forest/10"
                      }`}>
                        {tx.type === "send" ? (
                          <ArrowUpRight className="w-4 h-4 text-accent" />
                        ) : (
                          <Shield className="w-4 h-4 text-forest-light" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm text-forest capitalize">{tx.type}</div>
                        <div className="text-xs text-forest-muted/70">
                          {tx.toAddress ? formatAddress(tx.toAddress) : tx.txHash ? formatAddress(tx.txHash) : "—"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-forest">
                        {tx.amount && tx.amount > 0 ? `${tx.amount} ${tx.currency || ""}` : "—"}
                      </div>
                      <Badge
                        variant={tx.status === "confirmed" ? "default" : tx.status === "failed" ? "destructive" : "warning"}
                        className="text-[10px]"
                      >
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

