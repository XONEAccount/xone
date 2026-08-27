import { Hono } from "hono";
import { getSupabaseConsole, getSupabaseWallet } from "../lib/supabase.js";
import type { AdminAuthVariables } from "../middleware/admin-auth.js";
import { requireAdmin } from "../middleware/admin-auth.js";

export const search = new Hono<{ Variables: AdminAuthVariables }>();

search.use("*", requireAdmin);

/**
 * Fan-out search across wallet profiles, legacy agents, and XOne surfaces.
 */
search.get("/", async (c) => {
  const wallet = getSupabaseWallet();
  const consoleDb = getSupabaseConsole();
  if (!wallet && !consoleDb) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) {
    return c.json({ error: "q must be at least 2 characters" }, 400);
  }

  const like = `%${q}%`;
  const [
    walletProfiles,
    legacyAgents,
    xoneProfiles,
    xoneKeys,
    xoneAgents,
  ] = await Promise.all([
    wallet
      ? wallet
          .from("profiles")
          .select("wallet_address, display_name, created_at")
          .or(`wallet_address.ilike.${like},display_name.ilike.${like}`)
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
    wallet
      ? wallet
          .from("developer_agents")
          .select(
            "id, name, wallet_address, owner_wallet, api_key_prefix, status, created_at",
          )
          .or(
            `name.ilike.${like},wallet_address.ilike.${like},owner_wallet.ilike.${like},api_key_prefix.ilike.${like}`,
          )
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
    consoleDb
      ? consoleDb
          .from("xone_profiles")
          .select("id, email, name, created_at")
          .or(`email.ilike.${like},name.ilike.${like}`)
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
    consoleDb
      ? consoleDb
          .from("xone_api_keys")
          .select("id, user_id, name, token_prefix, status, created_at")
          .or(`name.ilike.${like},token_prefix.ilike.${like},id.ilike.${like}`)
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
    consoleDb
      ? consoleDb
          .from("xone_agents")
          .select(
            "id, name, wallet_address, user_id, status, api_key_id, created_at",
          )
          .or(
            `name.ilike.${like},wallet_address.ilike.${like},id.ilike.${like},api_key_id.ilike.${like}`,
          )
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstError =
    walletProfiles.error ??
    legacyAgents.error ??
    xoneProfiles.error ??
    xoneKeys.error ??
    xoneAgents.error;

  if (firstError) {
    // Partial results are OK when some tables are missing in older DBs.
    console.error("[admin-search]", firstError.message);
  }

  return c.json({
    ok: true,
    q,
    results: {
      walletProfiles: walletProfiles.data ?? [],
      legacyAgents: legacyAgents.data ?? [],
      xoneProfiles: xoneProfiles.data ?? [],
      xoneApiKeys: xoneKeys.data ?? [],
      xoneAgents: xoneAgents.data ?? [],
    },
  });
});
