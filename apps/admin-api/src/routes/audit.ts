import { Hono } from "hono";
import { parsePage } from "../lib/pagination.js";
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

  const { limit, offset } = parsePage(c);
  const q = (c.req.query("q") ?? "").trim();

  let query = admin
    .from("admin_audit_logs")
    .select("id, actor, action, target_type, target_id, metadata, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.or(
      `actor.ilike.%${q}%,action.ilike.%${q}%,target_type.ilike.%${q}%,target_id.ilike.%${q}%`,
    );
  }

  const { data, error, count } = await query;

  if (error) {
    const missing = /admin_audit_logs|schema cache/i.test(error.message);
    return c.json(
      {
        error: missing
          ? "Missing table public.admin_audit_logs — apply supabase/migrations/20260812000000_admin_audit_logs.sql"
          : error.message,
      },
      missing ? 503 : 500,
    );
  }

  return c.json({
    ok: true,
    items: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
});
