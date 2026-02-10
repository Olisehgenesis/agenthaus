"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XCircle, Loader2 } from "lucide-react";
import type { ChannelData } from "../_types";

interface ChannelsCardProps {
  agentId: string;
  channelData: ChannelData | null;
  fetchChannels: () => void;
  // Telegram
  showTelegramForm: boolean;
  setShowTelegramForm: (v: boolean) => void;
  telegramToken: string;
  setTelegramToken: (v: string) => void;
  telegramConnecting: boolean;
  setTelegramConnecting: (v: boolean) => void;
  // Cron
  showScheduleForm: boolean;
  setShowScheduleForm: (v: boolean) => void;
  scheduleForm: { name: string; cron: string; skillPrompt: string };
  setScheduleForm: (v: { name: string; cron: string; skillPrompt: string }) => void;
}

export function ChannelsCard({
  agentId,
  channelData,
  fetchChannels,
  showTelegramForm,
  setShowTelegramForm,
  telegramToken,
  setTelegramToken,
  telegramConnecting,
  setTelegramConnecting,
  showScheduleForm,
  setShowScheduleForm,
  scheduleForm,
  setScheduleForm,
}: ChannelsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">📡 Channels & Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Connected Channels */}
        <div className="text-xs text-forest-muted/70">Connected Channels</div>
        <div className="space-y-1">
          {/* Web Chat — always on */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-gypsum/80">
            <div className="flex items-center gap-2">
              <span className="text-sm">💬</span>
              <span className="text-xs text-forest/80">Web Chat</span>
            </div>
            <Badge variant="default" className="text-[10px] bg-forest/20 text-forest-light border-forest/30">Active</Badge>
          </div>

          {/* Telegram Channel */}
          {channelData?.channels.find((c) => c.type === "telegram" && c.enabled) ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-gypsum/80">
              <div className="flex items-center gap-2">
                <span className="text-sm">📱</span>
                <div>
                  <span className="text-xs text-forest/80">Telegram</span>
                  {channelData.channels.find((c) => c.type === "telegram")?.botUsername && (
                    <span className="text-[10px] text-forest-muted/70 ml-1">
                      {channelData.channels.find((c) => c.type === "telegram")?.botUsername}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="default" className="text-[10px] bg-forest/20 text-forest-light border-forest/30">Active</Badge>
                <button
                  onClick={async () => {
                    if (!confirm("Disconnect Telegram bot?")) return;
                    await fetch(`/api/agents/${agentId}/channels`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "disconnect_telegram" }),
                    });
                    fetchChannels();
                  }}
                  className="text-red-400 hover:text-red-300 cursor-pointer ml-1"
                  title="Disconnect"
                >
                  <XCircle className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setShowTelegramForm(!showTelegramForm)}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-gypsum/80 hover:bg-gypsum transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">📱</span>
                  <span className="text-xs text-forest-muted">Telegram</span>
                </div>
                <span className="text-[10px] text-blue-400">+ Connect</span>
              </button>

              {showTelegramForm && (
                <div className="p-3 mt-1 rounded-lg bg-gypsum space-y-2">
                  <p className="text-[10px] text-forest-muted">
                    Get a bot token from{" "}
                    <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      @BotFather
                    </a>{" "}
                    on Telegram, then paste it here.
                  </p>
                  <input
                    type="password"
                    className="w-full h-8 rounded bg-white border border-forest/15 text-xs text-forest px-2 font-mono"
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v..."
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="text-xs h-7"
                      disabled={!telegramToken || telegramConnecting}
                      onClick={async () => {
                        setTelegramConnecting(true);
                        try {
                          const res = await fetch(`/api/agents/${agentId}/channels`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "connect_telegram", botToken: telegramToken }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setShowTelegramForm(false);
                            setTelegramToken("");
                            fetchChannels();
                          } else {
                            alert(data.error || "Failed to connect Telegram bot");
                          }
                        } catch {
                          alert("Network error");
                        } finally {
                          setTelegramConnecting(false);
                        }
                      }}
                    >
                      {telegramConnecting ? (
                        <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Connecting...</>
                      ) : (
                        "Connect Bot"
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setShowTelegramForm(false); setTelegramToken(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scheduled Tasks */}
        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-forest-muted/70">Scheduled Tasks</div>
          <div className="flex gap-2">
            {channelData && channelData.cronJobs.length === 0 && (
              <button
                onClick={async () => {
                  await fetch(`/api/agents/${agentId}/channels`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "init_default_crons" }),
                  });
                  fetchChannels();
                }}
                className="text-[10px] text-forest-light hover:text-forest cursor-pointer"
              >
                Load Defaults
              </button>
            )}
            <button onClick={() => setShowScheduleForm(!showScheduleForm)} className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer">
              + Add
            </button>
          </div>
        </div>

        {channelData?.cronJobs && channelData.cronJobs.length > 0 ? (
          <div className="space-y-1">
            {channelData.cronJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between p-2 rounded-lg bg-gypsum/80">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-forest/80">{job.name}</div>
                  <div className="text-[10px] text-forest-faint font-mono">{job.cron}</div>
                  {job.lastRun && (
                    <div className="text-[10px] text-forest-faint">
                      Last: {new Date(job.lastRun).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={async () => {
                      await fetch(`/api/agents/${agentId}/channels`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "toggle_cron", jobId: job.id }),
                      });
                      fetchChannels();
                    }}
                    className="cursor-pointer"
                    title={job.enabled ? "Pause" : "Resume"}
                  >
                    <Badge variant={job.enabled ? "default" : "outline"} className="text-[10px]">
                      {job.enabled ? "Active" : "Paused"}
                    </Badge>
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Remove "${job.name}"?`)) return;
                      await fetch(`/api/agents/${agentId}/channels`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "remove_cron", jobId: job.id }),
                      });
                      fetchChannels();
                    }}
                    className="text-red-400 hover:text-red-300 cursor-pointer"
                    title="Remove"
                  >
                    <XCircle className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-forest-faint px-2 pb-1">No scheduled tasks yet</p>
        )}

        {/* Add Cron Form */}
        {showScheduleForm && (
          <div className="p-3 rounded-lg bg-gypsum space-y-2">
            <input
              className="w-full h-8 rounded bg-white border border-forest/15 text-xs text-forest px-2"
              placeholder="Task name (e.g. Rate Monitor)"
              value={scheduleForm.name}
              onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
            />
            <input
              className="w-full h-8 rounded bg-white border border-forest/15 text-xs text-forest px-2"
              placeholder="Agent instruction / prompt"
              value={scheduleForm.skillPrompt}
              onChange={(e) => setScheduleForm({ ...scheduleForm, skillPrompt: e.target.value })}
            />
            <input
              className="w-full h-8 rounded bg-white border border-forest/15 text-xs text-forest px-2 font-mono"
              placeholder="Cron expression (e.g. */5 * * * *)"
              value={scheduleForm.cron}
              onChange={(e) => setScheduleForm({ ...scheduleForm, cron: e.target.value })}
            />
            <p className="text-[10px] text-forest-faint">
              Examples: <code className="text-forest-muted">*/5 * * * *</code> = every 5 min, <code className="text-forest-muted">0 * * * *</code> = hourly, <code className="text-forest-muted">0 9 * * *</code> = daily 9AM
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="text-xs h-7"
                disabled={!scheduleForm.name || !scheduleForm.skillPrompt || !scheduleForm.cron}
                onClick={async () => {
                  try {
                    await fetch(`/api/agents/${agentId}/channels`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "add_cron",
                        name: scheduleForm.name,
                        skillPrompt: scheduleForm.skillPrompt,
                        cron: scheduleForm.cron,
                      }),
                    });
                    setShowScheduleForm(false);
                    setScheduleForm({ name: "", cron: "", skillPrompt: "" });
                    fetchChannels();
                  } catch { /* ignore */ }
                }}
              >
                Create
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowScheduleForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

