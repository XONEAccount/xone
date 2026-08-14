import { Hono } from "hono";
import { getSupabaseAdmin } from "../lib/supabase.js";
import type { AdminAuthVariables } from "../middleware/admin-auth.js";
import { requireAdmin } from "../middleware/admin-auth.js";

export const audit = new Hono<{ Variables: AdminAuthVariables }>();

audit.use("*", requireAdmin);

/**
 * Lists admin console audit events.
 */
audit.get("/", async (c) => {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const limit = Math.min(Number(c.req.query("limit") ?? "50") || 50, 200);
  const offset = Math.max(Number(c.req.query("offset") ?? "0") || 0, 0);

  const { data, error, count } = await admin
    .from("admin_audit_logs")
    .select("id, actor, action, target_type, target_id, metadata, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

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
