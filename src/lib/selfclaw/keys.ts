/**
 * Ed25519 key management for SelfClaw verification.
 *
 * Generates an Ed25519 key pair per agent, stores the private key
 * encrypted (AES-256-GCM), and signs challenges server-side.
 *
 * Uses @noble/ed25519 v3 which requires SHA-512 via Web Crypto API
 * (available in Node.js 18+) or explicit configuration.
 */

import * as ed from "@noble/ed25519";
import { randomBytes, createHash } from "crypto";
import { encrypt, decrypt } from "@/lib/crypto";

// ─── Ensure SHA-512 is available for @noble/ed25519 v3 ────────────────────
// Belt-and-suspenders: if globalThis.crypto.subtle isn't available,
// fall back to Node.js crypto. This ensures signing works in all environments.
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto?.subtle) {
  // Node.js < 19 or edge runtime without Web Crypto — provide SHA-512 manually
  // The sha512Sync property exists at runtime but isn't in the type defs for some versions
  (ed.etc as Record<string, unknown>).sha512Sync = (...messages: Uint8Array[]) => {
    const hash = createHash("sha512");
    for (const m of messages) hash.update(m);
    return new Uint8Array(hash.digest());
  };
  console.log("[SelfClaw/keys] SHA-512 configured via Node.js crypto (fallback)");
}

/**
 * Generate a new Ed25519 key pair.
 * Returns { publicKey (SPKI base64), privateKey (hex) }.
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKeyHex: string;
}> {
  // Generate 32-byte random private key seed
  const privateKey = randomBytes(32);
  const publicKeyRaw = await ed.getPublicKeyAsync(privateKey);

  // Convert raw 32-byte public key to SPKI DER format
  // SPKI header for Ed25519: 302a300506032b6570032100 (12 bytes)
  const spkiHeader = Buffer.from("302a300506032b6570032100", "hex");
  const spkiDer = Buffer.concat([spkiHeader, Buffer.from(publicKeyRaw)]);

  const publicKey = spkiDer.toString("base64");
  const privateKeyHex = Buffer.from(privateKey).toString("hex");

  console.log(
    `[SelfClaw/keys] Generated Ed25519 key pair — pubKey: ${publicKey.slice(0, 20)}... (${spkiDer.length} bytes SPKI)`
  );

  return { publicKey, privateKeyHex };
}

/**
 * Sign a message with an Ed25519 private key.
 * Returns the signature as hex string (128 hex chars = 64 bytes).
 *
 * CRITICAL: The `message` parameter must be the EXACT challenge string
 * returned by SelfClaw /start-verification — byte for byte.
 */
export async function signMessage(
  message: string,
  privateKeyHex: string
): Promise<string> {
  const privateKey = Buffer.from(privateKeyHex, "hex");
  const messageBytes = new TextEncoder().encode(message);
  const signature = await ed.signAsync(messageBytes, privateKey);
  const signatureHex = Buffer.from(signature).toString("hex");

  console.log(
    `[SelfClaw/keys] Signed challenge (${messageBytes.length} bytes) → sig: ${signatureHex.slice(0, 16)}... (${signatureHex.length} hex chars / ${signature.length} bytes)`
  );

  // Sanity check: Ed25519 signatures must be exactly 64 bytes
  if (signature.length !== 64) {
    throw new Error(
      `Ed25519 signature has wrong length: ${signature.length} bytes (expected 64)`
    );
  }

  return signatureHex;
}

/**
 * Encrypt a private key for database storage.
 */
export function encryptPrivateKey(privateKeyHex: string): string {
  return encrypt(privateKeyHex);
}

/**
 * Decrypt a private key from database storage.
 * Throws a user-friendly error if decryption fails (e.g. ENCRYPTION_SECRET changed).
 */
export function decryptPrivateKey(encryptedKey: string): string {
  try {
    return decrypt(encryptedKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unsupported state") || msg.includes("authenticate data") || msg.includes("Invalid")) {
      throw new Error(
        "Verification keys could not be decrypted. If you changed ENCRYPTION_SECRET, re-verify the agent: click Verify → Scan QR to regenerate keys."
      );
    }
    throw err;
  }
}

/**
 * Convert an SPKI base64 public key to raw 32-byte hex.
 * Useful for comparison / hashing.
 */
export function spkiToRawHex(spkiBase64: string): string {
  const spkiDer = Buffer.from(spkiBase64, "base64");
  // Last 32 bytes are the raw public key
  const rawKey = spkiDer.subarray(-32);
  return rawKey.toString("hex");
}

/**
 * Verify an Ed25519 signature.
 */
export async function verifySignature(
  message: string,
  signature: string,
  publicKeySpkiBase64: string
): Promise<boolean> {
  const rawKey = Buffer.from(spkiToRawHex(publicKeySpkiBase64), "hex");
  const messageBytes = new TextEncoder().encode(message);
  const sigBytes = Buffer.from(signature, "hex");

  return ed.verifyAsync(sigBytes, messageBytes, rawKey);
}

