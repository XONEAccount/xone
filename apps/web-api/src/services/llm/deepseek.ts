import { getEnv } from "../../lib/env.js";

type ChatRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: ChatRole;
  content: string;
}

interface DeepseekChatChoice {
  message?: {
    role?: string;
    content?: string | null;
  };
}

interface DeepseekChatResponse {
  choices?: DeepseekChatChoice[];
  error?: {
    message?: string;
  };
}

const SYSTEM_PROMPT = `你是 X-ONE 钱包助手。用简洁中文回答。
你可以解释余额、转账、收款、支付限额、A2A 商家支付等概念。
你不能直接动用资金，也不能声称已经完成链上转账或支付。
若用户要买票/订酒店/点外卖，引导他们用明确需求发起（例如「买上海到杭州的车票」），由已对接 Agent 报价并走策略校验。
不要编造交易哈希、余额或支付结果。`;

/**
 * Calls DeepSeek (OpenAI-compatible) chat completions.
 * @param messages - Conversation messages (without system prompt)
 * @returns Assistant reply text
 * @throws When API key is missing or the provider returns an error
 */
export async function chatWithDeepseek(messages: LlmMessage[]): Promise<string> {
  const env = getEnv();
  const apiKey = env.deepseekApiKey || env.openaiApiKey;

  if (!apiKey) {
    throw new Error("DeepSeek API key is not configured");
  }

  const baseUrl = env.llmBaseUrl.replace(/\/$/, "");
  const endpoint = baseUrl.endsWith("/v1")
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/chat/completions`;

  const response = await globalThis.fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: env.llmModel,
      temperature: 0.4,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });

  const raw = await response.text();
  let data: DeepseekChatResponse = {};
  try {
    data = JSON.parse(raw) as DeepseekChatResponse;
  } catch {
    data = { error: { message: raw || "Invalid JSON from DeepSeek" } };
  }

  if (!response.ok) {
    throw new Error(data.error?.message ?? `DeepSeek request failed (${response.status})`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("DeepSeek returned an empty reply");
  }

  return content;
}
