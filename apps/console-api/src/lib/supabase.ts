import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ApiBindings } from "../env";

/**
 * Service-role Supabase client (bypasses RLS). Worker-only.
 *
 * @param env - Worker bindings
 * @returns Supabase client
 */
export function createServiceClient(env: ApiBindings): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export type DbApiKey = {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  token_prefix: string;
  status: "active" | "deleted";
  created_at: string;
};

export type DbAgent = {
  id: string;
  user_id: string;
  api_key_id: string;
  name: string;
  chain: "base" | "base-sepolia" | "solana" | "polygon" | "arbitrum";
  currency: string;
  default_amount: string;
  daily_limit: number;
  per_transaction: number;
  remaining_daily: number;
  /** UTC day key `YYYY-MM-DD` for daily budget reset. */
  daily_period: string;
  /** Legacy column; unused (spend gated by daily/per-tx limits only). */
  balance: number;
  wallet_address: string;
  wallet_private_key_enc: string;
  wallet_family: "evm" | "solana";
  status: "active" | "paused" | "exhausted" | "deleted";
  allowed_hosts: string[];
  allowed_payees: string[];
  created_at: string;
  updated_at: string;
};

export type DbHistory = {
  id: string;
  agent_id: string;
  user_id: string;
  type: string;
  amount: number | null;
  currency: string | null;
  to_address: string | null;
  url: string | null;
  tx_hash: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};
