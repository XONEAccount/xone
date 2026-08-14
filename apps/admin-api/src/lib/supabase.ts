import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

let adminClient: SupabaseClient | null = null;
let adminKeyFingerprint: string | null = null;

/**
 * Returns a Supabase admin client using the service role key.
 * @returns Supabase service-role client, or null when env is not configured
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const env = getEnv();
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return null;
  }

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
