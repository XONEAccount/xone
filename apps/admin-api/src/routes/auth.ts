import { Hono } from "hono";
import { z } from "zod";
import { signAdminToken, verifyAdminCredentials } from "../lib/auth.js";
import { getEnv } from "../lib/env.js";
import type { AdminAuthVariables } from "../middleware/admin-auth.js";
import { requireAdmin } from "../middleware/admin-auth.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const auth = new Hono<{ Variables: AdminAuthVariables }>();

/**
 * Admin username + password login → session JWT.
 */
auth.post("/login", async (c) => {
  const env = getEnv();
  if (!env.adminUsername || !env.adminPassword || !env.adminJwtSecret) {
    return c.json({ error: "Admin auth is not configured" }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const { username, password } = parsed.data;
  if (!verifyAdminCredentials(username, password)) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await signAdminToken(username);
  return c.json({
    ok: true,
    token,
    expiresIn: "12h",
  });
});

auth.get("/me", requireAdmin, async (c) => {
  const admin = c.get("admin");
  return c.json({ ok: true, admin });
});
