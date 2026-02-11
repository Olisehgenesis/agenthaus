/**
 * Celo MCP-Equivalent Data Layer
 *
 * Provides blockchain read operations equivalent to the Celo MCP server:
 * network status, blocks, transactions, token info, token balances,
 * NFT operations, contract calls, gas estimation, governance.
 *
 * Used by skill handlers to power [[GET_NETWORK_STATUS]], [[GET_BLOCK]], etc.
 */

import {
  formatUnits,
  formatEther,
  type Address,
  type Hash,
} from "viem";
import { getPublicClient } from "./wallet";

const RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";

/** Public client for Celo RPC reads. Uses active chain from wallet config. */
function getClient() {
  return getPublicClient();
}

// ─── Network & Block ──────────────────────────────────────────────────────────

export interface NetworkStatus {
  connected: boolean;
  chainId: number;
  networkName: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  latestBlock: number;
  gasPrice: string;
  isTestnet: boolean;
}

export async function getNetworkStatus(): Promise<NetworkStatus> {
  const client = getPublicClient();
  const [chainId, blockNumber, gasPrice] = await Promise.all([
    client.getChainId(),
    client.getBlockNumber(),
    client.getGasPrice(),
  ]);

  return {
    connected: true,
    chainId: Number(chainId),
    networkName: chainId === 42220 ? "Celo Mainnet" : chainId === 11142220 ? "Celo Sepolia" : `Chain ${chainId}`,
    rpcUrl: RPC_URL,
    blockExplorerUrl: chainId === 42220 ? "https://celoscan.io" : "https://celo-sepolia.blockscout.com",
    latestBlock: Number(blockNumber),
    gasPrice: formatUnits(gasPrice, 9) + " gwei",
    isTestnet: chainId !== 42220,
  };
}

export interface BlockInfo {
  number: number;
  hash: string;
  timestamp: Date;
  parentHash: string;
  gasUsed: bigint;
  gasLimit: bigint;
  baseFeePerGas: string | null;
  transactionsCount: number;
}

export async function getBlock(blockId: string | number | "latest"): Promise<BlockInfo | null> {
  const client = getClient();
  let block: Awaited<ReturnType<typeof client.getBlock>> | null = null;

  if (blockId === "latest" || blockId === "") {
    block = await client.getBlock();
  } else if (typeof blockId === "number" || /^\d+$/.test(String(blockId))) {
    block = await client.getBlock({ blockNumber: BigInt(blockId) }).catch(() => null);
  } else {
    block = await client.getBlock({ blockHash: blockId as Hash }).catch(() => null);
  }

  if (!block) return null;

  return {
    number: Number(block.number),
    hash: block.hash!,
    timestamp: new Date(Number(block.timestamp) * 1000),
    parentHash: block.parentHash,
    gasUsed: block.gasUsed,
    gasLimit: block.gasLimit,
    baseFeePerGas: block.baseFeePerGas ? formatUnits(block.baseFeePerGas, 9) + " gwei" : null,
    transactionsCount: block.transactions.length,
  };
}

export async function getLatestBlocks(count: number = 10): Promise<BlockInfo[]> {
  const client = getClient();
  const latest = await client.getBlockNumber();
  const blocks: BlockInfo[] = [];

  for (let i = 0; i < Math.min(count, 100); i++) {
    const block = await client.getBlock({ blockNumber: latest - BigInt(i) }).catch(() => null);
    if (block) {
      blocks.push({
        number: Number(block.number),
        hash: block.hash!,
        timestamp: new Date(Number(block.timestamp) * 1000),
        parentHash: block.parentHash,
        gasUsed: block.gasUsed,
        gasLimit: block.gasLimit,
        baseFeePerGas: block.baseFeePerGas ? formatUnits(block.baseFeePerGas, 9) + " gwei" : null,
        transactionsCount: block.transactions.length,
      });
    }
  }

  return blocks;
}

// ─── Transaction ───────────────────────────────────────────────────────────

export interface TransactionInfo {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gasUsed: string;
  gasPrice: string;
  blockNumber: number;
  status: "success" | "reverted" | "pending";
  timestamp?: Date;
}

export async function getTransaction(txHash: string): Promise<TransactionInfo | null> {
  const client = getClient();
  const tx = await client.getTransaction({ hash: txHash as Hash }).catch(() => null);
  if (!tx) return null;

  const receipt = await client.getTransactionReceipt({ hash: txHash as Hash }).catch(() => null);
  const block = receipt?.blockNumber
    ? await client.getBlock({ blockNumber: receipt.blockNumber }).catch(() => null)
    : null;

  return {
    hash: tx.hash,
    from: tx.from,
    to: tx.to ?? null,
    value: formatEther(tx.value),
    gasUsed: receipt ? formatUnits(receipt.gasUsed, 0) : "—",
    gasPrice: tx.gasPrice ? formatUnits(tx.gasPrice, 9) + " gwei" : "—",
    blockNumber: receipt?.blockNumber ? Number(receipt.blockNumber) : 0,
    status: receipt ? (receipt.status === "success" ? "success" : "reverted") : "pending",
    timestamp: block?.timestamp ? new Date(Number(block.timestamp) * 1000) : undefined,
  };
}

// ─── Token (ERC20) ───────────────────────────────────────────────────────────

const ERC20_ABI = [
  { name: "name", type: "function", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "totalSupply", type: "function", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
}

export async function getTokenInfo(tokenAddress: Address): Promise<TokenInfo | null> {
  const client = getClient();
  try {
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "name" }),
      client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "symbol" }),
      client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "decimals" }),
      client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "totalSupply" }),
    ]);

    return {
      address: tokenAddress,
      name: String(name),
      symbol: String(symbol),
      decimals: Number(decimals),
      totalSupply: formatUnits(totalSupply as bigint, Number(decimals)),
    };
  } catch {
    return null;
  }
}

export async function getTokenBalance(tokenAddress: Address, ownerAddress: Address): Promise<string> {
  const client = getClient();
  try {
    const [balance, decimals] = await Promise.all([
      client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "balanceOf", args: [ownerAddress] }),
      client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "decimals" }),
    ]);
    return formatUnits(balance as bigint, Number(decimals));
  } catch {
    return "0";
  }
}

/** Raw token balance in wei (for sponsorship requests that need wei string). */
export async function getTokenBalanceWei(tokenAddress: Address, ownerAddress: Address): Promise<string> {
  const client = getClient();
  try {
    const balance = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [ownerAddress],
    });
    return String(balance);
  } catch {
    return "0";
  }
}

// ─── NFT (ERC721 / ERC1155) ──────────────────────────────────────────────────

const ERC721_ABI = [
  { name: "name", type: "function", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }] },
  { name: "tokenURI", type: "function", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { name: "balanceOf", type: "function", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const ERC1155_ABI = [
  { name: "uri", type: "function", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  {
    name: "balanceOf",
    type: "function",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export interface NftInfo {
  address: string;
  type: "ERC721" | "ERC1155";
  name: string;
  symbol?: string;
  tokenURI?: string;
}

export async function getNftInfo(
  contractAddress: Address,
  tokenId?: string
): Promise<NftInfo | null> {
  const client = getClient();
  try {
    // Try ERC721 first
    const [name, symbol, uri] = await Promise.all([
      client.readContract({ address: contractAddress, abi: ERC721_ABI, functionName: "name" }).catch(() => null),
      client.readContract({ address: contractAddress, abi: ERC721_ABI, functionName: "symbol" }).catch(() => null),
      tokenId
        ? client.readContract({ address: contractAddress, abi: ERC721_ABI, functionName: "tokenURI", args: [BigInt(tokenId)] }).catch(() => null)
        : null,
    ]);

    if (name !== null) {
      return {
        address: contractAddress,
        type: "ERC721",
        name: String(name),
        symbol: symbol ? String(symbol) : undefined,
        tokenURI: uri ? String(uri) : undefined,
      };
    }

    // Try ERC1155
    const baseUri = tokenId
      ? await client.readContract({ address: contractAddress, abi: ERC1155_ABI, functionName: "uri", args: [BigInt(tokenId)] }).catch(() => null)
      : null;

    return {
      address: contractAddress,
      type: "ERC1155",
      name: contractAddress,
      tokenURI: baseUri ? String(baseUri) : undefined,
    };
  } catch {
    return null;
  }
}

export async function getNftBalance(
  contractAddress: Address,
  ownerAddress: Address,
  tokenId?: string
): Promise<string> {
  const client = getClient();
  try {
    if (tokenId) {
      // ERC1155
      const bal = await client.readContract({
        address: contractAddress,
        abi: ERC1155_ABI,
        functionName: "balanceOf",
        args: [ownerAddress, BigInt(tokenId)],
      }).catch(() => null);
      return bal !== null ? String(bal) : "0";
    }
    // ERC721
    const bal = await client.readContract({
      address: contractAddress,
      abi: ERC721_ABI,
      functionName: "balanceOf",
      args: [ownerAddress],
    }).catch(() => null);
    return bal !== null ? String(bal) : "0";
  } catch {
    return "0";
  }
}

// ─── Contract Call & Gas Estimate ────────────────────────────────────────────

export async function callContractFunction(
  address: Address,
  functionName: string,
  args: unknown[],
  abi: unknown[] = []
): Promise<{ result: unknown; error?: string }> {
  const client = getClient();
  try {
    const result = await client.readContract({
      address,
      abi: (abi.length ? abi : [{ name: functionName, type: "function", inputs: [], outputs: [{ type: "unknown" }] }]) as never[],
      functionName: functionName as never,
      args: args as never[],
    });
    return { result };
  } catch (err) {
    return { result: null, error: String(err) };
  }
}

function inferAbiInputs(args: unknown[]): { name: string; type: string }[] {
  return args.map((a, i) => ({
    name: `arg${i}`,
    type: typeof a === "string" && (a as string).startsWith("0x") ? "address" : "uint256",
  }));
}

export async function estimateContractGas(
  address: Address,
  functionName: string,
  args: unknown[],
  account: Address
): Promise<{ gasEstimate: string; error?: string }> {
  const client = getClient();
  const inputs = inferAbiInputs(args);
  try {
    const gas = await client.estimateContractGas({
      address,
      abi: [
        {
          name: functionName,
          type: "function",
          stateMutability: "view",
          inputs,
          outputs: [{ type: "uint256" }],
        },
      ] as never[],
      functionName: functionName as never,
      args: args as never[],
      account,
    });
    return { gasEstimate: formatUnits(gas, 0) };
  } catch (err) {
    return { gasEstimate: "0", error: String(err) };
  }
}

// ─── Gas Fee Data (EIP-1559) ──────────────────────────────────────────────────

export interface GasFeeData {
  baseFeePerGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  estimatedCostCelo: string;
}

export async function getGasFeeData(): Promise<GasFeeData> {
  const client = getPublicClient();
  const [gasPrice, block] = await Promise.all([
    client.getGasPrice(),
    client.getBlock(),
  ]);

  const baseFee = block?.baseFeePerGas ?? gasPrice;
  const maxPriorityFee = BigInt(500000000); // 0.5 gwei
  const maxFee = (baseFee ?? gasPrice) * BigInt(2) + maxPriorityFee;

  const transferCost = gasPrice * BigInt(21000);
  const estimatedCostCelo = formatEther(transferCost);

  return {
    baseFeePerGas: formatUnits(baseFee ?? gasPrice, 9) + " gwei",
    maxFeePerGas: formatUnits(maxFee, 9) + " gwei",
    maxPriorityFeePerGas: formatUnits(maxPriorityFee, 9) + " gwei",
    estimatedCostCelo: estimatedCostCelo + " CELO (simple transfer)",
  };
}

// ─── Governance ──────────────────────────────────────────────────────────────
// Governance proposals require an external API. Set CELO_GOVERNANCE_API_URL if you have one.
// Celo Mondo and Celo CLI use on-chain contracts; this layer uses a REST API for convenience.
const CELO_GOVERNANCE_API = process.env.CELO_GOVERNANCE_API_URL || "";

export interface GovernanceProposal {
  id: number;
  cgp?: number;
  title: string;
  stage: number;
  stage_name: string;
  is_active: boolean;
  votes?: { total_formatted: string; yes: { percentage: number; formatted: string }; no: { percentage: number } };
  proposer?: string;
  urls?: { discussion?: string; cgp?: string };
}

export async function getGovernanceProposals(params?: {
  page?: number;
  limit?: number;
  includeInactive?: boolean;
}): Promise<{ proposals: GovernanceProposal[]; total?: number; error?: string }> {
  if (!CELO_GOVERNANCE_API) {
    return { proposals: [], error: "CELO_GOVERNANCE_API_URL not configured. Set env var to fetch governance proposals." };
  }
  try {
    const url = new URL(`${CELO_GOVERNANCE_API}/proposals`);
    if (params?.page) url.searchParams.set("page", String(params.page));
    if (params?.limit) url.searchParams.set("limit", String(params.limit ?? 10));
    if (params?.includeInactive !== false) url.searchParams.set("include_inactive", "true");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Governance API: ${res.status}`);
    const data = (await res.json()) as { proposals?: GovernanceProposal[]; data?: GovernanceProposal[] };
    const proposals = data.proposals ?? data.data ?? [];
    return { proposals: Array.isArray(proposals) ? proposals : [] };
  } catch (err) {
    return { proposals: [], error: String(err) };
  }
}

export async function getProposalDetails(proposalId: number): Promise<{
  proposal: GovernanceProposal | null;
  error?: string;
}> {
  if (!CELO_GOVERNANCE_API) {
    return { proposal: null, error: "CELO_GOVERNANCE_API_URL not configured." };
  }
  try {
    const res = await fetch(`${CELO_GOVERNANCE_API}/proposals/${proposalId}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Governance API: ${res.status}`);
    const data = (await res.json()) as { proposal?: GovernanceProposal };
    return { proposal: data.proposal ?? null };
  } catch (err) {
    return { proposal: null, error: String(err) };
  }
}
