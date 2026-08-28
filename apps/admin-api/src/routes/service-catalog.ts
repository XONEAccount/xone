import { Hono } from "hono";
import { z } from "zod";
import { getSupabaseWallet } from "../lib/supabase.js";
import type { AdminAuthVariables } from "../middleware/admin-auth.js";
import { requireAdmin } from "../middleware/admin-auth.js";
import { writeAdminAudit } from "../services/audit.js";

const SELECT =
  "id, list_kind, name, description, url, status, sort_order, created_at, updated_at";

const createSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9_-]*$/i, "id must be alphanumeric / _ / -"),
  listKind: z.enum(["x402", "agent"]),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).default(""),
  url: z.string().url().max(500),
  status: z.enum(["active", "disabled"]).default("active"),
  sortOrder: z.number().int().min(0).max(1_000_000).default(0),
});

const patchSchema = z
  .object({
    listKind: z.enum(["x402", "agent"]).optional(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    url: z.string().url().max(500).optional(),
    status: z.enum(["active", "disabled"]).optional(),
    sortOrder: z.number().int().min(0).max(1_000_000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

export const serviceCatalog = new Hono<{ Variables: AdminAuthVariables }>();

serviceCatalog.use("*", requireAdmin);

/**
 * Lists service catalog rows (X402 List + Agent List).
 */
serviceCatalog.get("/", async (c) => {
  const admin = getSupabaseWallet();
  if (!admin) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const q = (c.req.query("q") ?? "").trim();
  const kind = c.req.query("kind");
  const status = c.req.query("status");
  const limit = Math.min(Number(c.req.query("limit") ?? "50") || 50, 200);
  const offset = Math.max(Number(c.req.query("offset") ?? "0") || 0, 0);

  let query = admin
    .from("service_catalog")
    .select(SELECT, { count: "exact" })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (kind === "x402" || kind === "agent") {
    query = query.eq("list_kind", kind);
  }
  if (status === "active" || status === "disabled") {
    query = query.eq("status", status);
  }
  if (q) {
    query = query.or(
      `id.ilike.%${q}%,name.ilike.%${q}%,description.ilike.%${q}%,url.ilike.%${q}%`,
    );
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

/**
 * Creates a catalog entry.
 */
serviceCatalog.post("/", async (c) => {
  const admin = getSupabaseWallet();
  if (!admin) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      400,
    );
  }

  const body = parsed.data;
  const { data, error } = await admin
    .from("service_catalog")
    .insert({
      id: body.id,
      list_kind: body.listKind,
      name: body.name,
      description: body.description,
      url: body.url,
      status: body.status,
      sort_order: body.sortOrder,
      updated_at: new Date().toISOString(),
    })
    .select(SELECT)
    .single();

  if (error) {
    const status = /duplicate|unique/i.test(error.message) ? 409 : 500;
    return c.json({ error: error.message }, status);
  }

  await writeAdminAudit({
    actor: c.get("admin").sub,
    action: "service_catalog.create",
    targetType: "service_catalog",
    targetId: body.id,
    metadata: { listKind: body.listKind, name: body.name },
  });

  return c.json({ ok: true, item: data }, 201);
});

/**
 * Updates a catalog entry.
 */
serviceCatalog.patch("/:id", async (c) => {
  const admin = getSupabaseWallet();
  if (!admin) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const id = c.req.param("id");
  const parsed = patchSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      400,
    );
  }

  const patch = parsed.data;
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.listKind !== undefined) row.list_kind = patch.listKind;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.url !== undefined) row.url = patch.url;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;

  const { data, error } = await admin
    .from("service_catalog")
    .update(row)
    .eq("id", id)
    .select(SELECT)
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  if (!data) {
    return c.json({ error: "Not found" }, 404);
  }

  await writeAdminAudit({
    actor: c.get("admin").sub,
    action: "service_catalog.patch",
    targetType: "service_catalog",
    targetId: id,
    metadata: patch,
  });

  return c.json({ ok: true, item: data });
});

/**
 * Soft-deletes by setting status=disabled (keeps history for chats that already referenced it).
 */
serviceCatalog.delete("/:id", async (c) => {
  const admin = getSupabaseWallet();
  if (!admin) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const id = c.req.param("id");
  const { data, error } = await admin
    .from("service_catalog")
    .update({
      status: "disabled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(SELECT)
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  if (!data) {
    return c.json({ error: "Not found" }, 404);
  }

  await writeAdminAudit({
    actor: c.get("admin").sub,
    action: "service_catalog.disable",
    targetType: "service_catalog",
    targetId: id,
  });

  return c.json({ ok: true, item: data });
});
