import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { XOne, type XOneChain } from "@xone/sdk";
import { z } from "zod";
import { missingApiKeyMessage, requireUserApiKey } from "./api-key.js";
import { McpSpendSession, normalizeApiKey } from "./session.js";

const CHAINS = ["base", "base-sepolia", "polygon", "arbitrum"] as const;

const createSchema = z.object({
  apiKey: z
    .string()
    .optional()
    .describe(
      "Console spend key (xone_…). Omit to prompt the user — do not invent a key.",
    ),
  name: z.string().min(1).max(80).describe("Agent display name"),
  dailyLimit: z.number().positive().describe("Max spend per UTC day"),
  perTransaction: z.number().positive().describe("Max spend per payment"),
  chain: z.enum(CHAINS).optional().describe("Settlement chain"),
  currency: z.string().optional().describe("Settlement currency, default USDC"),
});

const optionalKeySchema = z.object({
  apiKey: z
    .string()
    .optional()
    .describe("Console spend key if not already set this session"),
});

const historySchema = optionalKeySchema.extend({
  limit: z.number().int().min(1).max(100).optional(),
});

const paySchema = optionalKeySchema.extend({
  url: z.string().url().describe("HTTP resource that returns 402 / x402"),
  maxAmount: z
    .union([z.number().positive(), z.string()])
    .optional()
    .describe("Optional ceiling; does not override the quote"),
  idempotencyKey: z
    .string()
    .min(8)
    .max(128)
    .optional()
    .describe("Reuse on retries to avoid double payment"),
});

/**
 * Builds the XOne MCP server (stdio or programmatic).
 *
 * `xone_create_agent` interrupts until the human provides an API key.
 *
 * @returns Configured MCP server
 */
export function createXOneMcpServer(): McpServer {
  const session = new McpSpendSession();
  const envKey = normalizeApiKey(process.env.XONE_AGENT_TOKEN);
  if (envKey) session.setApiKey(envKey);

  const server = new McpServer(
    { name: "xone", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.registerTool(
    "xone_set_api_key",
    {
      description:
        "Save the user's XOne console API key for this session. Prompt the user if apiKey is omitted.",
      inputSchema: optionalKeySchema,
    },
    async ({ apiKey }) => {
      const key = await requireUserApiKey({ session, server, provided: apiKey });
      if (!key) return errorResult(missingApiKeyMessage());
      return textResult({
        ok: true,
        message: "API key saved for this MCP session. You can now create or pay.",
      });
    },
  );

  server.registerTool(
    "xone_create_agent",
    {
      description:
        "Create (or load) the wallet bound to the user's API key. Stops and asks the user for the key if missing. 1 key ↔ 1 wallet.",
      inputSchema: createSchema,
    },
    async (args) => {
      const key = await requireUserApiKey({
        session,
        server,
        provided: args.apiKey,
      });
      if (!key) return errorResult(missingApiKeyMessage());

      try {
        const agent = await session.getClient().agent.create({
          apiKey: key,
          name: args.name,
          dailyLimit: args.dailyLimit,
          perTransaction: args.perTransaction,
          chain: args.chain as XOneChain | undefined,
          currency: args.currency,
        });
        return textResult({
          id: agent.id,
          name: agent.name,
          chain: agent.chain,
          address: agent.getAddress(),
          status: agent.getStatus(),
        });
      } catch (error) {
        return errorResult(toErrorMessage(error));
      }
    },
  );

  server.registerTool(
    "xone_get_agent",
    {
      description: "Load the agent bound to the current API key.",
      inputSchema: optionalKeySchema,
    },
    async ({ apiKey }) => {
      const client = await clientOrStop(session, server, apiKey);
      if ("stop" in client) return client.stop;
      try {
        const agent = await client.xone.agent.get();
        if (!agent) {
          return textResult({
            agent: null,
            note: "No wallet bound to this key yet. Call xone_create_agent.",
          });
        }
        return textResult({
          id: agent.id,
          name: agent.name,
          chain: agent.chain,
          address: agent.getAddress(),
          status: agent.getStatus(),
        });
      } catch (error) {
        return errorResult(toErrorMessage(error));
      }
    },
  );

  server.registerTool(
    "xone_wallet_address",
    {
      description: "Return the agent wallet address, chain, and status.",
      inputSchema: optionalKeySchema,
    },
    async ({ apiKey }) => {
      const loaded = await loadAgent(session, server, apiKey);
      if ("stop" in loaded) return loaded.stop;
      const { agent } = loaded;
      return textResult({
        agentId: agent.id,
        name: agent.name,
        chain: agent.chain,
        address: agent.getAddress(),
        status: agent.getStatus(),
      });
    },
  );

  server.registerTool(
    "xone_wallet_balance",
    {
      description:
        "Return address plus spend-limit snapshot (not a full on-chain USDC query).",
      inputSchema: optionalKeySchema,
    },
    async ({ apiKey }) => {
      const loaded = await loadAgent(session, server, apiKey);
      if ("stop" in loaded) return loaded.stop;
      try {
        return textResult(await loaded.agent.getBalance());
      } catch (error) {
        return errorResult(toErrorMessage(error));
      }
    },
  );

  server.registerTool(
    "xone_payment_status",
    {
      description: "Return spend limits, remaining daily budget, and status.",
      inputSchema: optionalKeySchema,
    },
    async ({ apiKey }) => {
      const loaded = await loadAgent(session, server, apiKey);
      if ("stop" in loaded) return loaded.stop;
      try {
        const limits = await loaded.agent.getLimits();
        return textResult({ ...limits, status: loaded.agent.getStatus() });
      } catch (error) {
        return errorResult(toErrorMessage(error));
      }
    },
  );

  server.registerTool(
    "xone_get_history",
    {
      description: "Return recent spend and lifecycle events, newest first.",
      inputSchema: historySchema,
    },
    async ({ apiKey, limit }) => {
      const loaded = await loadAgent(session, server, apiKey);
      if ("stop" in loaded) return loaded.stop;
      try {
        const items = await loaded.agent.getHistory({ limit: limit ?? 20 });
        return textResult({ count: items.length, items });
      } catch (error) {
        return errorResult(toErrorMessage(error));
      }
    },
  );

  server.registerTool(
    "xone_x402_pay",
    {
      description:
        "Pay an x402 URL under the agent policy. Requires the user's API key.",
      inputSchema: paySchema,
    },
    async (args) => {
      const loaded = await loadAgent(session, server, args.apiKey);
      if ("stop" in loaded) return loaded.stop;
      try {
        const result = await loaded.agent.pay({
          url: args.url,
          maxAmount: args.maxAmount,
          idempotencyKey: args.idempotencyKey,
        });
        return textResult(result);
      } catch (error) {
        return errorResult(toErrorMessage(error));
      }
    },
  );

  return server;
}

/**
 * Seeds `XONE_API_URL` so the SDK talks to the live API instead of the mock store.
 *
 * @param fallback - Production origin used when the env var is unset
 */
export function ensureApiUrl(
  fallback = "https://xone-sdk-api.tskwangyi.workers.dev",
): void {
  if (!process.env.XONE_API_URL?.trim()) {
    process.env.XONE_API_URL = fallback;
  }
}

type StopResult = { stop: ReturnType<typeof errorResult> };

/**
 * @param session - Spend session
 * @param server - MCP server
 * @param apiKey - Optional key from the tool call
 * @returns SDK client or a stop result
 */
async function clientOrStop(
  session: McpSpendSession,
  server: McpServer,
  apiKey?: string,
): Promise<{ xone: XOne } | StopResult> {
  const key = await requireUserApiKey({ session, server, provided: apiKey });
  if (!key) return { stop: errorResult(missingApiKeyMessage()) };
  return { xone: session.getClient() };
}

/**
 * @param session - Spend session
 * @param server - MCP server
 * @param apiKey - Optional key from the tool call
 * @returns Bound agent or a stop result
 */
async function loadAgent(
  session: McpSpendSession,
  server: McpServer,
  apiKey?: string,
) {
  const client = await clientOrStop(session, server, apiKey);
  if ("stop" in client) return client;
  const agent = await client.xone.agent.get();
  if (!agent) {
    return {
      stop: errorResult(
        "No agent bound to this API key. Call xone_create_agent first (it will ask for the key if needed).",
      ),
    };
  }
  return { agent };
}

/**
 * @param data - JSON-serializable payload
 */
function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * @param message - Error text shown to the host / user
 */
function errorResult(message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

/**
 * @param error - Caught value
 * @returns Message for the tool result
 */
function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
