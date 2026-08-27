import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

type ClientKind = "console" | "wallet";

const clients: Partial<Record<ClientKind, SupabaseClient>> = {};
const fingerprints: Partial<Record<ClientKind, string>> = {};

/**
 * Builds a service-role Supabase client, or null when misconfigured.
 * @param url - Project URL
 * @param serviceRoleKey - Service role key
 * @param anonKey - Anon key (used only to refuse identical service role)
 * @param kind - Cache slot
 * @returns Client or null
 */
function getOrCreateClient(
  url: string,
  serviceRoleKey: string,
  anonKey: string,
  kind: ClientKind,
): SupabaseClient | null {
  if (!url || !serviceRoleKey) return null;

  if (anonKey && serviceRoleKey === anonKey) {
    console.error(
      `[supabase:${kind}] service role key equals anon key — refusing client`,
    );
    return null;
  }

  const fingerprint = `${url}:${serviceRoleKey.slice(0, 12)}`;
  if (!clients[kind] || fingerprints[kind] !== fingerprint) {
    clients[kind] = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    fingerprints[kind] = fingerprint;
  }

  return clients[kind] ?? null;
}

/**
 * Console / XOne Supabase (API keys, agent wallets, console users, audit).
 * @returns Service-role client, or null when not configured
 */
export function getSupabaseConsole(): SupabaseClient | null {
  const env = getEnv();
  return getOrCreateClient(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
    env.supabaseAnonKey,
    "console",
  );
}

/**
 * Consumer wallet Supabase (profiles, legacy developer agents, payments).
 * Uses WALLET_SUPABASE_* when set; otherwise falls back to console project.
 * @returns Service-role client, or null when not configured
 */
export function getSupabaseWallet(): SupabaseClient | null {
  const env = getEnv();
  if (env.walletSupabaseUrl && env.walletSupabaseServiceRoleKey) {
    return getOrCreateClient(
      env.walletSupabaseUrl,
      env.walletSupabaseServiceRoleKey,
      env.walletSupabaseAnonKey,
      "wallet",
    );
  }
  return getSupabaseConsole();
}

/**
 * @deprecated Prefer {@link getSupabaseConsole} or {@link getSupabaseWallet}.
 * Alias of console client for existing call sites.
 * @returns Service-role console client
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  return getSupabaseConsole();
}
