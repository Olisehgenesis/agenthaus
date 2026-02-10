"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { celoSepolia, celo } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "Celo Agent Forge",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  // Celo Sepolia first — we're on testnet for now
  chains: [celoSepolia, celo],
  ssr: true,
});
