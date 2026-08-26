import { Hono } from "hono";
import type { UIMessage } from "ai";
import {
  agentChatSchema,
  assistantChatSchema,
  assistantChatSessionClearSchema,
  assistantChatSessionQuerySchema,
  assistantChatSessionSaveSchema,
} from "@xone/schemas";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { createAssistantChatResponse } from "../services/agent/assistant-chat.js";
import {
  clearAssistantChatSession,
  getAssistantChatSession,
  saveAssistantChatSession,
} from "../services/agent/assistant-chat-session.js";
import { chatWithDeepseek } from "../services/llm/deepseek.js";

const agents = new Hono<{ Variables: AuthVariables }>();

agents.use("*", requireAuth);

/**
 * Legacy non-streaming chat (kept for compatibility).
 * Prefer POST /api/agents/assistant/chat for tool + HITL flows.
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

/**
 * GET /api/agents/assistant/session?address=0x...
 * Returns persisted UI messages for the wallet (empty when none).
 */
agents.get("/assistant/session", async (c) => {
  const parsed = assistantChatSessionQuerySchema.safeParse({
    address: c.req.query("address"),
  });
  if (!parsed.success) {
    return c.json({ error: "Valid address query param required" }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    const session = await getAssistantChatSession(admin, parsed.data.address);
    return c.json({
      session,
      messages: session?.messages ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed";
    console.error("[agents/assistant/session] get", error);
    return c.json({ error: message }, 500);
  }
});

/**
 * PUT /api/agents/assistant/session — upsert UI messages for the wallet.
 */
agents.put("/assistant/session", async (c) => {
  const parsed = assistantChatSessionSaveSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      400,
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    const session = await saveAssistantChatSession(
      admin,
      parsed.data.ownerAddress,
      parsed.data.messages as UIMessage[],
      parsed.data.title,
    );
    return c.json({ ok: true, session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed";
    console.error("[agents/assistant/session] put", error);
    return c.json({ error: message }, 500);
  }
});

/**
 * DELETE /api/agents/assistant/session — clear persisted chat for the wallet.
 */
agents.delete("/assistant/session", async (c) => {
  const parsed = assistantChatSessionClearSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      400,
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    await clearAssistantChatSession(admin, parsed.data.ownerAddress);
    return c.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clear failed";
    console.error("[agents/assistant/session] delete", error);
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /api/agents/assistant/chat — Vercel AI SDK UI stream.
 * Matches x402 Agent List + developer wallets; HITL pickers for multi-match.
 */
agents.post("/assistant/chat", async (c) => {
  const parsed = assistantChatSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      400,
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) return c.json({ error: "Database not configured" }, 503);

  try {
    return await createAssistantChatResponse(
      admin,
      parsed.data.ownerAddress,
      parsed.data.messages as UIMessage[],
      parsed.data.x402Services,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat failed";
    console.error("[agents/assistant/chat]", error);
    return c.json({ error: message }, 400);
  }
});

export { agents };
