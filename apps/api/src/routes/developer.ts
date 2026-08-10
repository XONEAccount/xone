import { Hono } from "hono";
import {
  createDeveloperAgentSchema,
  fundDeveloperAgentSchema,
} from "@wallet/schemas";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { getSupabaseAdmin } from "../lib/supabase.js";
import {
  createDeveloperAgent,
  fundDeveloperAgent,
  getDeveloperAgentForOwner,
  listAgentPayments,
  listDeveloperAgents,
} from "../services/agent/developer-agent.js";

const developer = new Hono<{ Variables: AuthVariables }>();

developer.use("*", requireAuth);

/**
 * POST /api/developer/agents — create agent + restricted ETH wallet in one shot.
 */
developer.post("/agents", async (c) => {
  const parsed = createDeveloperAgentSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    const result = await createDeveloperAgent(admin, parsed.data);
    return c.json(
      {
        ok: true,
        agent: result.agent,
        apiKey: result.apiKey,
        endpoints: {
          mcp: result.mcpEndpoint,
          x402: result.x402Endpoint,
        },
        warning: "Store apiKey now — it is only returned once.",
      },
      201,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed";
    console.error("[developer] create", error);
    return c.json({ error: message }, 400);
  }
});

/**
 * GET /api/developer/agents?address=0x...
 */
developer.get("/agents", async (c) => {
  const address = c.req.query("address");
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return c.json({ error: "Valid address query param required" }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    const agents = await listDeveloperAgents(admin, address);
    return c.json({ agents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "List failed";
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /api/developer/agents/:id?address=0x...
 */
developer.get("/agents/:id", async (c) => {
  const address = c.req.query("address");
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return c.json({ error: "Valid address query param required" }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    const agent = await getDeveloperAgentForOwner(admin, c.req.param("id"), address);
    if (!agent) return c.json({ error: "Agent not found" }, 404);
    const payments = await listAgentPayments(admin, agent.id);
    return c.json({ agent, payments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed";
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /api/developer/agents/:id/fund — credit allowance after on-chain ETH transfer.
 */
developer.post("/agents/:id/fund", async (c) => {
  const parsed = fundDeveloperAgentSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    const agent = await fundDeveloperAgent(
      admin,
      c.req.param("id"),
      parsed.data.ownerAddress,
      parsed.data.amount,
      parsed.data.txHash,
    );
    return c.json({ ok: true, agent, txHash: parsed.data.txHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fund failed";
    return c.json({ error: message }, 400);
  }
});

export { developer };
