import { Hono } from "hono";
import { getSupabaseAdmin } from "../lib/supabase.js";
import type { AdminAuthVariables } from "../middleware/admin-auth.js";
import { requireAdmin } from "../middleware/admin-auth.js";

export const fundings = new Hono<{ Variables: AdminAuthVariables }>();

fundings.use("*", requireAdmin);

/**
 * Lists agent wallet funding events.
 */
fundings.get("/", async (c) => {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const agentId = c.req.query("agent_id");
  const limit = Math.min(Number(c.req.query("limit") ?? "50") || 50, 200);
  const offset = Math.max(Number(c.req.query("offset") ?? "0") || 0, 0);

  let query = admin
    .from("agent_fundings")
    .select("id, agent_id, tx_hash, from_address, amount, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (agentId) {
    query = query.eq("agent_id", agentId);
  }

  const { data, error, count } = await query;
  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    ok: true,
    items: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
});
