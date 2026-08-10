import { Hono } from "hono";
import { machinePaySchema } from "@wallet/schemas";
import { getSupabaseAdmin } from "../lib/supabase.js";
import {
  executeMachinePayment,
  getDeveloperAgentByApiKey,
} from "../services/agent/developer-agent.js";

const x402 = new Hono();

/**
 * Extracts agent API key from Authorization Bearer header.
 * @param header - Authorization header
 */
function extractApiKey(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.startsWith("xone_ag_") ? token : null;
}

/**
 * POST /api/x402/pay — first-class machine payment endpoint.
 * Returns 402 Payment Required when allowance is insufficient or challengeOnly.
 */
x402.post("/pay", async (c) => {
  const apiKey = extractApiKey(c.req.header("Authorization"));
  if (!apiKey) {
    return c.json({ error: "Unauthorized — use agent API key" }, 401);
  }

  const parsed = machinePaySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  const agentRow = await getDeveloperAgentByApiKey(admin, apiKey);
  if (!agentRow) return c.json({ error: "Invalid agent API key" }, 401);

  const result = await executeMachinePayment(admin, agentRow, parsed.data);
  if (!result.ok) {
    if (result.status === 402 && result.x402) {
      c.header("X-Payment-Required", "true");
      return c.json(result.x402, 402);
    }
    return c.json({ error: result.error }, result.status);
  }

  return c.json({
    ok: true,
    receipt: result.receipt,
    agent: {
      id: result.agent.id,
      walletAddress: result.agent.walletAddress,
      allowanceEth: result.agent.allowanceEth,
      spentAmount: result.agent.spentAmount,
      maxAmount: result.agent.maxAmount,
      maxSinglePayment: result.agent.maxSinglePayment,
    },
  });
});

export { x402 };
