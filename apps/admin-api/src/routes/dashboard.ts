import { Hono } from "hono";
import { getSupabaseAdmin } from "../lib/supabase.js";
import type { AdminAuthVariables } from "../middleware/admin-auth.js";
import { requireAdmin } from "../middleware/admin-auth.js";

export const dashboard = new Hono<{ Variables: AdminAuthVariables }>();

dashboard.use("*", requireAdmin);

/**
 * Aggregate counts for the ops home screen.
 */
dashboard.get("/stats", async (c) => {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const [profiles, agents, activeAgents, payments, fundings, failedPayments] =
    await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("developer_agents").select("*", { count: "exact", head: true }),
      admin
        .from("developer_agents")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      admin.from("agent_payments").select("*", { count: "exact", head: true }),
      admin.from("agent_fundings").select("*", { count: "exact", head: true }),
      admin
        .from("agent_payments")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed"),
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
    },
  });
});
