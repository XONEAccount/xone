import { Hono } from "hono";
import {
  a2aFundSchema,
  a2aSettleSchema,
  a2aUpdateAgentSchema,
} from "@xone/schemas";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { getSupabaseAdmin } from "../lib/supabase.js";
import {
  fundA2AAccount,
  getA2AAccount,
  settleA2APayment,
  updateA2AAgentSettings,
} from "../services/a2a/account.js";

const a2a = new Hono<{ Variables: AuthVariables }>();

a2a.use("*", requireAuth);

/**
 * GET /api/a2a/account?address=0x...
 */
a2a.get("/account", async (c) => {
  const address = c.req.query("address");
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return c.json({ error: "Valid address query param required" }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    const account = await getA2AAccount(admin, address);
    return c.json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed";
    console.error("[a2a] get account", error);
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /api/a2a/fund — credit A2A balance from wallet (demo internal).
 */
a2a.post("/fund", async (c) => {
  const parsed = a2aFundSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid fund payload", details: parsed.error.flatten() }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    const account = await fundA2AAccount(admin, parsed.data.address, parsed.data.amount);
    return c.json({ ok: true, account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fund failed";
    console.error("[a2a] fund", error);
    return c.json({ error: message }, 400);
  }
});

/**
 * PATCH /api/a2a/agents/:agentId
 */
a2a.patch("/agents/:agentId", async (c) => {
  const parsed = a2aUpdateAgentSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid agent payload", details: parsed.error.flatten() }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    const account = await updateA2AAgentSettings(
      admin,
      parsed.data.address,
      c.req.param("agentId"),
      {
        enabled: parsed.data.enabled,
        maxAmount: parsed.data.maxAmount,
        maxSinglePayment: parsed.data.maxSinglePayment,
      },
    );
    return c.json({ ok: true, account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    console.error("[a2a] update agent", error);
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /api/a2a/settle — pay an agent from A2A balance.
 */
a2a.post("/settle", async (c) => {
  const parsed = a2aSettleSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid settle payload", details: parsed.error.flatten() }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    const result = await settleA2APayment(
      admin,
      parsed.data.address,
      parsed.data.agentId,
      parsed.data.amount,
      parsed.data.title,
    );
    return c.json(result, result.ok ? 200 : 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Settle failed";
    console.error("[a2a] settle", error);
    return c.json({ error: message }, 500);
  }
});

export { a2a };
