/**
 * Ed25519 key management for SelfClaw verification.
 *
 * Generates an Ed25519 key pair per agent, stores the private key
 * encrypted (AES-256-GCM), and signs challenges server-side.
 */

import * as ed from "@noble/ed25519";
import { randomBytes } from "crypto";
import { encrypt, decrypt } from "@/lib/crypto";

/**
 * Generate a new Ed25519 key pair.
 * Returns { publicKey (SPKI base64), privateKey (hex) }.
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKeyHex: string;
}> {
  // Generate 32-byte random private key
  const privateKey = ed.utils.randomSecretKey
    ? ed.utils.randomSecretKey()
    : randomBytes(32);
  const publicKeyRaw = await ed.getPublicKeyAsync(privateKey);

  // Convert raw 32-byte public key to SPKI DER format
  // SPKI header for Ed25519: 302a300506032b6570032100 (12 bytes)
  const spkiHeader = Buffer.from("302a300506032b6570032100", "hex");
  const spkiDer = Buffer.concat([spkiHeader, Buffer.from(publicKeyRaw)]);

  return {
    publicKey: spkiDer.toString("base64"),
    privateKeyHex: Buffer.from(privateKey).toString("hex"),
  };
}

/**
 * Sign a message with an Ed25519 private key.
 * Returns the signature as hex string.
 */
export async function signMessage(
  message: string,
  privateKeyHex: string
): Promise<string> {
  const privateKey = Buffer.from(privateKeyHex, "hex");
  const messageBytes = new TextEncoder().encode(message);
  const signature = await ed.signAsync(messageBytes, privateKey);
  return Buffer.from(signature).toString("hex");
}

/**
 * Encrypt a private key for database storage.
 */
export function encryptPrivateKey(privateKeyHex: string): string {
  return encrypt(privateKeyHex);
}

/**
 * Decrypt a private key from database storage.
 */
export function decryptPrivateKey(encryptedKey: string): string {
  return decrypt(encryptedKey);
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

