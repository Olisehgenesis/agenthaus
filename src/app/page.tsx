"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ReactTyped } from "react-typed";
import { useAccount, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Zap, Bot, Sparkles, Send, LogOut } from "lucide-react";
/** Hackathon ideas – one flowing paragraph each, related phrases (random) */
const DEMO_PROMPTS = [
  "Deploy an ERC-8004 remittance agent for me that parses natural language like send $50 to my mom in the Philippines, finds the cheapest route via Mento, and executes cross-border transfers in cUSD with fee comparison to Western Union…",
  "Deploy an ERC-8004 split-bill agent for me that takes voice input for dinner expenses, confirms who owes what audibly, tracks balances across events, and settles debts via stablecoin transfers in group chats…",
  "Deploy an ERC-8004 freelancer agent for me that holds funds in escrow, uses an AI judge to resolve disputes by comparing deliverables to requirements, and releases payment automatically when milestones are approved…",
  "Deploy an ERC-8004 FX hedging agent for me that monitors my portfolio exposure, keeps 50% USD and 30% EUR via Mento swaps, rebalances when drift exceeds my threshold, and batches trades for lower fees…",
  "Deploy an ERC-8004 savings agent for me that sets goals like save $500 for vacation, asks about income and risk tolerance, allocates across AAVE and Uniswap LPs, and adjusts strategy as markets move…",
  "Deploy an ERC-8004 price-alert agent for me that watches ETH and BTC, buys when price drops below my target, sells on 20% gains, and notifies me on Telegram when trades execute…",
  "Deploy an ERC-8004 reputation oracle for me that indexes on-chain behavior and payment history, scores agents by reliability and task completion, and lets other agents query trust before transacting…",
  "Deploy an ERC-8004 no-code launcher for me with templates for trading and payments, an LLM config and prompt editor, one-click ERC-8004 registration, and a dashboard to monitor activity and spending…",
  "Deploy an ERC-8004 raffle agent for me that sells tickets via x402 micropayments, accumulates the prize pool, uses Chainlink VRF for provably fair winner selection, and distributes prizes automatically…",
  "Deploy an ERC-8004 arbitrage agent for me that monitors Uniswap and Mento for stablecoin price gaps, executes profitable trades, and shares returns with delegators who deposit into my vault…",
  "Deploy an ERC-8004 task marketplace for me where agents post work with specs and budget, other agents bid with reputation thresholds, and x402 pays automatically on verified completion…",
  "Deploy an ERC-8004 DAO treasury agent for me that runs payroll and recurring bills, invests idle funds in AAVE and Uniswap LPs, and queues large transactions for multi-sig approval…",
  "Deploy an ERC-8004 MentoTrader agent for me that competes on FX returns, ranks on a public leaderboard, and lets users delegate capital to my strategy with configurable profit sharing…",
  "Deploy an ERC-8004 Rent-a-Human agent for me that posts physical tasks like verify a storefront or deliver a package, accepts proof from verified workers, and releases USDT payment on completion…",
  "Deploy an ERC-8004 KYC gateway for me that agents call when they need verification, returns privacy-preserving attestations without raw PII, and charges per check in USDT…",
  "Deploy an ERC-8004 AgentVault for me that stores encrypted memory on IPFS, lets agents remember preferences and conversation history across sessions, and charges per GB and query…",
  "Deploy an ERC-8004 Agent Mesh for me that registers capabilities and pricing, lets agents discover each other by task type and reputation, and enables encrypted messaging for task coordination…",
];

type DemoState = "idle" | "clicking";

export default function HomePage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [demoState, setDemoState] = useState<DemoState>("idle");

  // Shuffle prompts so each load gets a random order
  const shuffledPrompts = useMemo(
    () => [...DEMO_PROMPTS].sort(() => Math.random() - 0.5),
    []
  );

  const handleTryClick = () => {
    if (demoState !== "idle") return;
    setDemoState("clicking");
    setTimeout(() => {
      router.push("/beta/create");
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gypsum">
      {/* Top header — Disconnect wallet when connected */}
      {isConnected && (
        <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 bg-gypsum/95 backdrop-blur-sm border-b border-forest/10">
          <Link href="/" className="flex items-center gap-2 text-forest font-semibold">
            <Zap className="w-5 h-5" />
            Agent Haus
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => disconnect()}
            className="gap-2 border-forest/20 text-forest hover:bg-forest/10"
          >
            <LogOut className="w-4 h-4" />
            Disconnect wallet
          </Button>
        </header>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-24">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6">
            {/* Left: Text content */}
            <div className="flex-1 text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full bg-forest/10 border border-forest/15 text-forest text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                Built on Celo with ERC-8004
              </div>

              {/* Heading */}
              <h1 className="text-5xl md:text-7xl font-bold mb-3 leading-tight">
                <span className="text-[#655947]">Agent Haus</span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg md:text-xl text-forest-muted max-w-2xl mx-auto lg:mx-0 mb-6 leading-relaxed">
                Create, deploy, and manage AI agents on the Celo blockchain. 
                Automatic ERC-8004 registration, secure wallet management, 
                and real-time monitoring — all from a visual dashboard.
              </p>

              {/* CTA */}
              <div className="flex items-center justify-center lg:justify-start gap-4">
                <Link href="/dashboard">
                  <Button
                    size="lg"
                    className="text-base bg-[#AB9FF2] text-white hover:bg-[#AB9FF2]/90 border-0"
                  >
                    <Bot className="w-5 h-5" />
                    Enter app
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline" size="lg" className="text-base">
                    Learn More
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto lg:mx-0 mt-10 text-center lg:text-left">
                {[
                  { label: "Templates", value: "4+" },
                  { label: "Chains", value: "Celo" },
                  { label: "Registration", value: "ERC-8004" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="text-2xl font-bold text-forest">{stat.value}</div>
                    <div className="text-sm text-forest-muted">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Demo: typed text + Try it button (horizontal, 2-line input) */}
              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-2xl mx-auto lg:mx-0">
                <div className="flex-1 min-h-[5.5rem] flex items-center text-forest text-sm sm:text-base border border-forest/20 rounded-xl px-4 py-3 bg-white/80 leading-relaxed">
                  {demoState === "idle" ? (
                    <ReactTyped
                      strings={shuffledPrompts}
                      typeSpeed={35}
                      backSpeed={20}
                      backDelay={1500}
                      loop
                      shuffle={false}
                      showCursor={false}
                    />
                  ) : (
                    <span className="text-forest-muted">Opening AI chat…</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleTryClick}
                  disabled={demoState !== "idle"}
                  className={cn(
                    "shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer",
                    demoState === "idle" &&
                      "bg-forest text-white hover:bg-forest-light active:scale-95",
                    demoState === "clicking" &&
                      "bg-forest/70 text-white scale-95",
                    demoState === "clicking" &&
                      "cursor-wait"
                  )}
                >
                  {demoState === "idle" ? (
                    <>
                      <Send className="w-4 h-4" />
                      Try it (beta)
                    </>
                  ) : (
                    "Opening…"
                  )}
                </button>
              </div>
            </div>

            {/* Right: Hero illustration - reduced size, near text */}
            <div className="flex-shrink-0 w-full lg:w-80 xl:w-96">
              <Image
                src="/images/01-Landing_Page_Hero-Option_A-Central_Bot_with_Dashboard.png"
                alt="AgentHaus bot with dashboard - deploy AI agents without code"
                width={384}
                height={216}
                className="w-full h-auto rounded-xl object-contain"
                priority
              />
            </div>
          </div>
        </div>
        {/* Background effects */}
        <div className="absolute inset-0 grid-pattern" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-celo/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-forest/5 rounded-full blur-3xl" />
      </section>

      {/* Footer */}
      <footer className="border-t border-forest/10 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-forest" />
            <span className="text-sm text-forest-muted">
              Celo AgentHAUS © 2026
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-forest-muted">
            <span>Built with ERC-8004</span>
            <span>•</span>
            <span>Powered by Celo</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
