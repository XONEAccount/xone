import { Hono } from "hono";
import { getSupabaseConsole, getSupabaseWallet } from "../lib/supabase.js";
import type { AdminAuthVariables } from "../middleware/admin-auth.js";
import { requireAdmin } from "../middleware/admin-auth.js";

export const dashboard = new Hono<{ Variables: AdminAuthVariables }>();

dashboard.use("*", requireAdmin);

/**
 * Aggregate counts for the ops home screen (wallet + console projects).
 */
dashboard.get("/stats", async (c) => {
  const wallet = getSupabaseWallet();
  const consoleDb = getSupabaseConsole();
  if (!wallet && !consoleDb) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const [
    profiles,
    agents,
    activeAgents,
    payments,
    fundings,
    failedPayments,
    xoneProfiles,
    xoneAgents,
    xoneActiveAgents,
    xoneKeys,
    xoneHistory,
  ] = await Promise.all([
    wallet
      ? wallet.from("profiles").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: 0, error: null }),
    wallet
      ? wallet.from("developer_agents").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: 0, error: null }),
    wallet
      ? wallet
          .from("developer_agents")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
      : Promise.resolve({ count: 0, error: null }),
    wallet
      ? wallet.from("agent_payments").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: 0, error: null }),
    wallet
      ? wallet.from("agent_fundings").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: 0, error: null }),
    wallet
      ? wallet
          .from("agent_payments")
          .select("*", { count: "exact", head: true })
          .eq("status", "failed")
      : Promise.resolve({ count: 0, error: null }),
    consoleDb
      ? consoleDb.from("xone_profiles").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: 0, error: null }),
    consoleDb
      ? consoleDb.from("xone_agents").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: 0, error: null }),
    consoleDb
      ? consoleDb
          .from("xone_agents")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
      : Promise.resolve({ count: 0, error: null }),
    consoleDb
      ? consoleDb
          .from("xone_api_keys")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
      : Promise.resolve({ count: 0, error: null }),
    consoleDb
      ? consoleDb.from("xone_agent_history").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: 0, error: null }),
  ]);

  const firstError =
    profiles.error ??
    agents.error ??
    activeAgents.error ??
    payments.error ??
    fundings.error ??
    failedPayments.error;

  if (firstError) {
    return c.json({ error: firstError.message }, 500);
  }

  return c.json({
    ok: true,
    stats: {
      profiles: profiles.count ?? 0,
      agents: agents.count ?? 0,
      activeAgents: activeAgents.count ?? 0,
      payments: payments.count ?? 0,
      fundings: fundings.count ?? 0,
      failedPayments: failedPayments.count ?? 0,
      xoneProfiles: xoneProfiles.error ? 0 : (xoneProfiles.count ?? 0),
      xoneAgents: xoneAgents.error ? 0 : (xoneAgents.count ?? 0),
      xoneActiveAgents: xoneActiveAgents.error
        ? 0
        : (xoneActiveAgents.count ?? 0),
      xoneApiKeys: xoneKeys.error ? 0 : (xoneKeys.count ?? 0),
      xoneHistory: xoneHistory.error ? 0 : (xoneHistory.count ?? 0),
    },
  });
});
