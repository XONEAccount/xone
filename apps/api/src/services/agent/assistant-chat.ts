import type { SupabaseClient } from "@supabase/supabase-js";
import { createDeepSeek } from "@ai-sdk/deepseek";
import {
  convertToModelMessages,
  extractReasoningMiddleware,
  stepCountIs,
  streamText,
  tool,
  wrapLanguageModel,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { getEnv } from "../../lib/env.js";
import {
  getAgentBalance,
  getDeveloperAgentRowForOwner,
  listDeveloperAgents,
  toDeveloperAgent,
} from "./developer-agent.js";
import { payX402Merchant, paymentRequiresConfirmation, quoteX402Merchant } from "./x402-merchant-pay.js";

export type AssistantX402Service = {
  id: string;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
};

const SYSTEM_PROMPT = `你是 X-ONE 钱包助手，用简洁中文回答。

工作流（必须遵守）：
1. 先在 <think>…</think> 中写出简短思考：用户意图、可匹配的 x402 服务、可用 Agent 钱包。
2. 若用户要调用付费 x402 能力：
   - 从「已启用」的 x402 目录中判断候选。
   - 若只有 1 个合适：直接进入下一步。
   - 若有多个都能满足：必须调用 request_x402_choice，等待用户选择（不要自己猜）。
3. Agent 钱包：
   - 若只有 1 个可用钱包：可直接用于支付。
   - 若有多个：必须调用 request_wallet_choice，等待用户选择。
4. 用户选择完成后，调用 pay_x402：
   - 系统会先报价；若金额未超过该钱包的 perTransaction / 剩余 dailyLimit，将自动付款。
   - 若超过限额，会等待用户手动确认后再付。
5. 不要编造支付结果；只能依据工具返回。
6. 不要索要私钥或 API Key。

输出用合法 Markdown。`;

/**
 * Streams the main 对话 assistant (DeepSeek + x402 routing tools + HITL pickers).
 * @param admin - Supabase admin
 * @param ownerAddress - Owner wallet
 * @param messages - UI messages from useChat
 * @param x402Services - Client catalog (Agent List)
 */
export async function createAssistantChatResponse(
  admin: SupabaseClient,
  ownerAddress: string,
  messages: UIMessage[],
  x402Services: AssistantX402Service[],
): Promise<Response> {
  const env = getEnv();
  const apiKey = env.deepseekApiKey || env.openaiApiKey;
  if (!apiKey) {
    return Response.json(
      { error: "DeepSeek API key is not configured" },
      { status: 503 },
    );
  }

  const enabledServices = x402Services.filter((s) => s.enabled);
  const wallets = await listDeveloperAgents(admin, ownerAddress);

  const catalogJson = JSON.stringify(
    enabledServices.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      description: s.description,
    })),
    null,
    2,
  );
  const walletsJson = JSON.stringify(
    wallets.map((w) => ({
      id: w.id,
      name: w.name,
      chain: w.chain,
      asset: w.asset,
      balanceHint: "client displays on-chain balance",
      dailyLimit: w.dailyLimit,
      perTransaction: w.perTransaction,
      maxAmount: w.maxAmount,
      allowance: w.allowanceEth,
      remainingCap: Math.max(0, w.dailyLimit - w.spentAmount),
      status: w.status,
    })),
    null,
    2,
  );

  const tools = {
    list_context: tool({
      description: "列出当前已启用的 x402 服务目录与可用 Agent 钱包快照。",
      inputSchema: z.object({}),
      execute: async () => ({
        x402Services: enabledServices,
        wallets: wallets.map((w) => ({
          id: w.id,
          name: w.name,
          walletAddress: w.walletAddress,
          chain: w.chain,
          asset: w.asset,
          allowance: w.allowanceEth,
          dailyLimit: w.dailyLimit,
          perTransaction: w.perTransaction,
          maxAmount: w.maxAmount,
          maxSinglePayment: w.maxSinglePayment,
          spentAmount: w.spentAmount,
        })),
      }),
    }),

    /**
     * HITL: multiple x402 matches → client renders picker via addToolOutput.
     */
    request_x402_choice: tool({
      description:
        "当多个 x402 服务都能满足用户需求时，向用户展示候选列表并等待选择。",
      inputSchema: z.object({
        question: z.string().describe("向用户展示的简短说明"),
        candidates: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              url: z.string(),
              reason: z.string().describe("为何该服务可满足需求"),
            }),
          )
          .min(2)
          .max(20),
      }),
      // no execute → client must addToolOutput
    }),

    /**
     * HITL: multiple agent wallets → client picker.
     */
    request_wallet_choice: tool({
      description:
        "当用户有多个 Agent 钱包时，向用户展示列表并等待选择用于支付的钱包。候选只需 id / name / dailyLimit，不要向用户暴露地址。",
      inputSchema: z.object({
        question: z.string().describe("向用户展示的简短说明"),
        candidates: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              maxAmount: z.number().optional(),
              reason: z.string().optional(),
            }),
          )
          .min(2)
          .max(20),
      }),
    }),

    pay_x402: tool({
      description:
        "使用指定 Agent 钱包支付指定 x402 URL（须为目录中已启用条目）。未超限额时自动执行；超限额需用户确认。",
      inputSchema: z.object({
        x402Id: z.string().describe("目录中的 x402 服务 id"),
        agentId: z.string().describe("Developer Agent 钱包 id"),
        idempotencyKey: z
          .string()
          .min(8)
          .max(128)
          .optional()
          .describe("重试时复用同一 key"),
      }),
      needsApproval: async ({ x402Id, agentId }) => {
        const service = enabledServices.find((s) => s.id === x402Id);
        if (!service) return true;

        const agentRow = await getDeveloperAgentRowForOwner(
          admin,
          agentId,
          ownerAddress,
        );
        if (!agentRow) return true;

        const agent = toDeveloperAgent(agentRow);
        const quote = await quoteX402Merchant(service.url);
        if (!quote) return true;
        return paymentRequiresConfirmation(quote.amount, agent);
      },
      execute: async ({ x402Id, agentId, idempotencyKey }) => {
        const service = enabledServices.find((s) => s.id === x402Id);
        if (!service) {
          return { ok: false, error: "x402 服务未找到或未启用" };
        }

        const agentRow = await getDeveloperAgentRowForOwner(
          admin,
          agentId,
          ownerAddress,
        );
        if (!agentRow) {
          return { ok: false, error: "Agent 钱包未找到" };
        }

        const balance = await getAgentBalance(toDeveloperAgent(agentRow));

        const result = await payX402Merchant(admin, agentRow, {
          merchantUrl: service.url,
          idempotencyKey: idempotencyKey ?? crypto.randomUUID(),
        });

        if (!result.ok) {
          return {
            ok: false,
            error: result.error,
            service,
            wallet: {
              id: balance.walletAddress,
              allowance: balance.allowance,
              onChainBalance: balance.onChainBalance,
            },
          };
        }

        return {
          ok: true,
          service: { id: service.id, name: service.name, url: service.url },
          payment: {
            id: result.payment.id,
            amount: result.payment.amount,
            asset: result.payment.asset,
            status: result.payment.status,
            merchant: result.payment.merchant,
          },
          receipt: result.receipt,
          agent: {
            id: result.agent.id,
            name: result.agent.name,
            walletAddress: result.agent.walletAddress,
          },
        };
      },
    }),
  };

  const rawBase = env.llmBaseUrl.replace(/\/$/, "");
  const baseURL = rawBase.endsWith("/v1") ? rawBase : `${rawBase}/v1`;
  const deepseek = createDeepSeek({ apiKey, baseURL });
  const model = wrapLanguageModel({
    model: deepseek.chat(env.llmModel || "deepseek-chat"),
    middleware: extractReasoningMiddleware({ tagName: "think" }),
  });

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model,
    system: `${SYSTEM_PROMPT}

## 已启用 x402 目录
${catalogJson}

## 可用 Agent 钱包
${walletsJson}`,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(10),
    temperature: 0.3,
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    onError: (error) => (error instanceof Error ? error.message : String(error)),
  });
}
