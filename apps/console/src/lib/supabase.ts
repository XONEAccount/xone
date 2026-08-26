import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Whether the console is configured for Supabase Auth + remote API.
 *
 * @returns True when URL + anon key are set
 */
export function isRemoteAuthEnabled(): boolean {
  return Boolean(url && anon);
}

let client: SupabaseClient | null = null;

/**
 * Browser Supabase client (anon key). Null when env is missing (mock mode).
 *
 * @returns Client or null
 */
export function getSupabase(): SupabaseClient | null {
  if (!isRemoteAuthEnabled()) return null;
  if (!client) {
    client = createClient(url!, anon!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
