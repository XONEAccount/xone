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
import { payX402Merchant, paymentRequiresConfirmation, quoteX402Merchant, withMerchantQuery } from "./x402-merchant-pay.js";

export type AssistantX402Service = {
  id: string;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
};

type AssistantLocale = "en" | "zh";

/**
 * Builds the system prompt so replies match the UI locale.
 * @param locale - `en` | `zh` from the web client
 */
function buildSystemPrompt(locale: AssistantLocale): string {
  if (locale === "en") {
    return `You are the X-ONE wallet assistant. Reply in clear, concise English. All user-facing text (answers, picker questions, reasons) must be English even if tool payloads are Chinese.

Workflow (must follow):
1. First write brief reasoning inside <think>…</think>: user intent, matching x402 / Agent services, available Agent wallets.
2. When payment / balance / spendability is involved:
   - Always call list_context first for the latest status, allowance, onChainBalance (do not reuse stale conclusions from chat history).
   - Wallets with status=paused or deleted cannot pay.
   - Only wallets with status=active AND allowance>0 AND onChainOk=true AND onChainBalance>0 can pay.
   - If onChainOk=false, do not say the balance is 0; say on-chain balance is temporarily unavailable and suggest refresh/retry.
   - Never invent balances; only use list_context / pay_x402 returns.
3. If the user wants a paid x402 / Agent capability:
   - Pick candidates from the enabled catalog (X402 List + Agent List).
   - Bocha Search: prefer for facts, news, web search; when calling pay_x402 always pass query=the user question.
   - If exactly one suitable service: proceed to the next step.
   - If multiple fit: must call request_x402_choice and wait (do not guess).
4. Agent wallets:
   - Only show spendable wallets (see rule 2).
   - If exactly one spendable wallet: you may use it directly.
   - If multiple: must call request_wallet_choice and wait.
5. After the user chooses, call pay_x402:
   - Search services must include query.
   - The system quotes first; under perTransaction / remaining dailyLimit it auto-pays.
   - Over the limit waits for manual confirmation.
6. Never invent payment results; only use tool returns.
7. Never ask for private keys or API keys.

Use valid Markdown in the reply.`;
  }

  return `你是 X-ONE 钱包助手，用简洁中文回答。

工作流（必须遵守）：
1. 先在 <think>…</think> 中写出简短思考：用户意图、可匹配的 x402 / Agent 服务、可用 Agent 钱包。
2. 涉及付费 / 钱包是否有钱 / 是否可用时：
   - 必须先调用 list_context 获取【最新】status、allowance、onChainBalance（不要用历史对话里的旧结论）。
   - status=paused 或 deleted 的钱包不能支付。
   - 只有 status=active 且 allowance>0 且 onChainOk=true 且 onChainBalance>0 的钱包才能支付。
   - onChainOk=false 时不要说「余额为 0」，应说明暂时读不到链上余额，请用户刷新或稍后重试。
   - 禁止编造余额；只能依据 list_context / pay_x402 返回值。
3. 若用户要调用付费 x402 / Agent 能力：
   - 从「已启用」的目录中判断候选（含 X402 List 与 Agent List）。
   - 博查搜索（Bocha Search）：用户问事实、新闻、联网检索类问题时优先选用；调用 pay_x402 时必须传 query=用户问题。
   - 若只有 1 个合适服务：直接进入下一步。
   - 若有多个都能满足：必须调用 request_x402_choice，等待用户选择（不要自己猜）。
4. Agent 钱包：
   - 只向用户展示可支付钱包（见第 2 条）。
   - 若只有 1 个可用钱包：可直接用于支付。
   - 若有多个：必须调用 request_wallet_choice，等待用户选择。
5. 用户选择完成后，调用 pay_x402：
   - 搜索类服务务必带 query。
   - 系统会先报价；若金额未超过该钱包的 perTransaction / 剩余 dailyLimit，将自动付款。
   - 若超过限额，会等待用户手动确认后再付。
6. 不要编造支付结果；只能依据工具返回。
7. 不要索要私钥或 API Key。

输出用合法 Markdown。`;
}

type WalletSnapshot = {
  id: string;
  name: string;
  walletAddress: string;
  chain: string;
  asset: string;
  status: string;
  allowance: number;
  dailyLimit: number;
  perTransaction: number;
  maxAmount: number;
  maxSinglePayment: number;
  spentAmount: number;
  remainingCap: number;
  onChainBalance: string;
  onChainOk: boolean;
  canPay: boolean;
};

/**
 * Loads every developer agent with a fresh on-chain balance snapshot.
 * @param admin - Supabase admin
 * @param ownerAddress - Owner wallet
 */
async function loadWalletSnapshots(
  admin: SupabaseClient,
  ownerAddress: string,
): Promise<WalletSnapshot[]> {
  const rows = await listDeveloperAgents(admin, ownerAddress);
  return Promise.all(
    rows.map(async (w) => {
      const bal = await getAgentBalance(w);
      const onChainNum = Number(bal.onChainBalance);
      const canPay =
        w.status === "active" &&
        bal.allowance > 0 &&
        bal.onChainOk &&
        Number.isFinite(onChainNum) &&
        onChainNum > 0;
      return {
        id: w.id,
        name: w.name,
        walletAddress: w.walletAddress,
        chain: w.chain,
        asset: w.asset,
        status: w.status,
        allowance: bal.allowance,
        dailyLimit: w.dailyLimit,
        perTransaction: w.perTransaction,
        maxAmount: w.maxAmount,
        maxSinglePayment: w.maxSinglePayment,
        spentAmount: bal.spentAmount,
        remainingCap: bal.remainingCap,
        onChainBalance: bal.onChainBalance,
        onChainOk: bal.onChainOk,
        canPay,
      };
    }),
  );
}

/**
 * Streams the main 对话 assistant (DeepSeek + x402 routing tools + HITL pickers).
 * @param admin - Supabase admin
 * @param ownerAddress - Owner wallet
 * @param messages - UI messages from useChat
 * @param x402Services - Client catalog (Agent List)
 * @param locale - UI locale for reply language
 */
export async function createAssistantChatResponse(
  admin: SupabaseClient,
  ownerAddress: string,
  messages: UIMessage[],
  x402Services: AssistantX402Service[],
  locale: AssistantLocale = "zh",
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
  const walletSnapshots = await loadWalletSnapshots(admin, ownerAddress);
  const spendableWallets = walletSnapshots.filter((w) => w.canPay);

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
    {
      note: "Fresh snapshot for this request. Prefer list_context before claiming balances.",
      all: walletSnapshots.map((w) => ({
        id: w.id,
        name: w.name,
        status: w.status,
        chain: w.chain,
        asset: w.asset,
        allowance: w.allowance,
        dailyLimit: w.dailyLimit,
        perTransaction: w.perTransaction,
        remainingCap: w.remainingCap,
        onChainBalance: w.onChainBalance,
        onChainOk: w.onChainOk,
        canPay: w.canPay,
      })),
      spendable: spendableWallets.map((w) => ({
        id: w.id,
        name: w.name,
        onChainBalance: w.onChainBalance,
        allowance: w.allowance,
        remainingCap: w.remainingCap,
      })),
    },
    null,
    2,
  );

  const tools = {
    list_context: tool({
      description:
        "刷新并列出已启用 x402 服务 + 全部 Agent 钱包的最新 status / allowance / 链上余额。付费或判断是否有钱前必须调用。",
      inputSchema: z.object({}),
      execute: async () => {
        const fresh = await loadWalletSnapshots(admin, ownerAddress);
        return {
          x402Services: enabledServices,
          wallets: fresh,
          spendableWalletIds: fresh.filter((w) => w.canPay).map((w) => w.id),
        };
      },
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
        "当用户有多个可支付 Agent 钱包时，向用户展示列表并等待选择。只传 canPay=true 的候选（id / name / dailyLimit），不要暴露地址。",
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
          .min(1)
          .max(20),
      }),
    }),

    pay_x402: tool({
      description:
        "使用指定 Agent 钱包支付指定 x402 / Agent URL（须为目录中已启用条目）。搜索类服务（如 Bocha）必须传 query。未超限额时自动执行；超限额需用户确认。",
      inputSchema: z.object({
        x402Id: z.string().describe("目录中的服务 id"),
        agentId: z.string().describe("Developer Agent 钱包 id"),
        query: z
          .string()
          .min(1)
          .max(500)
          .optional()
          .describe("搜索类服务的用户问题（Bocha Search 必填）"),
        idempotencyKey: z
          .string()
          .min(8)
          .max(128)
          .optional()
          .describe("重试时复用同一 key"),
      }),
      needsApproval: async ({ x402Id, agentId, query }) => {
        const service = enabledServices.find((s) => s.id === x402Id);
        if (!service) return true;

        const agentRow = await getDeveloperAgentRowForOwner(
          admin,
          agentId,
          ownerAddress,
        );
        if (!agentRow) return true;

        const agent = toDeveloperAgent(agentRow);
        const merchantUrl = withMerchantQuery(service.url, query);
        const quote = await quoteX402Merchant(merchantUrl);
        if (!quote) return true;
        return paymentRequiresConfirmation(quote.amount, agent);
      },
      execute: async ({ x402Id, agentId, query, idempotencyKey }) => {
        const service = enabledServices.find((s) => s.id === x402Id);
        if (!service) {
          return { ok: false, error: "x402 服务未找到或未启用" };
        }

        if (/bocha|search/i.test(service.id + service.name) && !query?.trim()) {
          return {
            ok: false,
            error: "Bocha Search 需要 query（用户问题）",
          };
        }

        const agentRow = await getDeveloperAgentRowForOwner(
          admin,
          agentId,
          ownerAddress,
        );
        if (!agentRow) {
          return { ok: false, error: "Agent 钱包未找到" };
        }
        if (agentRow.status !== "active") {
          return {
            ok: false,
            error: `Agent 钱包当前状态为 ${agentRow.status}，无法支付（需 active）`,
          };
        }

        const balance = await getAgentBalance(toDeveloperAgent(agentRow));
        if (!balance.onChainOk) {
          return {
            ok: false,
            error: "暂时读不到链上余额，请稍后重试（不要当成余额为 0）",
            wallet: {
              id: balance.walletAddress,
              status: agentRow.status,
              allowance: balance.allowance,
              onChainBalance: balance.onChainBalance,
              onChainOk: false,
            },
          };
        }
        if (Number(balance.onChainBalance) <= 0) {
          return {
            ok: false,
            error: "该 Agent 链上 USDC 余额为 0，请先充值后再支付",
            wallet: {
              id: balance.walletAddress,
              status: agentRow.status,
              allowance: balance.allowance,
              onChainBalance: balance.onChainBalance,
              onChainOk: true,
            },
          };
        }

        const merchantUrl = withMerchantQuery(service.url, query);

        const result = await payX402Merchant(admin, agentRow, {
          merchantUrl,
          idempotencyKey: idempotencyKey ?? crypto.randomUUID(),
        });

        if (!result.ok) {
          return {
            ok: false,
            error: result.error,
            service,
            query: query ?? null,
            wallet: {
              id: balance.walletAddress,
              status: agentRow.status,
              allowance: balance.allowance,
              onChainBalance: balance.onChainBalance,
              onChainOk: balance.onChainOk,
            },
          };
        }

        return {
          ok: true,
          service: { id: service.id, name: service.name, url: merchantUrl },
          query: query ?? null,
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

  const catalogHeading =
    locale === "en" ? "## Enabled x402 catalog" : "## 已启用 x402 目录";
  const walletsHeading =
    locale === "en"
      ? "## Agent wallet snapshot (at request start; call list_context again before paying)"
      : "## Agent 钱包快照（本请求开始时；付费前请再 list_context）";

  const result = streamText({
    model,
    system: `${buildSystemPrompt(locale)}

${catalogHeading}
${catalogJson}

${walletsHeading}
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
