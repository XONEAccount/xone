import type { SupabaseClient } from "@supabase/supabase-js";
import { createDeepSeek } from "@ai-sdk/deepseek";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { getEnv } from "../../lib/env.js";
import {
  getAgentBalance,
  getDeveloperAgentForOwner,
  listAgentPayments,
} from "./developer-agent.js";

const SYSTEM_PROMPT = `你是 X-ONE Developer Agent 助手，用简洁中文回答。
输出必须是合法 Markdown（使用真实换行）：
- 结构化数据优先用无序列表（- 项目：值）
- 若用表格，表头、分隔行、每一数据行必须各占一行
- 地址与金额用行内代码，不要编造数据
你只能通过工具查询当前 Agent 钱包信息与消费记录。
你不能发起转账/支付，也不能索要私钥或 API Key。
工具返回为空时如实说明。`;

/**
 * Builds AI SDK tools scoped to one owned developer agent.
 * @param admin - Supabase admin
 * @param agentId - Agent id
 * @param ownerAddress - Owner wallet
 */
async function buildAgentTools(
  admin: SupabaseClient,
  agentId: string,
  ownerAddress: string,
) {
  const agent = await getDeveloperAgentForOwner(admin, agentId, ownerAddress);
  if (!agent) {
    throw new Error("Agent not found");
  }

  return {
    agent,
    tools: {
      get_wallet_info: tool({
        description:
          "查询当前 Agent 钱包信息：地址、链、资产、额度、已花费、链上余额、单笔/总额上限。",
        inputSchema: z.object({}),
        execute: async () => {
          const balance = await getAgentBalance(agent);
          return {
            name: agent.name,
            walletAddress: balance.walletAddress,
            chain: balance.chain,
            asset: balance.asset,
            allowance: balance.allowance,
            spentAmount: balance.spentAmount,
            remainingCap: balance.remainingCap,
            maxAmount: balance.maxAmount,
            maxSinglePayment: balance.maxSinglePayment,
            onChainBalance: balance.onChainBalance,
            onChainSymbol: balance.onChainSymbol,
            status: agent.status,
          };
        },
      }),
      get_spending_history: tool({
        description: "查询当前 Agent 钱包消费/支付记录（最近若干笔机器支付）。",
        inputSchema: z.object({
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .default(20)
            .describe("返回最近多少条记录，默认 20"),
        }),
        execute: async ({ limit }) => {
          const payments = await listAgentPayments(admin, agent.id, limit);
          return {
            count: payments.length,
            payments: payments.map((pay) => ({
              id: pay.id,
              amount: pay.amount,
              asset: pay.asset,
              chain: pay.chain,
              recipient: pay.recipient,
              merchant: pay.merchant,
              resource: pay.resource,
              status: pay.status,
              provider: pay.provider,
              createdAt: pay.createdAt,
              failureReason: pay.failureReason,
            })),
          };
        },
      }),
    },
  };
}

/**
 * Streams a DeepSeek chat reply via Vercel AI SDK (UI message stream).
 * @param admin - Supabase admin
 * @param agentId - Agent id
 * @param ownerAddress - Owner wallet
 * @param messages - UI messages from useChat
 * @returns Streaming Response for the web client
 */
export async function createDeveloperAgentChatResponse(
  admin: SupabaseClient,
  agentId: string,
  ownerAddress: string,
  messages: UIMessage[],
): Promise<Response> {
  const env = getEnv();
  const apiKey = env.deepseekApiKey || env.openaiApiKey;
  if (!apiKey) {
    return Response.json(
      { error: "DeepSeek API key is not configured" },
      { status: 503 },
    );
  }

  const { tools } = await buildAgentTools(admin, agentId, ownerAddress);
  const rawBase = env.llmBaseUrl.replace(/\/$/, "");
  const baseURL = rawBase.endsWith("/v1") ? rawBase : `${rawBase}/v1`;
  const deepseek = createDeepSeek({
    apiKey,
    baseURL,
  });

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: deepseek.chat(env.llmModel || "deepseek-chat"),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(6),
    temperature: 0.3,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => (error instanceof Error ? error.message : String(error)),
  });
}
