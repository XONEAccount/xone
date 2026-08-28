import { Hono } from "hono";
import { getSupabaseAdmin } from "../lib/supabase.js";

const SELECT =
  "id, list_kind, name, description, url, status, sort_order, created_at, updated_at";

/**
 * Public (wallet app) service catalog — active rows for X402 List / Agent List.
 */
export const serviceCatalog = new Hono();

/**
 * GET /api/service-catalog?kind=x402|agent
 * Returns active platform services. Client merges with per-user enable toggles.
 */
serviceCatalog.get("/", async (c) => {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return c.json({ error: "Database not configured" }, 503);
  }

  const kind = c.req.query("kind");
  let query = admin
    .from("service_catalog")
    .select(SELECT)
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(200);

  if (kind === "x402" || kind === "agent") {
    query = query.eq("list_kind", kind);
  }

  const { data, error } = await query;
  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    ok: true,
    items: (data ?? []).map((row) => ({
      id: row.id,
      listKind: row.list_kind,
      name: row.name,
      description: row.description,
      url: row.url,
      status: row.status,
      sortOrder: row.sort_order,
    })),
  });
});
