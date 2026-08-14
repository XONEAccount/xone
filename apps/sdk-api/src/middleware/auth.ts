import { createClient } from "@supabase/supabase-js";
import type { ApiBindings, ApiVariables } from "../env";
import { HttpError } from "../lib/errors";
import { sha256Hex } from "../lib/ids";
import { createServiceClient, type DbApiKey } from "../lib/supabase";
import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";

type Env = { Bindings: ApiBindings; Variables: ApiVariables };

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/**
 * @param supabaseUrl - Project URL
 * @returns Cached JWKS
 */
function jwksFor(supabaseUrl: string) {
  let set = jwksCache.get(supabaseUrl);
  if (!set) {
    set = createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
    );
    jwksCache.set(supabaseUrl, set);
  }
  return set;
}

/**
 * Extracts Bearer token from Authorization header.
 *
 * @param header - Authorization header
 * @returns Token or null
 */
function bearer(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Verifies a Supabase user access token.
 * Order: JWKS → JWT secret → auth.getUser (network, most compatible).
 *
 * @param token - JWT
 * @param env - Bindings
 * @returns Subject + email
 */
async function verifyUserJwt(
  token: string,
  env: ApiBindings,
): Promise<{ userId: string; email: string }> {
  const issuer = `${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1`;

  try {
    const { payload } = await jwtVerify(token, jwksFor(env.SUPABASE_URL), {
      issuer,
      audience: "authenticated",
    });
    const userId = String(payload.sub ?? "");
    if (!userId) throw new Error("missing sub");
    const email =
      typeof payload.email === "string"
        ? payload.email
        : String(
            (payload as { user_metadata?: { email?: string } }).user_metadata
              ?.email ?? "",
          );
    return { userId, email };
  } catch {
    // continue
  }

  if (env.SUPABASE_JWT_SECRET) {
    try {
      const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
      const { payload } = await jwtVerify(token, secret, {
        issuer,
        audience: "authenticated",
      });
      const userId = String(payload.sub ?? "");
      if (!userId) throw new Error("missing sub");
      const email = typeof payload.email === "string" ? payload.email : "";
      return { userId, email };
    } catch {
      // continue
    }
  }

  // Reliable fallback: ask Supabase Auth to validate the JWT.
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new HttpError(401, "Invalid or expired session", "unauthorized");
  }
  return {
    userId: data.user.id,
    email: data.user.email ?? "",
  };
}

/**
 * Requires a Supabase user JWT (console session).
 */
export const requireUser = createMiddleware<Env>(async (c, next) => {
  const token = bearer(c.req.header("Authorization"));
  if (!token) {
    throw new HttpError(
      401,
      "Missing Authorization bearer token",
      "unauthorized",
    );
  }
  const { userId, email } = await verifyUserJwt(token, c.env);
  c.set("userId", userId);
  c.set("userEmail", email);
  await next();
});

/**
 * Requires an XOne API key token (`xone_…`) for SDK calls.
 */
export const requireApiKey = createMiddleware<Env>(async (c, next) => {
  const token =
    bearer(c.req.header("Authorization")) ||
    c.req.header("X-Agent-Token")?.trim() ||
    null;

  if (!token) {
    throw new HttpError(401, "API key token is required", "invalid_api_key");
  }

  const hash = await sha256Hex(token);
  const supabase = createServiceClient(c.env);
  const { data, error } = await supabase
    .from("xone_api_keys")
    .select("*")
    .eq("token_hash", hash)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message, "db_error");
  const key = data as DbApiKey | null;
  if (!key || key.status !== "active") {
    throw new HttpError(401, "Unknown or deleted API key", "invalid_api_key");
  }

  c.set("userId", key.user_id);
  c.set("userEmail", "");
  c.set("apiKeyId", key.id);
  await next();
});
