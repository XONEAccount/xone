import type { Context } from "hono";

/**
 * Parses `limit` / `offset` list query params.
 * @param c - Hono context
 * @returns Clamped page window
 */
export function parsePage(c: Context): { limit: number; offset: number } {
  const limit = Math.min(Number(c.req.query("limit") ?? "50") || 50, 200);
  const offset = Math.max(Number(c.req.query("offset") ?? "0") || 0, 0);
  return { limit, offset };
}
