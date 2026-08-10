import type { ConnectedAgent } from "@/stores/a2a";

export type AgentIntent = {
  agentId: string;
  title: string;
  /** Optional amount parsed from user text; otherwise agent quotes dynamically. */
  amountHint: number | null;
  routeHint: string | null;
};

/**
 * Maps natural-language purchase intent to a connected A2A agent.
 * @param message - User chat message
 * @returns Matched intent, or null when no agent should be invoked
 */
export function matchAgentIntent(message: string): AgentIntent | null {
  const text = message.trim();
  if (!text) return null;

  const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:eth|ETH|usdc|刀|元|块)?/);
  const amountHint = amountMatch?.[1] ? Number(amountMatch[1]) : null;

  if (/车票|火车票|高铁|动车|买票|订票|出行/.test(text)) {
    const fromTo = text.match(/([\u4e00-\u9fa5]{2,8})\s*(?:到|至|-)\s*([\u4e00-\u9fa5]{2,8})/);
    const routeHint = fromTo ? `${fromTo[1]} → ${fromTo[2]}` : null;
    return {
      agentId: "agent-rail",
      title: routeHint ? `车票 · ${routeHint}` : "车票预订",
      amountHint: Number.isFinite(amountHint) ? amountHint : null,
      routeHint,
    };
  }

  if (/酒店|住宿|订房|宾馆/.test(text)) {
    return {
      agentId: "agent-hotel",
      title: "酒店预订",
      amountHint: Number.isFinite(amountHint) ? amountHint : null,
      routeHint: null,
    };
  }

  if (/外卖|餐饮|吃饭|点餐/.test(text)) {
    return {
      agentId: "agent-food",
      title: "餐饮外卖",
      amountHint: Number.isFinite(amountHint) ? amountHint : null,
      routeHint: null,
    };
  }

  return null;
}

/**
 * Simulates a remote agent returning a dynamic quote in ETH.
 * @param agent - Target connected agent
 * @param amountHint - Optional amount from user text
 * @returns Quoted ETH amount
 */
export function quoteFromAgent(agent: ConnectedAgent, amountHint: number | null): number {
  if (amountHint != null && Number.isFinite(amountHint) && amountHint > 0) {
    // Bare integers like "80" are treated as fiat-scale demo hints → tiny ETH.
    const ethHint = amountHint >= 1 ? amountHint / 10_000 : amountHint;
    return Number(ethHint.toFixed(6));
  }

  const floor = Math.min(0.01, agent.maxSinglePayment * 0.15);
  const span = Math.max(agent.maxSinglePayment * 0.55 - floor, 0.005);
  return Number((floor + Math.random() * span).toFixed(6));
}
