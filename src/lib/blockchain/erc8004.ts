import { type Address, type PublicClient, type WalletClient, encodeFunctionData } from "viem";
import { ERC8004_IDENTITY_REGISTRY, ERC8004_REPUTATION_REGISTRY } from "@/lib/constants";
import { type ERC8004Registration } from "@/lib/types";

// ERC-8004 IdentityRegistry ABI (minimal)
export const IDENTITY_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "agentURI", type: "string" },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    name: "setAgentWallet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "wallet", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "getAgent",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "agentURI", type: "string" },
      { name: "wallet", type: "address" },
      { name: "active", type: "bool" },
    ],
  },
  {
    name: "updateAgentURI",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "AgentRegistered",
    type: "event",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
    ],
  },
] as const;

// ERC-8004 ReputationRegistry ABI (minimal)
export const REPUTATION_REGISTRY_ABI = [
  {
    name: "getReputation",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "score", type: "uint256" },
      { name: "totalInteractions", type: "uint256" },
      { name: "lastUpdated", type: "uint256" },
    ],
  },
  {
    name: "submitRating",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "rating", type: "uint8" },
      { name: "comment", type: "string" },
    ],
    outputs: [],
  },
] as const;

/**
 * Generate ERC-8004 registration JSON
 */
export function generateRegistrationJSON(
  name: string,
  description: string,
  agentId: string = "TBD",
  serviceUrl: string
): ERC8004Registration {
  return {
    type: "agent-registration-v1",
    name,
    description,
    image: "ipfs://bafkreiagentforge",
    services: [
      {
        type: "x402",
        url: serviceUrl,
      },
    ],
    registrations: [
      {
        agentRegistry: `eip155:42220:${ERC8004_IDENTITY_REGISTRY}`,
        agentId,
      },
    ],
    supportedTrust: ["reputation", "crypto-economic"],
  };
}

/**
 * Register agent on ERC-8004 IdentityRegistry
 */
export async function registerAgent(
  walletClient: WalletClient,
  ownerAddress: Address,
  agentURI: string
) {
  const data = encodeFunctionData({
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "register",
    args: [ownerAddress, agentURI],
  });

  const hash = await walletClient.sendTransaction({
    to: ERC8004_IDENTITY_REGISTRY as Address,
    data,
    account: ownerAddress,
    chain: walletClient.chain,
  });

  return hash;
}

/**
 * Set agent wallet address on the registry
 */
export async function setAgentWallet(
  walletClient: WalletClient,
  agentId: bigint,
  walletAddress: Address,
  ownerAddress: Address
) {
  const data = encodeFunctionData({
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "setAgentWallet",
    args: [agentId, walletAddress],
  });

  const hash = await walletClient.sendTransaction({
    to: ERC8004_IDENTITY_REGISTRY as Address,
    data,
    account: ownerAddress,
    chain: walletClient.chain,
  });

  return hash;
}

/**
 * Get agent reputation from the ReputationRegistry
 */
export async function getAgentReputation(
  publicClient: PublicClient,
  agentId: bigint
) {
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
}

/**
 * Get agent details from the IdentityRegistry
 */
export async function getAgentDetails(
  publicClient: PublicClient,
  agentId: bigint
) {
  const result = await publicClient.readContract({
    address: ERC8004_IDENTITY_REGISTRY as Address,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "getAgent",
    args: [agentId],
  });

  return {
    owner: result[0],
    agentURI: result[1],
    wallet: result[2],
    active: result[3],
  };
}

