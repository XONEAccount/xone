import { Hono } from "hono";
import type { ApiBindings, ApiVariables } from "../env";
import {
  ensureDailyPeriod,
  payX402Agent,
  requireOwnedAgent,
} from "../lib/agents";
import { HttpError } from "../lib/errors";
import { serializeAgent, serializeHistory } from "../lib/serialize";
import { createServiceClient, type DbAgent, type DbHistory } from "../lib/supabase";
import { requireApiKey } from "../middleware/auth";

type Env = { Bindings: ApiBindings; Variables: ApiVariables };

/**
 * Spender API for `XOne({ agentToken })`.
 * Allowed: get agent, pay, history. Create / limits / pause / delete are console JWT only.
 */
export const sdkRoutes = new Hono<Env>();

sdkRoutes.use("*", requireApiKey);

sdkRoutes.get("/agents", async (c) => {
  const supabase = createServiceClient(c.env);
  const { data, error } = await supabase
    .from("xone_agents")
    .select("*")
    .eq("api_key_id", c.get("apiKeyId"))
    .order("created_at", { ascending: false });

  if (error) throw new HttpError(500, error.message, "db_error");
  const items = await Promise.all(
    ((data ?? []) as DbAgent[]).map(async (row) =>
      serializeAgent(await ensureDailyPeriod(c, row)),
    ),
  );
  return c.json({ items });
});

sdkRoutes.get("/agents/:id", async (c) => {
  const agent = await ensureDailyPeriod(c, await requireOwnedAgent(c, c.req.param("id")));
  return c.json(serializeAgent(agent));
});

/**
 * Server-side x402 payment (idempotent; limits enforced before chain settlement).
 */
sdkRoutes.post("/agents/:id/pay", async (c) => {
  const agent = await requireOwnedAgent(c, c.req.param("id"));
  const body = await c.req.json<{
    url?: string;
    maxAmount?: string | number;
    idempotencyKey?: string;
  }>();
  if (!body.url?.trim()) {
    throw new HttpError(400, "url is required", "validation_error");
  }
  const idempotencyKey =
    body.idempotencyKey?.trim() ||
    c.req.header("Idempotency-Key")?.trim() ||
    "";

  const result = await payX402Agent(c, agent, {
    url: body.url,
    maxAmount: body.maxAmount,
    idempotencyKey,
  });
  return c.json({
    ok: true,
    mock: false,
    protocol: "x402",
    url: result.url,
    paid: result.paid,
    currency: result.currency,
    chain: result.agent.chain,
    from: result.from,
    status: result.status,
    body: result.body,
    settlement: result.settlement,
    network: result.network,
    remainingDaily: result.agent.remaining_daily,
    idempotencyKey: result.idempotencyKey,
    replay: result.replay ?? false,
    agent: serializeAgent(result.agent),
  });
});

sdkRoutes.get("/agents/:id/history", async (c) => {
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

/**
 * @returns 403 explaining that operator actions belong on the console JWT
 */
function operatorRequired(): never {
  throw new HttpError(
    403,
    "This action requires the console (signed-in user). Agent tokens may only get, pay, and read history.",
    "operator_required",
  );
}

sdkRoutes.post("/agents", () => operatorRequired());
sdkRoutes.delete("/agents", () => operatorRequired());
sdkRoutes.delete("/agents/:id", () => operatorRequired());
sdkRoutes.post("/agents/:id/pause", () => operatorRequired());
sdkRoutes.post("/agents/:id/resume", () => operatorRequired());
sdkRoutes.patch("/agents/:id/limits", () => operatorRequired());
sdkRoutes.post("/agents/:id/transfer", () => operatorRequired());
