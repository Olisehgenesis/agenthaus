/**
 * SelfClaw API Client
 *
 * Interfaces with https://selfclaw.ai for agent verification
 * using Self.xyz passport-based zero-knowledge proofs.
 *
 * Flow:
 *   1. Generate Ed25519 key pair for the agent
 *   2. POST /start-verification → get sessionId + challenge + QR config
 *   3. Sign challenge with agent's private key
 *   4. POST /sign-challenge → submit signature
 *   5. User scans QR with Self app → verification completes
 *   6. GET /agent?publicKey=... → check verification status
 */

const SELFCLAW_BASE_URL =
  process.env.SELFCLAW_API_URL || "https://selfclaw.ai/api/selfclaw/v1";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StartVerificationRequest {
  agentPublicKey: string; // Ed25519 SPKI base64
  agentName?: string;
}

export interface StartVerificationResponse {
  success: boolean;
  sessionId: string;
  agentKeyHash: string;
  challenge: string; // The exact string to sign
  signatureRequired: boolean;
  signatureVerified: boolean;
  selfApp?: Record<string, unknown>; // Self.xyz QR code config
  config?: Record<string, unknown>; // SelfClaw app config
  error?: string;
}

export interface SignChallengeRequest {
  sessionId: string;
  signature: string; // hex or base64
}

export interface SignChallengeResponse {
  success: boolean;
  message?: string;
  selfApp?: Record<string, unknown>; // Self.xyz QR config (returned after signing)
  error?: string;
}

export interface AgentVerificationStatus {
  verified: boolean;
  publicKey?: string;
  agentName?: string;
  humanId?: string;
  swarm?: string;
  selfxyz?: {
    verified: boolean;
    registeredAt?: string;
  };
  reputation?: {
    hasErc8004: boolean;
    erc8004TokenId?: string;
    endpoint?: string;
    registryAddress?: string;
  };
  error?: string;
}

// ─── API Functions ──────────────────────────────────────────────────────────

/**
 * Step 1: Start verification — sends the agent's public key to SelfClaw.
 * Returns a session with a challenge to sign + QR code configuration.
 */
export async function startVerification(
  req: StartVerificationRequest
): Promise<StartVerificationResponse> {
  let res: Response;
  try {
    res = await fetch(`${SELFCLAW_BASE_URL}/start-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  } catch (networkError) {
    throw new Error(`Network error contacting SelfClaw: ${networkError instanceof Error ? networkError.message : "fetch failed"}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`SelfClaw returned non-JSON response (status ${res.status})`);
  }

  if (!res.ok) {
    console.error("[SelfClaw] start-verification error:", res.status, data);
    throw new Error(data.error || data.message || `SelfClaw API error: ${res.status}`);
  }

  return data;
}

/**
 * Step 2: Submit the signed challenge to prove key ownership.
 */
export async function signChallenge(
  req: SignChallengeRequest
): Promise<SignChallengeResponse> {
  let res: Response;
  try {
    res = await fetch(`${SELFCLAW_BASE_URL}/sign-challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  } catch (networkError) {
    throw new Error(`Network error contacting SelfClaw: ${networkError instanceof Error ? networkError.message : "fetch failed"}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`SelfClaw returned non-JSON response (status ${res.status})`);
  }

  if (!res.ok) {
    console.error("[SelfClaw] sign-challenge error:", res.status, data);
    throw new Error(data.error || data.message || `SelfClaw API error: ${res.status}`);
  }

  return data;
}

/**
 * Check if an agent is verified on SelfClaw.
 * Can pass either a public key or agent name as identifier.
 */
export async function checkAgentStatus(
  publicKey: string
): Promise<AgentVerificationStatus> {
  let res: Response;
  try {
    res = await fetch(
      `${SELFCLAW_BASE_URL}/agent?publicKey=${encodeURIComponent(publicKey)}`
    );
  } catch (networkError) {
    throw new Error(`Network error contacting SelfClaw: ${networkError instanceof Error ? networkError.message : "fetch failed"}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`SelfClaw returned non-JSON response (status ${res.status})`);
  }

  if (!res.ok && res.status !== 404) {
    console.error("[SelfClaw] agent status error:", res.status, data);
    throw new Error(data.error || data.message || `SelfClaw API error: ${res.status}`);
  }

  return data;
}

/**
 * Get all agents (swarm) owned by a specific human.
 */
export async function getHumanSwarm(
  humanId: string
): Promise<{ agents: AgentVerificationStatus[] }> {
  const res = await fetch(`${SELFCLAW_BASE_URL}/human/${humanId}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `SelfClaw API error: ${res.status}`);
  }

  return data;
}

