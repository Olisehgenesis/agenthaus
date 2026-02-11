/**
 * Authenticated SelfClaw API requests
 *
 * Economy endpoints (create-wallet, deploy-token, log-revenue, etc.) require
 * signing: JSON.stringify({ agentPublicKey, timestamp, nonce }) with Ed25519.
 * Key order must be: agentPublicKey, timestamp, nonce.
 */

import { randomBytes } from "crypto";
import { signMessage } from "./keys";

export interface SignedPayload {
  agentPublicKey: string;
  timestamp: number;
  nonce: string;
  signature: string;
}

/**
 * Create a signed payload for authenticated SelfClaw requests.
 */
export async function signAuthenticatedPayload(
  agentPublicKey: string,
  privateKeyHex: string
): Promise<SignedPayload> {
  const timestamp = Date.now();
  const nonce = randomBytes(16).toString("hex");
  const messageToSign = JSON.stringify({ agentPublicKey, timestamp, nonce });
  const signature = await signMessage(messageToSign, privateKeyHex);
  return { agentPublicKey, timestamp, nonce, signature };
}
