"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { AppKitButton } from "@reown/appkit/react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Bot,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-gypsum">
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
                {isConnected ? (
                  <Link href="/dashboard">
                    <Button variant="glow" size="lg" className="text-base">
                      <Bot className="w-5 h-5" />
                      Launch Dashboard
                    </Button>
                  </Link>
                ) : (
                  <AppKitButton />
                )}
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
