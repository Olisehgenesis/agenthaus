"use client";

import { useCallback, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { type Address } from "viem";
import {
  IDENTITY_REGISTRY_ABI,
  REPUTATION_REGISTRY_ABI,
  registerAgent,
  setAgentWallet,
} from "@/lib/blockchain/erc8004";
import {
  ERC8004_IDENTITY_REGISTRY,
  ERC8004_REPUTATION_REGISTRY,
} from "@/lib/constants";

interface UseERC8004Return {
  // Registration
  register: (ownerAddress: Address, agentURI: string) => Promise<string>;
  linkWallet: (agentId: bigint, walletAddress: Address, ownerAddress: Address) => Promise<string>;

  // Read operations
  getAgent: (agentId: bigint) => Promise<{
    owner: string;
    agentURI: string;
    wallet: string;
    active: boolean;
  } | null>;
  getReputation: (agentId: bigint) => Promise<{
    score: number;
    totalInteractions: number;
    lastUpdated: number;
  } | null>;

  // State
  isRegistering: boolean;
  isLinking: boolean;
  error: string | null;
}

export function useERC8004(): UseERC8004Return {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Register an agent on-chain via ERC-8004 IdentityRegistry
   * Returns the transaction hash
   */
  const register = useCallback(
    async (ownerAddress: Address, agentURI: string): Promise<string> => {
      if (!walletClient) {
        throw new Error("Wallet not connected");
      }

      setIsRegistering(true);
      setError(null);

      try {
        const txHash = await registerAgent(walletClient, ownerAddress, agentURI);

        // Wait for confirmation
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        }

        return txHash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Registration failed";
        setError(message);
        throw err;
      } finally {
        setIsRegistering(false);
      }
    },
    [walletClient, publicClient]
  );

  /**
   * Link a wallet address to an agent on the IdentityRegistry
   */
  const linkWallet = useCallback(
    async (agentId: bigint, walletAddress: Address, ownerAddress: Address): Promise<string> => {
      if (!walletClient) {
        throw new Error("Wallet not connected");
      }

      setIsLinking(true);
      setError(null);

      try {
        const txHash = await setAgentWallet(walletClient, agentId, walletAddress, ownerAddress);

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        }

        return txHash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Wallet linking failed";
        setError(message);
        throw err;
      } finally {
        setIsLinking(false);
      }
    },
    [walletClient, publicClient]
  );

  /**
   * Get agent details from the IdentityRegistry
   */
  const getAgent = useCallback(
    async (agentId: bigint) => {
      if (!publicClient) return null;

      try {
        const result = await publicClient.readContract({
          address: ERC8004_IDENTITY_REGISTRY as Address,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "getAgent",
          args: [agentId],
        });

        return {
          owner: result[0] as string,
          agentURI: result[1] as string,
          wallet: result[2] as string,
          active: result[3] as boolean,
        };
      } catch {
        return null;
      }
    },
    [publicClient]
  );

  /**
   * Get agent reputation from the ReputationRegistry
   */
  const getReputation = useCallback(
    async (agentId: bigint) => {
      if (!publicClient) return null;

      try {
        const result = await publicClient.readContract({
          address: ERC8004_REPUTATION_REGISTRY as Address,
          abi: REPUTATION_REGISTRY_ABI,
          functionName: "getReputation",
          args: [agentId],
        });

        return {
          score: Number(result[0]),
          totalInteractions: Number(result[1]),
          lastUpdated: Number(result[2]),
        };
      } catch {
        return null;
      }
    },
    [publicClient]
  );

  return {
    register,
    linkWallet,
    getAgent,
    getReputation,
    isRegistering,
    isLinking,
    error,
  };
}

