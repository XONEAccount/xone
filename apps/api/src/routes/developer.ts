import { Hono } from "hono";
import {
  createDeveloperAgentSchema,
  deleteDeveloperAgentSchema,
  developerAgentChatSchema,
  fundDeveloperAgentSchema,
  updateDeveloperAgentSchema,
} from "@wallet/schemas";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { getSupabaseAdmin } from "../lib/supabase.js";
import {
  createDeveloperAgent,
  deleteDeveloperAgent,
  fundDeveloperAgent,
  getDeveloperAgentForOwner,
  listAgentPayments,
  listDeveloperAgents,
  updateDeveloperAgentLimits,
} from "../services/agent/developer-agent.js";
import { createDeveloperAgentChatResponse } from "../services/agent/developer-agent-chat.js";
import type { UIMessage } from "ai";

const developer = new Hono<{ Variables: AuthVariables }>();

developer.use("*", requireAuth);

/**
 * POST /api/developer/agents — create agent + restricted USDC wallet in one shot.
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

/**
 * PATCH /api/developer/agents/:id — update dailyLimit / perTransaction / allowlists.
 */
developer.patch("/agents/:id", async (c) => {
  const parsed = updateDeveloperAgentSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    const agent = await updateDeveloperAgentLimits(
      admin,
      c.req.param("id"),
      parsed.data.ownerAddress,
      parsed.data.maxAmount,
      parsed.data.maxSinglePayment,
      {
        allowedHosts: parsed.data.allowedHosts,
        allowedPayees: parsed.data.allowedPayees,
      },
    );
    return c.json({ ok: true, agent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return c.json({ error: message }, 400);
  }
});

/**
 * DELETE /api/developer/agents/:id — soft-delete (disable) an agent.
 */
developer.delete("/agents/:id", async (c) => {
  const parsed = deleteDeveloperAgentSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    await deleteDeveloperAgent(admin, c.req.param("id"), parsed.data.ownerAddress);
    return c.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /api/developer/agents/:id/chat — Vercel AI SDK UI stream (DeepSeek + tools).
 * Tools: get_wallet_info, get_spending_history.
 */
developer.post("/agents/:id/chat", async (c) => {
  const parsed = developerAgentChatSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    return await createDeveloperAgentChatResponse(
      admin,
      c.req.param("id"),
      parsed.data.ownerAddress,
      parsed.data.messages as UIMessage[],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat failed";
    console.error("[developer] chat", error);
    return c.json({ error: message }, 400);
  }
});

export { developer };
