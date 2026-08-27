import { Hono } from "hono";
import { z } from "zod";
import { isAddress } from "viem/utils";
import { signAdminToken } from "../lib/auth.js";
import { getEnv } from "../lib/env.js";
import {
  createWalletChallenge,
  hasAdminAllowlist,
  verifyWalletLogin,
} from "../lib/wallet-auth.js";
import type { AdminAuthVariables } from "../middleware/admin-auth.js";
import { requireAdmin } from "../middleware/admin-auth.js";

const loginSchema = z.object({
  address: z.string().min(1),
  message: z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

export const auth = new Hono<{ Variables: AdminAuthVariables }>();

/**
 * Issues a nonce challenge for the wallet to sign (no allowlist leak).
 */
auth.get("/challenge", async (c) => {
  const env = getEnv();
  if (!env.adminJwtSecret) {
    return c.json({ error: "Admin auth is not configured" }, 503);
  }
  if (!(await hasAdminAllowlist())) {
    return c.json({ error: "Admin wallet allowlist is empty" }, 503);
  }

  const address = (c.req.query("address") ?? "").trim();
  if (!isAddress(address)) {
    return c.json({ error: "Valid address query param required" }, 400);
  }

  const challenge = createWalletChallenge(address);
  return c.json({ ok: true, ...challenge });
});

/**
 * Verifies wallet signature → admin session JWT (SIWE-lite).
 */
auth.post("/login", async (c) => {
  const env = getEnv();
  if (!env.adminJwtSecret) {
    return c.json({ error: "Admin auth is not configured" }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  try {
    const address = await verifyWalletLogin({
      address: parsed.data.address,
      message: parsed.data.message,
      signature: parsed.data.signature as `0x${string}`,
    });
    const token = await signAdminToken(address);
    return c.json({
      ok: true,
      token,
      address,
      expiresIn: "12h",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    const status = message.includes("not authorized") ? 403 : 401;
    return c.json({ error: message }, status);
  }
});

auth.get("/me", requireAdmin, async (c) => {
  const admin = c.get("admin");
  return c.json({ ok: true, admin });
});
