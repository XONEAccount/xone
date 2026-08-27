import { Hono } from "hono";
import { parsePage } from "../lib/pagination.js";
import { getSupabaseConsole, getSupabaseWallet } from "../lib/supabase.js";
import type { AdminAuthVariables } from "../middleware/admin-auth.js";
import { requireAdmin } from "../middleware/admin-auth.js";

export const audit = new Hono<{ Variables: AdminAuthVariables }>();

audit.use("*", requireAdmin);

type AuditRow = {
  id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/**
 * Lists admin console audit events (console DB, fallback wallet DB).
 */
audit.get("/", async (c) => {
  const { limit, offset } = parsePage(c);
  const q = (c.req.query("q") ?? "").trim();

  const clients = [getSupabaseConsole(), getSupabaseWallet()].filter(
    (client, index, arr): client is NonNullable<typeof client> =>
      Boolean(client) && arr.indexOf(client) === index,
  );

  if (clients.length === 0) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  let lastError: string | null = null;

  for (const admin of clients) {
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
    if (!error) {
      return c.json({
        ok: true,
        items: (data ?? []) as AuditRow[],
        total: count ?? 0,
        limit,
        offset,
      });
    }

    lastError = error.message;
    if (/admin_audit_logs|schema cache/i.test(error.message)) {
      continue;
    }
    return c.json({ error: error.message }, 500);
  }

  // Table missing on all projects — empty list instead of hard failure.
  console.error("[admin-audit]", lastError);
  return c.json({
    ok: true,
    items: [] as AuditRow[],
    total: 0,
    limit,
    offset,
    warning:
      "Missing table public.admin_audit_logs — apply supabase/migrations/20260812000000_admin_audit_logs.sql on console and/or wallet Supabase",
  });
});
