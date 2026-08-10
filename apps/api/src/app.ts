import { Hono } from "hono";
import { cors } from "hono/cors";
import { applyWorkerBindings, type WorkerBindings } from "./lib/cf-env.js";
import { getEnv } from "./lib/env.js";
import { a2a } from "./routes/a2a.js";
import { agents } from "./routes/agents.js";
import { auth } from "./routes/auth.js";
import { payments } from "./routes/payments.js";
import { transactions } from "./routes/transactions.js";
import { wallets } from "./routes/wallets.js";

type AppEnv = {
  Bindings: WorkerBindings;
};

/**
 * Decodes the JWT `role` claim for health diagnostics (no secret leakage).
 * @param jwt - Supabase API key JWT
 * @returns Role string, or null when missing/invalid
 */
function decodeJwtRole(jwt: string): string | null {
  if (!jwt) return null;
  try {
    const part = jwt.split(".")[1];
    if (!part) return null;
    const padded = part + "=".repeat((4 - (part.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { role?: string };
    return payload.role ?? null;
  } catch {
    return "invalid";
  }
}

/**
 * Extracts hostname from a URL for health diagnostics.
 * @param url - Absolute URL
 * @returns Hostname or empty string
 */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/**
 * Creates the Hono application used by both Node (local) and Cloudflare Workers.
 * @returns Configured Hono app
 */
export function createApp() {
  const app = new Hono<AppEnv>();

  // On Workers, secrets live on c.env — mirror them into process.env for getEnv().
  app.use("*", async (c, next) => {
    applyWorkerBindings(c.env);
    await next();
  });

  app.use("*", async (c, next) => {
    const env = getEnv();
    return cors({
      origin: env.corsOrigin === "*" ? "*" : env.corsOrigin,
      allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })(c, next);
  });

  app.get("/health", (c) => {
    const env = getEnv();
    const serviceRole = decodeJwtRole(env.supabaseServiceRoleKey);
    const anonRole = decodeJwtRole(env.supabaseAnonKey);
    return c.json({
      ok: true,
      service: "wallet-api",
      supabase: {
        configured: Boolean(env.supabaseUrl && env.supabaseServiceRoleKey),
        urlHost: hostOf(env.supabaseUrl),
        serviceRole,
        anonRole,
        anonEqualsServiceRole:
          Boolean(env.supabaseAnonKey) &&
          env.supabaseAnonKey === env.supabaseServiceRoleKey,
      },
    });
  });

  app.route("/api/auth", auth);
  app.route("/api/wallets", wallets);
  app.route("/api/transactions", transactions);
  app.route("/api/a2a", a2a);
  app.route("/api/payments", payments);
  app.route("/api/agents", agents);

  app.notFound((c) => c.json({ error: "Not found" }, 404));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}

export type WalletApp = ReturnType<typeof createApp>;
