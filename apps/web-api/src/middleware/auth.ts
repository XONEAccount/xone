import type { Context, Next } from "hono";
import { createUserSupabase } from "../lib/supabase.js";

export type AuthVariables = {
  userId: string;
  accessToken: string;
};

/**
 * Requires a valid Bearer token and attaches userId to the context.
 * In local scaffold mode without Supabase, falls back to a demo user.
 */
export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  const allowDemo = process.env.ALLOW_DEMO_AUTH === "true";

  if (!token || token === "demo") {
    // Local scaffold / demo mode before real Supabase Auth sessions exist.
    if (allowDemo) {
      c.set("userId", "00000000-0000-4000-8000-000000000001");
      c.set("accessToken", token ?? "demo");
      await next();
      return;
    }

    return c.json({ error: "Unauthorized" }, 401);
  }

  const supabase = createUserSupabase(token);
  if (!supabase) {
    if (allowDemo) {
      c.set("userId", "00000000-0000-4000-8000-000000000001");
      c.set("accessToken", token);
      await next();
      return;
    }
    return c.json({ error: "Auth provider not configured" }, 503);
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    if (allowDemo) {
      c.set("userId", "00000000-0000-4000-8000-000000000001");
      c.set("accessToken", token);
      await next();
      return;
    }
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userId", data.user.id);
  c.set("accessToken", token);
  await next();
}
