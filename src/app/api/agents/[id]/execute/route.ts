import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendCelo, sendToken, getPublicClient } from "@/lib/blockchain/wallet";
import { getAmountUsd } from "@/lib/blockchain/spending";
import { CELO_TOKENS, getBlockExplorer } from "@/lib/constants";
import { type Address, isAddress } from "viem";

/**
 * POST /api/agents/:id/execute — Execute a transaction from the agent's wallet
 *
 * Body:
 *   { to: "0x...", amount: "1.5", currency: "CELO" | "cUSD" | "cEUR" | "cREAL" }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { to, amount, currency = "CELO" } = body;

    // Validate inputs
    if (!to || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: to, amount" },
        { status: 400 }
      );
    }

    if (!isAddress(to)) {
      return NextResponse.json(
        { error: `Invalid recipient address: ${to}` },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: `Invalid amount: ${amount}` },
        { status: 400 }
      );
    }

    // Load agent
    const agent = await prisma.agent.findUnique({
      where: { id },
      select: {
        id: true,
        walletDerivationIndex: true,
        agentWalletAddress: true,
        spendingLimit: true,
        spendingUsed: true,
        erc8004ChainId: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.walletDerivationIndex === null || !agent.agentWalletAddress) {
      return NextResponse.json(
        { error: "Agent has no wallet. Initialize one first via POST /api/agents/:id/wallet" },
        { status: 400 }
      );
    }

    const currencyUpper = (currency as string).toUpperCase();

    // Spending limit check — use USD equivalent
    const usdValue = await getAmountUsd(currencyUpper, parsedAmount);
    if (agent.spendingLimit && usdValue != null && (agent.spendingUsed + usdValue) > agent.spendingLimit) {
      return NextResponse.json(
        {
          error: `Spending limit exceeded. Used: $${agent.spendingUsed.toFixed(2)}, Limit: $${agent.spendingLimit.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // Execute transaction
    let txHash: string;

    if (currencyUpper === "CELO") {
      txHash = await sendCelo(agent.walletDerivationIndex, to as Address, amount);
    } else {
      const tokenKey = currencyUpper as keyof typeof CELO_TOKENS;
      const tokenInfo = CELO_TOKENS[tokenKey];
      if (!tokenInfo) {
        return NextResponse.json(
          { error: `Unsupported currency: ${currency}. Supported: CELO, cUSD, cEUR, cREAL` },
          { status: 400 }
        );
      }
      if (tokenInfo.address === "0x0000000000000000000000000000000000000000") {
        txHash = await sendCelo(agent.walletDerivationIndex, to as Address, amount);
      } else {
        txHash = await sendToken(
          agent.walletDerivationIndex,
          tokenInfo.address as Address,
          to as Address,
          amount,
          tokenInfo.decimals
        );
      }
    }

    // Wait for receipt
    const publicClient = getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      timeout: 30_000,
    });

    const status = receipt.status === "success" ? "confirmed" : "failed";

    // Record in DB
    await prisma.transaction.create({
      data: {
        agentId: id,
        txHash,
        type: "send",
        status,
        fromAddress: agent.agentWalletAddress,
        toAddress: to,
        amount: parsedAmount,
        currency: currencyUpper,
        gasUsed: receipt.gasUsed ? Number(receipt.gasUsed) / 1e18 : null,
        blockNumber: receipt.blockNumber ? Number(receipt.blockNumber) : null,
        description: `Sent ${amount} ${currencyUpper} to ${to}`,
      },
    });

    // Update spending — only when we have USD value
    if (usdValue != null && usdValue > 0) {
      await prisma.agent.update({
        where: { id },
        data: { spendingUsed: { increment: usdValue } },
      });
    }

    // Log
    await prisma.activityLog.create({
      data: {
        agentId: id,
        type: "action",
        message: `Executed: sent ${amount} ${currencyUpper} to ${to.slice(0, 10)}...`,
      },
    });

    return NextResponse.json({
      success: true,
      txHash,
      status,
      blockNumber: receipt.blockNumber ? Number(receipt.blockNumber) : null,
      explorerUrl: `${getBlockExplorer(agent.erc8004ChainId ?? 42220)}/tx/${txHash}`,
      amount: parsedAmount,
      currency: currencyUpper,
      to,
      from: agent.agentWalletAddress,
    });
  } catch (error) {
    console.error("Transaction execution error:", error);
    const msg = error instanceof Error ? error.message : "Transaction failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

