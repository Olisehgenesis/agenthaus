"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import { createAppKit } from "@reown/appkit/react";
import { wagmiAdapter, projectId, networks } from "@/config/appkit";

const queryClient = new QueryClient();

// Create AppKit modal (must be called once, outside components)
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [...networks],
  defaultNetwork: networks[0],
  metadata: {
    name: "Agent Haus",
    description: "Deploy AI agents on Celo without code",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    icons: ["/logo.svg"],
  },
  features: {
    analytics: true,
  },
});

export function Providers({
  children,
  cookies,
}: {
  children: React.ReactNode;
  cookies?: string | null;
}) {
  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies ?? null
  );

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
