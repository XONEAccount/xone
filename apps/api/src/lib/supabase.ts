import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

let adminClient: SupabaseClient | null = null;
let adminKeyFingerprint: string | null = null;

/**
 * Returns a Supabase admin client using the service role key.
 * Prefer request-scoped user clients for RLS-bound reads/writes.
 * @returns Supabase service-role client, or null when env is not configured
 * @throws When the configured service role key looks like an anon key
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const env = getEnv();
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return null;
  }

  // Guard against accidentally uploading the anon key as SERVICE_ROLE.
  if (env.supabaseServiceRoleKey === env.supabaseAnonKey) {
    console.error(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY equals ANON key — refusing admin client",
    );
    return null;
  }

  const fingerprint = `${env.supabaseUrl}:${env.supabaseServiceRoleKey.slice(0, 12)}`;
  if (!adminClient || adminKeyFingerprint !== fingerprint) {
    adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    adminKeyFingerprint = fingerprint;
  }

  return adminClient;
}

/**
 * Creates a Supabase client scoped to the caller's JWT for RLS.
 * @param accessToken - Bearer token from the Authorization header
 * @returns User-scoped Supabase client, or null when env is not configured
 */
export function createUserSupabase(accessToken: string): SupabaseClient | null {
  const env = getEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return null;
  }

  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
