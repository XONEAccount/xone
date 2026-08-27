import { Hono } from "hono";
import { z } from "zod";
import { fetchBaseSepoliaBalances } from "../lib/balances.js";
import { getSupabaseWallet } from "../lib/supabase.js";
import type { AdminAuthVariables } from "../middleware/admin-auth.js";
import { requireAdmin } from "../middleware/admin-auth.js";
import { writeAdminAudit } from "../services/audit.js";

/** Safe agent projection — never includes encrypted_private_key or api_key_hash. */
const AGENT_SELECT =
  "id, owner_wallet, name, description, api_key_prefix, wallet_address, max_amount, max_single_payment, spent_amount, allowance_eth, asset, chain, status, created_at, updated_at";

const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    status: z.enum(["active", "disabled"]).optional(),
    maxAmount: z.number().positive().optional(),
    maxSinglePayment: z.number().positive().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

/**
 * SHA-256 hex digest via Web Crypto (Workers-safe).
 * @param value - Input string
 * @returns Hex digest
 */
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generates a random hex token for key revocation.
 * @param bytes - Number of random bytes
 * @returns Hex string
 */
function randomHex(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const agents = new Hono<{ Variables: AdminAuthVariables }>();

agents.use("*", requireAdmin);

/**
 * Lists developer agents without secrets.
 */
agents.get("/", async (c) => {
  const admin = getSupabaseWallet();
  if (!admin) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const q = (c.req.query("q") ?? "").trim();
  const status = c.req.query("status");
  const limit = Math.min(Number(c.req.query("limit") ?? "50") || 50, 200);
  const offset = Math.max(Number(c.req.query("offset") ?? "0") || 0, 0);

  let query = admin
    .from("developer_agents")
    .select(AGENT_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status === "active" || status === "disabled") {
    query = query.eq("status", status);
  }

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,wallet_address.ilike.%${q}%,owner_wallet.ilike.%${q}%,api_key_prefix.ilike.%${q}%`,
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
 * Agent detail: policy fields, on-chain balances, payments, fundings.
 * Never returns sealed key material.
 */
agents.get("/:id", async (c) => {
  const admin = getSupabaseWallet();
  if (!admin) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const id = c.req.param("id");
  const historyLimit = Math.min(Number(c.req.query("limit") ?? "50") || 50, 100);

  const { data, error } = await admin
    .from("developer_agents")
    .select(AGENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  if (!data) {
    return c.json({ error: "Agent not found" }, 404);
  }

  const owner = String(data.owner_wallet ?? "").toLowerCase();
  const wallet = String(data.wallet_address ?? "");

  const [onChain, paymentsRes, fundingsRes, ownerProfileRes, a2aSettingsRes] =
    await Promise.all([
      fetchBaseSepoliaBalances(wallet),
      admin
        .from("agent_payments")
        .select(
          "id, agent_id, amount, asset, chain, recipient, merchant, resource, status, provider, failure_reason, idempotency_key, created_at",
        )
        .eq("agent_id", id)
        .order("created_at", { ascending: false })
        .limit(historyLimit),
      admin
        .from("agent_fundings")
        .select("id, agent_id, tx_hash, from_address, amount, created_at")
        .eq("agent_id", id)
        .order("created_at", { ascending: false })
        .limit(historyLimit),
      owner
        ? admin
            .from("profiles")
            .select("wallet_address, display_name, created_at, updated_at")
            .eq("wallet_address", owner)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      admin
        .from("a2a_agent_settings")
        .select(
          "agent_id, wallet_address, enabled, max_amount, max_single_payment, spent_amount",
        )
        .eq("agent_id", id)
        .maybeSingle(),
    ]);

  const payments = paymentsRes.error ? [] : (paymentsRes.data ?? []);
  const fundings = fundingsRes.error ? [] : (fundingsRes.data ?? []);

  return c.json({
    ok: true,
    item: {
      ...data,
      on_chain: onChain,
      owner_profile: ownerProfileRes.error ? null : (ownerProfileRes.data ?? null),
      a2a_settings: a2aSettingsRes.error ? null : (a2aSettingsRes.data ?? null),
      stats: {
        payments: payments.length,
        fundings: fundings.length,
      },
    },
    recent: {
      payments,
      fundings,
    },
  });
});

/**
 * Updates agent policy fields / status. Never returns private keys.
 */
agents.patch("/:id", async (c) => {
  const admin = getSupabaseWallet();
  if (!admin) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
  }

  const patch = parsed.data;
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.maxAmount !== undefined) update.max_amount = patch.maxAmount;
  if (patch.maxSinglePayment !== undefined) {
    update.max_single_payment = patch.maxSinglePayment;
  }

  if (
    patch.maxAmount !== undefined &&
    patch.maxSinglePayment !== undefined &&
    patch.maxSinglePayment > patch.maxAmount
  ) {
    return c.json({ error: "maxSinglePayment cannot exceed maxAmount" }, 400);
  }

  const { data, error } = await admin
    .from("developer_agents")
    .update(update)
    .eq("id", id)
    .select(AGENT_SELECT)
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  if (!data) {
    return c.json({ error: "Agent not found" }, 404);
  }

  await writeAdminAudit(
    {
      actor: c.get("admin").sub,
      action: "agent.update",
      targetType: "developer_agent",
      targetId: id,
      metadata: patch,
    },
    admin,
  );

  return c.json({ ok: true, item: data });
});

/**
 * Invalidates the current API key without issuing a replacement to the admin UI.
 */
agents.post("/:id/revoke-key", async (c) => {
  const admin = getSupabaseWallet();
  if (!admin) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const id = c.req.param("id");
  const apiKeyHash = await sha256Hex(randomHex(32));

  const { data, error } = await admin
    .from("developer_agents")
    .update({
      api_key_hash: apiKeyHash,
      api_key_prefix: "revoked",
      status: "disabled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(AGENT_SELECT)
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  if (!data) {
    return c.json({ error: "Agent not found" }, 404);
  }

  await writeAdminAudit(
    {
      actor: c.get("admin").sub,
      action: "agent.revoke_key",
      targetType: "developer_agent",
      targetId: id,
      metadata: { status: "disabled" },
    },
    admin,
  );

  return c.json({ ok: true, item: data });
});
