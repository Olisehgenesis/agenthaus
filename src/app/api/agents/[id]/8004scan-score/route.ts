/**
 * GET /api/agents/:id/8004scan-score
 *
 * Fetches the agent's 8004scan score (Score, Feedback, Stars from Browse Agents).
 * 8004scan may expose an API — when available, set 8004SCAN_API_URL in .env.
 *
 * Returns: { score: number | null, feedbackCount?: number, stars?: number, url: string }
 * If no API is configured or fetch fails, returns score: null with the 8004scan URL for manual viewing.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { get8004ScanAgentUrl } from "@/lib/constants";

const API_BASE =
  process.env.NEXT_PUBLIC_8004SCAN_API_URL || process.env["8004SCAN_API_URL"] || "https://8004scan.io";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { erc8004AgentId: true, erc8004ChainId: true },
    });
    if (!agent?.erc8004AgentId) {
      return NextResponse.json({
        score: null,
        url: null,
        error: "Agent not registered on ERC-8004",
      });
    }
    const chainId = agent.erc8004ChainId ?? 42220;
    const url = get8004ScanAgentUrl(chainId, agent.erc8004AgentId);

    // Try known 8004scan API patterns (when they publish docs, add the correct one)
    const candidates = [
      `${API_BASE}/api/agents/${chainId}/${agent.erc8004AgentId}`,
      `${API_BASE}/api/agent?chainId=${chainId}&agentId=${agent.erc8004AgentId}`,
    ];
    for (const apiUrl of candidates) {
      try {
        const res = await fetch(apiUrl, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>;
          const score = typeof data.score === "number" ? data.score : null;
          const feedbackCount = typeof data.feedbackCount === "number" ? data.feedbackCount : undefined;
          const stars = typeof data.stars === "number" ? data.stars : undefined;
          return NextResponse.json({
            score,
            feedbackCount,
            stars,
            url,
          });
        }
      } catch {
        continue;
      }
    }

    return NextResponse.json({ score: null, url });
  } catch (error) {
    console.error("8004scan score fetch error:", error);
    return NextResponse.json(
      { score: null, url: null, error: "Failed to fetch score" },
      { status: 500 }
    );
  }
}
