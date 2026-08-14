import { Hono } from "hono";
import type { ApiBindings, ApiVariables } from "../env";
import {
  createAgentForKey,
  ensureProfile,
  requireOwnedAgent,
  setAgentStatus,
  softDeleteAgent,
  updateLimits,
} from "../lib/agents";
import { HttpError } from "../lib/errors";
import { serializeAgent, serializeHistory } from "../lib/serialize";
import { createServiceClient, type DbAgent, type DbApiKey, type DbHistory } from "../lib/supabase";
import type { Chain } from "../lib/wallet";
import { requireUser } from "../middleware/auth";

type Env = { Bindings: ApiBindings; Variables: ApiVariables };

export const agentsRoutes = new Hono<Env>();

agentsRoutes.use("*", requireUser);

/**
 * Lists agents for the signed-in user.
 */
agentsRoutes.get("/", async (c) => {
  await ensureProfile(c);
  const supabase = createServiceClient(c.env);
  const apiKeyId = c.req.query("apiKeyId");
  let query = supabase
    .from("xone_agents")
    .select("*")
    .eq("user_id", c.get("userId"))
    .order("created_at", { ascending: false });

  if (apiKeyId) query = query.eq("api_key_id", apiKeyId);

  const { data, error } = await query;
  if (error) throw new HttpError(500, error.message, "db_error");
  return c.json({
    items: ((data ?? []) as DbAgent[]).map(serializeAgent),
  });
});

/**
 * Account-wide history (funds page).
 */
agentsRoutes.get("/history", async (c) => {
  await ensureProfile(c);
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);
  const supabase = createServiceClient(c.env);
  const { data, error } = await supabase
    .from("xone_agent_history")
    .select("*")
    .eq("user_id", c.get("userId"))
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new HttpError(500, error.message, "db_error");
  return c.json({
    items: ((data ?? []) as DbHistory[]).map(serializeHistory),
  });
});

/**
 * Creates an agent bound to one of the user's API keys (1 key ↔ 1 agent).
 * Operator-only: agent tokens cannot create wallets or set limits.
 */
agentsRoutes.post("/", async (c) => {
  await ensureProfile(c);
  const body = await c.req.json<{
    apiKeyId?: string;
    name?: string;
    dailyLimit?: number;
    perTransaction?: number;
    currency?: string;
    chain?: Chain;
    allowedHosts?: unknown;
    allowedPayees?: unknown;
  }>();

  const apiKeyId = body.apiKeyId?.trim();
  if (!apiKeyId) {
    throw new HttpError(400, "apiKeyId is required", "validation_error");
  }

  const supabase = createServiceClient(c.env);
  const { data: keyRow, error: keyError } = await supabase
    .from("xone_api_keys")
    .select("*")
    .eq("id", apiKeyId)
    .eq("user_id", c.get("userId"))
    .maybeSingle();
  if (keyError) throw new HttpError(500, keyError.message, "db_error");
  const key = keyRow as DbApiKey | null;
  if (!key || key.status !== "active") {
    throw new HttpError(404, `API key not found: ${apiKeyId}`, "not_found");
  }

  const { agent } = await createAgentForKey(
    c,
    {
      name: body.name ?? "",
      dailyLimit: Number(body.dailyLimit),
      perTransaction: Number(body.perTransaction),
      currency: body.currency,
      chain: body.chain,
      allowedHosts: body.allowedHosts,
      allowedPayees: body.allowedPayees,
    },
    key.id,
    c.get("userId"),
  );
  return c.json(serializeAgent(agent), 201);
});

/**
 * Agent detail.
 */
agentsRoutes.get("/:id", async (c) => {
  await ensureProfile(c);
  const agent = await requireOwnedAgent(c, c.req.param("id"));
  return c.json(serializeAgent(agent));
});

/**
 * Soft-delete agent.
 */
agentsRoutes.delete("/:id", async (c) => {
  await ensureProfile(c);
  const agent = await requireOwnedAgent(c, c.req.param("id"));
  const updated = await softDeleteAgent(c, agent);
  return c.json(serializeAgent(updated));
});

agentsRoutes.post("/:id/pause", async (c) => {
  await ensureProfile(c);
  const agent = await requireOwnedAgent(c, c.req.param("id"));
  const updated = await setAgentStatus(c, agent, "paused", "pause");
  return c.json(serializeAgent(updated));
});

agentsRoutes.post("/:id/resume", async (c) => {
  await ensureProfile(c);
  const agent = await requireOwnedAgent(c, c.req.param("id"));
  const updated = await setAgentStatus(c, agent, "active", "resume");
  return c.json(serializeAgent(updated));
});

agentsRoutes.patch("/:id/limits", async (c) => {
  await ensureProfile(c);
  const agent = await requireOwnedAgent(c, c.req.param("id"));
  const body = await c.req.json<{
    dailyLimit?: number;
    perTransaction?: number;
    allowedHosts?: unknown;
    allowedPayees?: unknown;
  }>();
  const updated = await updateLimits(c, agent, body);
  return c.json(serializeAgent(updated));
});

agentsRoutes.get("/:id/history", async (c) => {
  await ensureProfile(c);
  const agent = await requireOwnedAgent(c, c.req.param("id"));
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const supabase = createServiceClient(c.env);
  const { data, error } = await supabase
    .from("xone_agent_history")
    .select("*")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new HttpError(500, error.message, "db_error");
  return c.json({
    items: ((data ?? []) as DbHistory[]).map(serializeHistory),
  });
});
