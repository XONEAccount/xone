import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ApiBindings, ApiVariables } from "./env";
import { HttpError } from "./lib/errors";
import { createServiceClient } from "./lib/supabase";
import { requireUser } from "./middleware/auth";
import { ensureProfile } from "./lib/agents";
import { agentsRoutes } from "./routes/agents";
import { apiKeysRoutes } from "./routes/apiKeys";
import { authRoutes } from "./routes/auth";
import { sdkRoutes } from "./routes/sdk";

type Env = { Bindings: ApiBindings; Variables: ApiVariables };

const app = new Hono<Env>();

app.use("*", async (c, next) => {
  // localhost ↔ 127.0.0.1 are different Origins to the browser.
  const raw = (c.env.CORS_ORIGIN ?? "http://localhost:5180,http://127.0.0.1:5180")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = new Set(raw);
  for (const o of [...allowed]) {
    if (o.includes("localhost")) {
      allowed.add(o.replace("localhost", "127.0.0.1"));
    } else if (o.includes("127.0.0.1")) {
      allowed.add(o.replace("127.0.0.1", "localhost"));
    }
  }

  const corsMiddleware = cors({
    origin: (origin) => {
      if (raw.includes("*")) return origin || "*";
      // Must echo the request Origin exactly, or return undefined to deny.
      if (origin && allowed.has(origin)) return origin;
      // Vite may bump the console port (5180 → 5181…) during local dev.
      if (
        origin &&
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin)
      ) {
        return origin;
      }
      // Cloudflare Pages preview: console + SDK docs/playground
      if (
        origin &&
        /^https:\/\/([a-z0-9-]+\.)?(xone-console|xone-sdk-docs)\.pages\.dev$/i.test(
          origin,
        )
      ) {
        return origin;
      }
      return undefined;
    },
    allowHeaders: [
      "Authorization",
      "Content-Type",
      "X-Agent-Token",
      "Idempotency-Key",
    ],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86400,
  });

  return corsMiddleware(c, next);
});

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message, code: err.code }, err.status as 400);
  }
  console.error(err);
  return c.json({ error: "Internal Server Error", code: "internal" }, 500);
});

app.get("/health", (c) => c.json({ ok: true, service: "xone-api" }));

app.get("/v1/me", requireUser, async (c) => {
  await ensureProfile(c);
  const supabase = createServiceClient(c.env);
  const { data, error } = await supabase
    .from("xone_profiles")
    .select("id, email, name, avatar_url, created_at")
    .eq("id", c.get("userId"))
    .single();

  if (error) throw new HttpError(500, error.message, "db_error");
  return c.json({
    id: data.id,
    email: data.email,
    name: data.name,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
  });
});

app.route("/v1/auth", authRoutes);
app.route("/v1/api-keys", apiKeysRoutes);
app.route("/v1/agents", agentsRoutes);
app.route("/v1/sdk", sdkRoutes);

export default app;
