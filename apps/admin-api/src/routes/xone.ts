import { Hono, type Context } from "hono";
import { z } from "zod";
import { fetchBaseSepoliaBalances } from "../lib/balances.js";
import { parsePage } from "../lib/pagination.js";
import { getSupabaseAdmin } from "../lib/supabase.js";
import type { AdminAuthVariables } from "../middleware/admin-auth.js";
import { requireAdmin } from "../middleware/admin-auth.js";
import { writeAdminAudit } from "../services/audit.js";

type XoneContext = Context<{ Variables: AdminAuthVariables }>;

/** Safe agent projection — never includes wallet_private_key_enc.
 * Omit allowlist columns: older console DBs may lack allowed_hosts / allowed_payees.
 */
const XONE_AGENT_SELECT =
  "id, user_id, api_key_id, name, chain, currency, default_amount, daily_limit, per_transaction, remaining_daily, daily_period, wallet_address, wallet_family, status, created_at, updated_at";

/** Safe API key projection — never includes token_hash. */
const XONE_KEY_SELECT =
  "id, user_id, name, token_prefix, status, created_at";

const limitsSchema = z
  .object({
    dailyLimit: z.number().positive().optional(),
    perTransaction: z.number().positive().optional(),
  })
  .refine((v) => v.dailyLimit !== undefined || v.perTransaction !== undefined, {
    message: "At least one limit field is required",
  });

export const xone = new Hono<{ Variables: AdminAuthVariables }>();

xone.use("*", requireAdmin);

/**
 * Lists console operator profiles.
 */
xone.get("/profiles", async (c) => {
  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Supabase is not configured" }, 503);

  const q = (c.req.query("q") ?? "").trim();
  const { limit, offset } = parsePage(c);

  let query = admin
    .from("xone_profiles")
    .select("id, email, name, avatar_url, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ ok: true, items: data ?? [], total: count ?? 0, limit, offset });
});

/**
 * Console user detail: profile, API keys, agent wallets, recent ledger.
 */
xone.get("/profiles/:id", async (c) => {
  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Supabase is not configured" }, 503);

  const id = c.req.param("id");
  const historyLimit = Math.min(Number(c.req.query("limit") ?? "50") || 50, 100);

  const { data, error } = await admin
    .from("xone_profiles")
    .select("id, email, name, avatar_url, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: "Profile not found" }, 404);

  const [keysRes, agentsRes, historyRes] = await Promise.all([
    admin
      .from("xone_api_keys")
      .select(XONE_KEY_SELECT)
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("xone_agents")
      .select(XONE_AGENT_SELECT)
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("xone_agent_history")
      .select(
        "id, agent_id, user_id, type, amount, currency, to_address, url, tx_hash, meta, created_at",
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(historyLimit),
  ]);

  const keys = keysRes.error ? [] : (keysRes.data ?? []);
  const agents = agentsRes.error ? [] : (agentsRes.data ?? []);
  const history = historyRes.error ? [] : (historyRes.data ?? []);

  const agentBalances = await Promise.all(
    agents.slice(0, 20).map(async (agent) => {
      const balances = await fetchBaseSepoliaBalances(String(agent.wallet_address ?? ""));
      return [String(agent.id), balances] as const;
    }),
  );
  const onChainByAgent = Object.fromEntries(agentBalances);

  return c.json({
    ok: true,
    item: {
      ...data,
      stats: {
        keys: keys.length,
        keys_active: keys.filter((k) => k.status === "active").length,
        agents: agents.length,
        agents_active: agents.filter((a) => a.status === "active").length,
        history: history.length,
      },
    },
    keys,
    agents: agents.map((agent) => ({
      ...agent,
      on_chain: onChainByAgent[String(agent.id)] ?? [],
    })),
    recent: {
      history,
    },
  });
});

/**
 * Lists API keys without secrets.
 */
xone.get("/api-keys", async (c) => {
  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Supabase is not configured" }, 503);

  const q = (c.req.query("q") ?? "").trim();
  const status = c.req.query("status");
  const userId = (c.req.query("user_id") ?? "").trim();
  const { limit, offset } = parsePage(c);

  let query = admin
    .from("xone_api_keys")
    .select(XONE_KEY_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status === "active" || status === "deleted") {
    query = query.eq("status", status);
  }
  if (userId) query = query.eq("user_id", userId);
  if (q) {
    query = query.or(`name.ilike.%${q}%,token_prefix.ilike.%${q}%,id.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ ok: true, items: data ?? [], total: count ?? 0, limit, offset });
});

/**
 * API key detail: owner profile, linked agent wallet, recent spend history.
 * Never returns token_hash / full secret.
 */
xone.get("/api-keys/:id", async (c) => {
  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Supabase is not configured" }, 503);

  const id = c.req.param("id");
  const historyLimit = Math.min(Number(c.req.query("limit") ?? "50") || 50, 100);

  const { data, error } = await admin
    .from("xone_api_keys")
    .select(XONE_KEY_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: "API key not found" }, 404);

  const userId = String(data.user_id ?? "");

  const [profileRes, agentRes] = await Promise.all([
    userId
      ? admin
          .from("xone_profiles")
          .select("id, email, name, avatar_url, created_at")
          .eq("id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from("xone_agents")
      .select(XONE_AGENT_SELECT)
      .eq("api_key_id", id)
      .maybeSingle(),
  ]);

  const agent = agentRes.error ? null : (agentRes.data ?? null);
  let onChain: Awaited<ReturnType<typeof fetchBaseSepoliaBalances>> = [];
  let history: unknown[] = [];
  let payIntents: unknown[] = [];

  if (agent) {
    const agentId = String(agent.id);
    const [balances, historyRes, intentsRes] = await Promise.all([
      fetchBaseSepoliaBalances(String(agent.wallet_address ?? "")),
      admin
        .from("xone_agent_history")
        .select(
          "id, agent_id, user_id, type, amount, currency, to_address, url, tx_hash, meta, created_at",
        )
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(historyLimit),
      admin
        .from("xone_pay_intents")
        .select(
          "id, agent_id, idempotency_key, url, status, max_amount, error_message, created_at, updated_at",
        )
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(historyLimit),
    ]);
    onChain = balances;
    history = historyRes.error ? [] : (historyRes.data ?? []);
    payIntents = intentsRes.error ? [] : (intentsRes.data ?? []);
  }

  return c.json({
    ok: true,
    item: {
      ...data,
      owner_profile: profileRes.error ? null : (profileRes.data ?? null),
      agent: agent
        ? {
            ...agent,
            on_chain: onChain,
          }
        : null,
      stats: {
        history: history.length,
        pay_intents: payIntents.length,
      },
    },
    recent: {
      history,
      pay_intents: payIntents,
    },
  });
});

/**
 * Soft-deletes an API key (ops emergency revoke).
 */
xone.post("/api-keys/:id/revoke", async (c) => {
  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Supabase is not configured" }, 503);

  const id = c.req.param("id");
  const { data, error } = await admin
    .from("xone_api_keys")
    .update({ status: "deleted" })
    .eq("id", id)
    .select(XONE_KEY_SELECT)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: "API key not found" }, 404);

  await writeAdminAudit(
    {
      actor: c.get("admin").sub,
      action: "xone.api_key.revoke",
      targetType: "xone_api_key",
      targetId: id,
    },
    admin,
  );

  return c.json({ ok: true, item: data });
});

/**
 * Lists XOne agent wallets without sealed keys.
 */
xone.get("/agents", async (c) => {
  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Supabase is not configured" }, 503);

  const q = (c.req.query("q") ?? "").trim();
  const status = c.req.query("status");
  const userId = (c.req.query("user_id") ?? "").trim();
  const { limit, offset } = parsePage(c);

  let query = admin
    .from("xone_agents")
    .select(XONE_AGENT_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (
    status === "active" ||
    status === "paused" ||
    status === "exhausted" ||
    status === "deleted"
  ) {
    query = query.eq("status", status);
  }
  if (userId) query = query.eq("user_id", userId);
  if (q) {
    query = query.or(
      `name.ilike.%${q}%,wallet_address.ilike.%${q}%,id.ilike.%${q}%,api_key_id.ilike.%${q}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ ok: true, items: data ?? [], total: count ?? 0, limit, offset });
});

/**
 * Agent detail: policy, on-chain balances, owner, key, and recent history.
 * Never returns sealed key material.
 */
xone.get("/agents/:id", async (c) => {
  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Supabase is not configured" }, 503);

  const id = c.req.param("id");
  const historyLimit = Math.min(Number(c.req.query("limit") ?? "50") || 50, 100);

  const { data, error } = await admin
    .from("xone_agents")
    .select(XONE_AGENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: "Agent not found" }, 404);

  const userId = String(data.user_id ?? "");
  const apiKeyId = String(data.api_key_id ?? "");
  const wallet = String(data.wallet_address ?? "");

  const [onChain, historyRes, intentsRes, profileRes, keyRes] = await Promise.all([
    fetchBaseSepoliaBalances(wallet),
    admin
      .from("xone_agent_history")
      .select(
        "id, agent_id, user_id, type, amount, currency, to_address, url, tx_hash, meta, created_at",
      )
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(historyLimit),
    admin
      .from("xone_pay_intents")
      .select(
        "id, agent_id, idempotency_key, url, status, max_amount, error_message, created_at, updated_at",
      )
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(historyLimit),
    userId
      ? admin
          .from("xone_profiles")
          .select("id, email, name, avatar_url, created_at")
          .eq("id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    apiKeyId
      ? admin
          .from("xone_api_keys")
          .select(XONE_KEY_SELECT)
          .eq("id", apiKeyId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const history = historyRes.error ? [] : (historyRes.data ?? []);
  const payIntents = intentsRes.error ? [] : (intentsRes.data ?? []);

  return c.json({
    ok: true,
    item: {
      ...data,
      on_chain: onChain,
      owner_profile: profileRes.error ? null : (profileRes.data ?? null),
      api_key: keyRes.error ? null : (keyRes.data ?? null),
      stats: {
        history: history.length,
        pay_intents: payIntents.length,
      },
    },
    recent: {
      history,
      pay_intents: payIntents,
    },
  });
});

/**
 * Pauses spend on an agent wallet.
 */
xone.post("/agents/:id/pause", async (c) => {
  return setXoneAgentStatus(c, "paused", "xone.agent.pause");
});

/**
 * Resumes a paused agent (does not undelete).
 */
xone.post("/agents/:id/resume", async (c) => {
  return setXoneAgentStatus(c, "active", "xone.agent.resume");
});

/**
 * Soft-deletes an agent wallet.
 */
xone.delete("/agents/:id", async (c) => {
  return setXoneAgentStatus(c, "deleted", "xone.agent.delete");
});

/**
 * Updates daily / per-tx limits.
 */
xone.patch("/agents/:id/limits", async (c) => {
  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Supabase is not configured" }, 503);

  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = limitsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.dailyLimit !== undefined) {
    update.daily_limit = parsed.data.dailyLimit;
    update.remaining_daily = parsed.data.dailyLimit;
  }
  if (parsed.data.perTransaction !== undefined) {
    update.per_transaction = parsed.data.perTransaction;
  }

  const { data, error } = await admin
    .from("xone_agents")
    .update(update)
    .eq("id", id)
    .select(XONE_AGENT_SELECT)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: "Agent not found" }, 404);

  await writeAdminAudit(
    {
      actor: c.get("admin").sub,
      action: "xone.agent.limits",
      targetType: "xone_agent",
      targetId: id,
      metadata: parsed.data,
    },
    admin,
  );

  return c.json({ ok: true, item: data });
});

/**
 * Cross-tenant agent ledger.
 */
xone.get("/history", async (c) => {
  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Supabase is not configured" }, 503);

  const agentId = (c.req.query("agent_id") ?? "").trim();
  const userId = (c.req.query("user_id") ?? "").trim();
  const type = (c.req.query("type") ?? "").trim();
  const { limit, offset } = parsePage(c);

  let query = admin
    .from("xone_agent_history")
    .select(
      "id, agent_id, user_id, type, amount, currency, to_address, url, tx_hash, meta, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (agentId) query = query.eq("agent_id", agentId);
  if (userId) query = query.eq("user_id", userId);
  if (type) query = query.eq("type", type);

  const { data, error, count } = await query;
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ ok: true, items: data ?? [], total: count ?? 0, limit, offset });
});

/**
 * Sets agent status with audit.
 * @param c - Context
 * @param status - Target status
 * @param action - Audit action
 * @returns JSON response
 */
async function setXoneAgentStatus(
  c: XoneContext,
  status: "active" | "paused" | "deleted",
  action: string,
) {
  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Supabase is not configured" }, 503);

  const id = c.req.param("id");
  const { data: current, error: loadError } = await admin
    .from("xone_agents")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (loadError) return c.json({ error: loadError.message }, 500);
  if (!current) return c.json({ error: "Agent not found" }, 404);

  if (status === "active" && current.status === "deleted") {
    return c.json({ error: "Cannot resume a deleted agent" }, 400);
  }

  const { data, error } = await admin
    .from("xone_agents")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(XONE_AGENT_SELECT)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);

  await writeAdminAudit(
    {
      actor: c.get("admin").sub,
      action,
      targetType: "xone_agent",
      targetId: id,
      metadata: { from: current.status, to: status },
    },
    admin,
  );

  return c.json({ ok: true, item: data });
}
