import type { Context, Next } from "hono";
import { verifyAdminToken, type AdminSession } from "../lib/auth.js";

export type AdminAuthVariables = {
  admin: AdminSession;
};

/**
 * Requires a valid admin Bearer JWT on protected routes.
 * @param c - Hono context
 * @param next - Next middleware
 */
export async function requireAdmin(
  c: Context<{ Variables: AdminAuthVariables }>,
  next: Next,
) {
  const header = c.req.header("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const session = await verifyAdminToken(match[1]);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("admin", session);
  await next();
}
