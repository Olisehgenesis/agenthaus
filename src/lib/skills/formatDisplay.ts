/**
 * Markdown formatting helpers for skill display output.
 * Ensures consistent, chat-friendly formatting across all handlers.
 */

/** Format a truncated address for display (wrap in backticks for code styling) */
export function fmtAddr(addr: string, prefixLen = 6, suffixLen = 4): string {
  if (!addr || addr.length < prefixLen + suffixLen) return addr;
  return `\`${addr.slice(0, prefixLen)}...${addr.slice(-suffixLen)}\``;
}

/** Format a full address/hash (wrap in backticks) */
export function fmtHash(hash: string): string {
  if (!hash) return hash;
  return `\`${hash}\``;
}

/** Format a section header (bold, with optional emoji) */
export function fmtHeader(title: string, emoji?: string): string {
  return emoji ? `## ${emoji} ${title}` : `## ${title}`;
}

/** Format a sub-section (bold label) */
export function fmtSection(label: string): string {
  return `**${label}**`;
}

/** Format a bullet list item */
export function fmtBullet(text: string): string {
  return `- ${text}`;
}

/** Format italic/meta text */
export function fmtMeta(text: string): string {
  return `_${text}_`;
}

/** Format inline code (e.g. for skill tags) */
export function fmtCode(text: string): string {
  return `\`${text}\``;
}
