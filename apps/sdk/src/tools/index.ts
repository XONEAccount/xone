import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { RemoteAgent } from "../remoteAgent.js";
import { AgentNotFoundError } from "../errors.js";
import { payMockAgent } from "../mockPay.js";
import { getAgentRecord } from "../store/mock.js";
import type { AgentRecord } from "../types.js";

/**
 * Runtime context shared by all XOne LangChain tools.
 */
export type XOneToolContext =
  | {
      mode: "mock";
      getAgentId: () => string;
    }
  | {
      mode: "remote";
      remote: RemoteAgent;
    };

/**
 * Builds LangChain structured tools for an agent's wallet + x402 flows.
 * Transfer is not exposed — x402 is the only spend path.
 *
 * @param ctx - Shared agent context (mock store or remote API)
 * @returns Array of LangChain tools
 */
export function createXOneTools(ctx: XOneToolContext) {
  const walletAddressTool = tool(
    async () => {
      if (ctx.mode === "remote") {
        const r = ctx.remote;
        return JSON.stringify({
          agentId: r.id,
          name: r.name,
          chain: r.chain,
          address: r.getAddress(),
          family: "evm",
          status: r.getStatus(),
        });
      }
      const record = requireMock(ctx);
      return JSON.stringify({
        agentId: record.id,
        name: record.name,
        chain: record.chain,
        address: record.wallet.address,
        family: record.wallet.family,
        status: record.status,
      });
    },
    {
      name: "xone_wallet_address",
      description:
        "Return the agent's wallet address, name, status, and settlement chain.",
      schema: z.object({}),
    },
  );

  const balanceTool = tool(
    async () => {
      if (ctx.mode === "remote") {
        return JSON.stringify(await ctx.remote.getSpendSnapshot());
      }
      const record = requireMock(ctx);
      return JSON.stringify({
        chain: record.chain,
        address: record.wallet.address,
        currency: record.currency,
        remainingDaily: record.remainingDaily,
        dailyLimit: record.dailyLimit,
        perTransaction: record.perTransaction,
        status: record.status,
        note: "Fund on-chain USDC at address; limits use remainingDaily / perTransaction",
      });
    },
    {
      name: "xone_wallet_balance",
      description:
        "Return the agent's spend-policy snapshot (address, remainingDaily, limits, status). Not an on-chain USDC RPC balance — fund USDC at the wallet address separately.",
      schema: z.object({}),
    },
  );

  const limitsTool = tool(
    async () => {
      if (ctx.mode === "remote") {
        const limits = await ctx.remote.getLimits();
        return JSON.stringify({
          ...limits,
          status: ctx.remote.getStatus(),
        });
      }
      const record = requireMock(ctx);
      return JSON.stringify({
        dailyLimit: record.dailyLimit,
        perTransaction: record.perTransaction,
        remainingDaily: record.remainingDaily,
        dailyPeriod: record.dailyPeriod,
        currency: record.currency,
        status: record.status,
        allowedHosts: record.allowedHosts,
        allowedPayees: record.allowedPayees,
      });
    },
    {
      name: "xone_payment_status",
      description:
        "Get the agent's spend limits, remaining daily budget, and status.",
      schema: z.object({}),
    },
  );

  const x402PayTool = tool(
    async ({ url, maxAmount, idempotencyKey }) => {
      if (ctx.mode === "remote") {
        const result = await ctx.remote.pay({ url, maxAmount, idempotencyKey });
        return JSON.stringify(result);
      }
      const record = requireMock(ctx);
      const result = await payMockAgent(record.id, {
        url,
        maxAmount,
        idempotencyKey,
      });
      return JSON.stringify(result);
    },
    {
      name: "xone_x402_pay",
      description:
        "Pay a real HTTP 402 (x402) URL. Reuse idempotencyKey on retries to avoid double payment. maxAmount is a ceiling only.",
      schema: z.object({
        url: z
          .string()
          .url()
          .describe("URL that returns HTTP 402 Payment Required"),
        maxAmount: z
          .union([z.number().positive(), z.string()])
          .optional()
          .describe(
            "Optional ceiling; payment aborts if the 402 quote is higher. Does not override the quote.",
          ),
        idempotencyKey: z
          .string()
          .min(8)
          .max(128)
          .optional()
          .describe(
            "Reuse on network retries. Do not generate a new key until the previous attempt is known failed.",
          ),
      }),
    },
  );

  return [walletAddressTool, balanceTool, limitsTool, x402PayTool];
}

/**
 * @param ctx - Mock tool context
 * @returns Latest agent record
 */
function requireMock(
  ctx: Extract<XOneToolContext, { mode: "mock" }>,
): AgentRecord {
  const id = ctx.getAgentId();
  const record = getAgentRecord(id);
  if (!record) {
    throw new AgentNotFoundError(id);
  }
  return record;
}
