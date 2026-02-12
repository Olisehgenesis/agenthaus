/**
 * HD Wallet Manager for Agent Wallets
 *
 * Uses a master mnemonic (stored in AGENT_MNEMONIC env var) to derive
 * unique wallets for each agent via HD derivation paths:
 *
 *   m/44'/60'/0'/0/{index}
 *
 * Each agent gets a unique index stored in the DB. The mnemonic never
 * leaves the server — only derived addresses are exposed to the frontend.
 *
 * Flow:
 *   1. Agent created → next available index assigned
 *   2. Address derived from mnemonic + index → stored in DB
 *   3. When agent needs to sign a tx → derive account on-the-fly from mnemonic + index
 *   4. Private key only exists in memory during signing, never persisted
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  type Address,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";
import { mnemonicToAccount, HDAccount, nonceManager } from "viem/accounts";
import { celoSepolia, celo } from "viem/chains";
import { prisma } from "@/lib/db";
import { CELO_TOKENS, ACTIVE_CHAIN_ID, CELO_SEPOLIA_CHAIN_ID, FEE_CURRENCIES } from "@/lib/constants";

// ─── Chain Config ────────────────────────────────────────────────────────────

export function getActiveChain(): Chain {
  return ACTIVE_CHAIN_ID === CELO_SEPOLIA_CHAIN_ID ? celoSepolia : celo;
}

function getRpcUrl(): string {
  const chain = getActiveChain();
  return (
    process.env.CELO_RPC_URL ||
    chain.rpcUrls.default.http[0]
  );
}

// ─── Public Client (read-only, no wallet needed) ─────────────────────────────

let _publicClient: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: getActiveChain(),
      transport: http(getRpcUrl()),
    });
  }
  return _publicClient;
}

// ─── Mnemonic & HD Derivation ────────────────────────────────────────────────

function getMnemonic(): string {
  const mnemonic = process.env.AGENT_MNEMONIC;
  if (!mnemonic) {
    throw new Error(
      "AGENT_MNEMONIC is not set. Add your mnemonic to the .env file to enable agent wallets."
    );
  }
  return mnemonic.trim();
}

/**
 * Derive an HD account for a given index.
 * Path: m/44'/60'/0'/0/{index}
 */
export function deriveAccount(index: number): HDAccount {
  const mnemonic = getMnemonic();
  return mnemonicToAccount(mnemonic, {
    addressIndex: index,
  });
}

/**
 * Get just the address for a derivation index (no private key in memory).
 */
export function deriveAddress(index: number): Address {
  return deriveAccount(index).address;
}

/**
 * Create a wallet client that can sign transactions for an agent.
 * Private key only lives in memory for the duration of this client.
 * Uses shared nonceManager to prevent "nonce too low" when multiple txs are sent.
 */
export function getAgentWalletClient(index: number): WalletClient {
  const account = mnemonicToAccount(getMnemonic(), {
    addressIndex: index,
    nonceManager,
  });
  return createWalletClient({
    account,
    chain: getActiveChain(),
    transport: http(getRpcUrl()),
  });
}

// ─── Index Management ────────────────────────────────────────────────────────

/**
 * Get the next available derivation index.
 * Finds the highest index used across all agents and returns +1.
 * Index 0 is reserved for the platform/admin wallet.
 */
export async function getNextDerivationIndex(): Promise<number> {
  const result = await prisma.agent.aggregate({
    _max: { walletDerivationIndex: true },
  });

  // Start from index 1 (index 0 = platform wallet)
  return (result._max.walletDerivationIndex ?? 0) + 1;
}

// ─── Balance Queries ─────────────────────────────────────────────────────────

// ERC-20 balanceOf ABI
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

export interface WalletBalance {
  address: string;
  nativeBalance: string; // CELO in human-readable format
  nativeBalanceWei: string;
  tokens: {
    symbol: string;
    balance: string; // Human-readable
    balanceRaw: string;
    address: string;
  }[];
}

/**
 * Get the CELO + token balances for an agent wallet.
 */
export async function getWalletBalance(address: Address): Promise<WalletBalance> {
  const client = getPublicClient();

  // Native CELO balance
  const nativeBalance = await client.getBalance({ address });

  // Token balances
  const tokenEntries = Object.values(CELO_TOKENS);
  const tokenBalances = await Promise.all(
    tokenEntries.map(async (token) => {
      try {
        const balance = await client.readContract({
          address: token.address as Address,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        });
        return {
          symbol: token.symbol,
          balance: formatUnits(balance, token.decimals),
          balanceRaw: balance.toString(),
          address: token.address,
        };
      } catch {
        return {
          symbol: token.symbol,
          balance: "0",
          balanceRaw: "0",
          address: token.address,
        };
      }
    })
  );

  return {
    address,
    nativeBalance: formatEther(nativeBalance),
    nativeBalanceWei: nativeBalance.toString(),
    tokens: tokenBalances,
  };
}

// ─── Fee Abstraction ──────────────────────────────────────────────────────────
// Celo lets you pay gas in ERC-20 stablecoins via the `feeCurrency` tx field.
// When the agent wallet has no CELO but holds cUSD/cEUR/etc., we auto-select
// the best fee currency so the transaction can still go through.

/**
 * Detect the best fee currency for a wallet.
 *
 * Priority:
 *  1. If the wallet has CELO (>= 0.01), use native CELO (undefined = default).
 *  2. Otherwise pick the first stablecoin with a balance >= 0.1.
 *  3. If nothing is found return undefined (will fail at send time).
 */
export async function detectFeeCurrency(agentAddress: Address): Promise<Address | undefined> {
  const client = getPublicClient();
  const chainId = ACTIVE_CHAIN_ID;
  const feeCurrencyMap = FEE_CURRENCIES[chainId];
  if (!feeCurrencyMap) return undefined;

  // Check native CELO first
  const nativeBal = await client.getBalance({ address: agentAddress });
  if (nativeBal >= parseEther("0.01")) {
    return undefined; // native CELO is fine
  }

  // Check stablecoins
  const candidates = Object.values(feeCurrencyMap);
  for (const candidate of candidates) {
    try {
      const bal = await client.readContract({
        address: candidate.token as Address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [agentAddress],
      });
      const threshold = candidate.decimals === 18
        ? parseUnits("0.1", 18)
        : parseUnits("0.1", candidate.decimals);
      if (bal >= threshold) {
        return candidate.feeCurrency as Address;
      }
    } catch {
      // skip
    }
  }

  return undefined;
}

/**
 * Get fee currency info for display purposes.
 */
export function getFeeCurrencyLabel(feeCurrencyAddress: Address | undefined): string {
  if (!feeCurrencyAddress) return "CELO (native)";
  const chainId = ACTIVE_CHAIN_ID;
  const feeCurrencyMap = FEE_CURRENCIES[chainId];
  if (!feeCurrencyMap) return "CELO (native)";
  const entry = Object.values(feeCurrencyMap).find(
    (c) => c.feeCurrency.toLowerCase() === feeCurrencyAddress.toLowerCase()
  );
  return entry ? `${entry.symbol} (fee abstraction)` : "Unknown token";
}

// ─── Transaction Helpers ─────────────────────────────────────────────────────

/**
 * Send native CELO from an agent wallet to a destination.
 * Automatically uses fee abstraction if the wallet has no CELO for gas.
 */
export async function sendCelo(
  agentIndex: number,
  to: Address,
  amountInEther: string
) {
  const walletClient = getAgentWalletClient(agentIndex);
  const account = walletClient.account ?? deriveAccount(agentIndex);
  const agentAddress = account.address;

  // Detect best fee currency
  const feeCurrency = await detectFeeCurrency(agentAddress);

  const txParams: Record<string, unknown> = {
    account,
    to,
    value: parseEther(String(amountInEther).replace(/,/g, "")),
    chain: getActiveChain(),
  };

  if (feeCurrency) {
    txParams.feeCurrency = feeCurrency;
    console.log(`[FeeAbstraction] Paying gas in ${getFeeCurrencyLabel(feeCurrency)} for CELO transfer`);
  }

  const hash = await walletClient.sendTransaction(txParams as Parameters<typeof walletClient.sendTransaction>[0]);
  return hash;
}

/**
 * Send an ERC-20 token (cUSD, cEUR, etc.) from an agent wallet.
 * Automatically uses fee abstraction if the wallet has no CELO for gas.
 */
export async function sendToken(
  agentIndex: number,
  tokenAddress: Address,
  to: Address,
  amount: string,
  decimals: number = 18
) {
  const walletClient = getAgentWalletClient(agentIndex);
  const account = walletClient.account ?? deriveAccount(agentIndex);
  const agentAddress = account.address;

  const { encodeFunctionData } = await import("viem");

  const data = encodeFunctionData({
    abi: [
      {
        name: "transfer",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "success", type: "bool" }],
      },
    ],
    functionName: "transfer",
    args: [to, parseUnits(String(amount).replace(/,/g, ""), decimals)],
  });

  // Detect best fee currency
  const feeCurrency = await detectFeeCurrency(agentAddress);

  const txParams: Record<string, unknown> = {
    account,
    to: tokenAddress,
    data,
    chain: getActiveChain(),
  };

  if (feeCurrency) {
    txParams.feeCurrency = feeCurrency;
    console.log(`[FeeAbstraction] Paying gas in ${getFeeCurrencyLabel(feeCurrency)} for token transfer`);
  }

  const hash = await walletClient.sendTransaction(txParams as Parameters<typeof walletClient.sendTransaction>[0]);
  return hash;
}

/**
 * Get agent wallet info by agentId (from DB).
 * Returns null if agent has no wallet yet.
 */
export async function getAgentWallet(agentId: string) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      agentWalletAddress: true,
      walletDerivationIndex: true,
    },
  });

  if (!agent?.agentWalletAddress || agent.walletDerivationIndex === null) {
    return null;
  }

  return {
    address: agent.agentWalletAddress as Address,
    derivationIndex: agent.walletDerivationIndex,
  };
}

