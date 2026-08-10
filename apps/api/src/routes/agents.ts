import { Hono } from "hono";
import { agentChatSchema } from "@wallet/schemas";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { chatWithDeepseek } from "../services/llm/deepseek.js";

const agents = new Hono<{ Variables: AuthVariables }>();

agents.use("*", requireAuth);

/**
 * Chat endpoint backed by DeepSeek.
 * Financial actions must never be implied as executed from this response.
 */
agents.post("/chat", async (c) => {
  const body = await c.req.json();
  const parsed = agentChatSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid chat payload", details: parsed.error.flatten() }, 400);
  }

  const sessionId = parsed.data.sessionId ?? crypto.randomUUID();

  try {
    const reply = await chatWithDeepseek([
      { role: "user", content: parsed.data.message },
    ]);

    return c.json({
      sessionId,
      reply,
      actions: [],
      provider: "deepseek",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LLM request failed";
    console.error("[agents/chat]", message);
    return c.json(
      {
        sessionId,
        error: "助手暂时不可用，请稍后重试。",
        details: message,
      },
      502,
    );
  }
});

export { agents };
