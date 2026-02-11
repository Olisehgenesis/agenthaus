/**
 * Resolve ipfs:// URLs for READING only.
 * Uses public gateway (ipfs.io) — NOT Pinata/dedicated gateway.
 * Pinning uses Pinata (JWT + client) in ipfs.ts; reading uses this.
 */

const PUBLIC_GATEWAY = "https://ipfs.io";

/**
 * Convert ipfs:// CID URI to HTTPS public gateway URL.
 * Use this for displaying images or fetching content — do NOT use dedicated gateways.
 */
export function ipfsToPublicGatewayUrl(url: string): string {
  if (!url || !url.startsWith("ipfs://")) return url;
  const cid = url.replace("ipfs://", "").split("/")[0];
  return `${PUBLIC_GATEWAY}/ipfs/${cid}`;
}
