/**
 * Marker strings for inline widgets.
 * Kept in a separate file so client components can import it without
 * pulling in server-only deps (pg, prisma, etc.) from handlers.ts.
 */
export const FEEDBACK_INLINE_MARKER = "__FEEDBACK_INLINE__";
export const REGISTER_ERC8004_INLINE_MARKER = "__REGISTER_ERC8004_INLINE__";
