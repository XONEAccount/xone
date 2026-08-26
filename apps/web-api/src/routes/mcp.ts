import { Hono } from "hono";
import { machinePaySchema, mcpJsonRpcSchema } from "@xone/schemas";
import { getSupabaseAdmin } from "../lib/supabase.js";
import {
  executeMachinePayment,
  getAgentBalance,
  getAgentPayment,
  getDeveloperAgentByApiKey,
  listAgentPayments,
  toDeveloperAgent,
} from "../services/agent/developer-agent.js";

const mcp = new Hono();

/** Agent MCP surface: balance + payment status (+ pay for machine payments). */
const TOOLS = [
  {
    name: "get_balance",
    description:
      "Get the agent wallet on-chain balance, policy allowance, spent amount, and remaining cap.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_payment_status",
    description:
      "Get payment status by paymentId, or list recent machine payments when paymentId is omitted.",
    inputSchema: {
      type: "object",
      properties: {
        paymentId: {
          type: "string",
          description: "Optional payment id. Omit to list recent payments.",
        },
        limit: {
          type: "number",
          description: "Max recent payments when listing (default 10, max 50).",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "pay",
    description:
      "Execute a policy-gated machine payment via x402. Requires recipient and amount.",
    inputSchema: {
      type: "object",
      required: ["amount", "recipient"],
      properties: {
        amount: { type: "string", description: "Amount, e.g. 0.01" },
        recipient: { type: "string", description: "0x recipient" },
        merchant: { type: "string" },
        resource: { type: "string" },
        idempotencyKey: { type: "string" },
        challengeOnly: { type: "boolean" },
      },
    },
  },
] as const;

/**
 * Extracts Bearer token (agent API key) from the request.
 * @param header - Authorization header
 */
function extractApiKey(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.startsWith("xone_ag_") ? token : null;
}

/**
 * GET /api/mcp — lightweight tool discovery for humans / agents.
 */
mcp.get("/", (c) => {
  return c.json({
    name: "xone-agent-mcp",
    version: "0.1.0",
    transport: "http+jsonrpc",
    auth: "Authorization: Bearer <agent_api_key>",
    tools: TOOLS,
  });
});

/**
 * POST /api/mcp — JSON-RPC tools/list and tools/call for machine payments.
 */
mcp.post("/", async (c) => {
  const apiKey = extractApiKey(c.req.header("Authorization"));
  if (!apiKey) {
    return c.json(
      {
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized — use agent API key" },
        id: null,
      },
      401,
    );
  }

  const body = await c.req.json().catch(() => null);
  const parsed = mcpJsonRpcSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        jsonrpc: "2.0",
        error: { code: -32600, message: "Invalid Request" },
        id: null,
      },
      400,
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return c.json(
      {
        jsonrpc: "2.0",
        error: { code: -32002, message: "Database not configured" },
        id: parsed.data.id ?? null,
      },
      503,
    );
  }

  const agentRow = await getDeveloperAgentByApiKey(admin, apiKey);
  if (!agentRow) {
    return c.json(
      {
        jsonrpc: "2.0",
        error: { code: -32001, message: "Invalid agent API key" },
        id: parsed.data.id ?? null,
      },
      401,
    );
  }

  const agent = toDeveloperAgent(agentRow);
  const { method, id, params = {} } = parsed.data;

  if (method === "tools/list" || method === "initialize") {
    return c.json({
      jsonrpc: "2.0",
      id: id ?? null,
      result:
        method === "initialize"
          ? {
              protocolVersion: "2024-11-05",
              serverInfo: { name: "xone-agent-mcp", version: "0.1.0" },
              capabilities: { tools: {} },
            }
          : { tools: TOOLS },
    });
  }

  if (method === "tools/call") {
    const name = typeof params.name === "string" ? params.name : "";
    const args =
      params.arguments && typeof params.arguments === "object"
        ? (params.arguments as Record<string, unknown>)
        : {};

    if (name === "get_balance") {
      const balance = await getAgentBalance(agent);
      return c.json({
        jsonrpc: "2.0",
        id: id ?? null,
        result: {
          content: [{ type: "text", text: JSON.stringify(balance) }],
        },
      });
    }

    if (name === "get_payment_status") {
      const paymentId =
        typeof args.paymentId === "string" ? args.paymentId.trim() : "";
      if (paymentId) {
        const payment = await getAgentPayment(admin, agent.id, paymentId);
        if (!payment) {
          return c.json({
            jsonrpc: "2.0",
            id: id ?? null,
            error: { code: -32004, message: "Payment not found" },
          });
        }
        return c.json({
          jsonrpc: "2.0",
          id: id ?? null,
          result: {
            content: [{ type: "text", text: JSON.stringify({ payment }) }],
          },
        });
      }

      const rawLimit = typeof args.limit === "number" ? args.limit : 10;
      const limit = Math.min(50, Math.max(1, Math.floor(rawLimit)));
      const payments = await listAgentPayments(admin, agent.id, limit);
      return c.json({
        jsonrpc: "2.0",
        id: id ?? null,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({ count: payments.length, payments }),
            },
          ],
        },
      });
    }

    if (name === "pay") {
      const payParsed = machinePaySchema.safeParse({
        amount: args.amount,
        recipient: args.recipient,
        merchant: args.merchant,
        resource: args.resource,
        idempotencyKey: args.idempotencyKey,
        challengeOnly: args.challengeOnly,
        asset: agent.asset,
        chain: agent.chain,
      });
      if (!payParsed.success) {
        return c.json({
          jsonrpc: "2.0",
          id: id ?? null,
          error: {
            code: -32602,
            message: "Invalid pay arguments",
            data: payParsed.error.flatten(),
          },
        });
      }

      const result = await executeMachinePayment(admin, agentRow, payParsed.data);
      if (!result.ok) {
        return c.json(
          {
            jsonrpc: "2.0",
            id: id ?? null,
            error: {
              code: result.status === 402 ? -32042 : -32003,
              message: result.error,
              data: result.x402 ?? undefined,
            },
          },
          result.status === 402 ? 402 : 400,
        );
      }

      return c.json({
        jsonrpc: "2.0",
        id: id ?? null,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                receipt: result.receipt,
                agent: {
                  id: result.agent.id,
                  allowanceEth: result.agent.allowanceEth,
                  spentAmount: result.agent.spentAmount,
                },
              }),
            },
          ],
        },
      });
    }

    return c.json({
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code: -32601, message: `Unknown tool: ${name}` },
    });
  }

  return c.json({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
});

export { mcp };
