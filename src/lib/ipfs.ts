/**
 * IPFS pinning via Pinata (dedicated gateway, JWT, Pinata client).
 * Use this for UPLOADING: registration JSON, agent images.
 * For READING ipfs:// URIs, use ipfsToPublicGatewayUrl() from ipfs-url.ts (public gateway).
 */

import { PinataSDK } from "pinata";

function getPinata() {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT is not set. Add it to .env for IPFS uploads.");
  return new PinataSDK({ pinataJwt: jwt });
}

/**
 * Upload JSON to IPFS and return ipfs:// CID URI.
 */
export async function uploadJsonToIPFS(json: unknown): Promise<string> {
  const pinata = getPinata();
  const blob = new Blob([JSON.stringify(json, null, 2)], {
    type: "application/json",
  });
  const file = new File([blob], "registration.json", { type: "application/json" });
  const upload = await pinata.upload.public.file(file);
  return `ipfs://${upload.cid}`;
}

/**
 * Upload an image file to IPFS.
 */
export async function uploadImageToIPFS(file: File): Promise<string> {
  const pinata = getPinata();
  const upload = await pinata.upload.public.file(file);
  return `ipfs://${upload.cid}`;
}

/**
 * Check if Pinata is configured.
 */
export function isPinataConfigured(): boolean {
  return !!process.env.PINATA_JWT;
}
