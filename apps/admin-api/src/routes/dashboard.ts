import { Hono } from "hono";
import { getSupabaseConsole, getSupabaseWallet } from "../lib/supabase.js";
import type { AdminAuthVariables } from "../middleware/admin-auth.js";
import { requireAdmin } from "../middleware/admin-auth.js";

export const dashboard = new Hono<{ Variables: AdminAuthVariables }>();

dashboard.use("*", requireAdmin);

type DayPoint = {
  date: string;
  value: number;
};

/**
 * Builds UTC YYYY-MM-DD for a Date.
 * @param d - Date
 */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Last N calendar days (UTC), oldest → newest.
 * @param days - Window length
 */
function lastNDays(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(dayKey(d));
  }
  return out;
}

/**
 * Fills a day series with zeros for missing days.
 * @param days - Ordered day keys
 * @param byDay - Sparse day → value map
 */
function fillSeries(days: string[], byDay: Map<string, number>): DayPoint[] {
  return days.map((date) => ({ date, value: byDay.get(date) ?? 0 }));
}

/**
 * Overview charts: wallet users, console users, payment amount, API keys (last 30 days).
 */
dashboard.get("/stats", async (c) => {
  const wallet = getSupabaseWallet();
  const consoleDb = getSupabaseConsole();
  if (!wallet && !consoleDb) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const days = lastNDays(30);
  const since = `${days[0]}T00:00:00.000Z`;

  const [
    profilesRes,
    paymentsRes,
    xoneProfilesRes,
    xoneKeysRes,
    profilesTotal,
    xoneProfilesTotal,
    xoneKeysTotal,
  ] = await Promise.all([
    wallet
      ? wallet.from("profiles").select("created_at").gte("created_at", since)
      : Promise.resolve({ data: [], error: null }),
    wallet
      ? wallet
          .from("agent_payments")
          .select("amount, created_at, status")
          .gte("created_at", since)
      : Promise.resolve({ data: [], error: null }),
    consoleDb
      ? consoleDb.from("xone_profiles").select("created_at").gte("created_at", since)
      : Promise.resolve({ data: [], error: null }),
    consoleDb
      ? consoleDb.from("xone_api_keys").select("created_at, status").gte("created_at", since)
      : Promise.resolve({ data: [], error: null }),
    wallet
      ? wallet.from("profiles").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: 0, error: null }),
    consoleDb
      ? consoleDb.from("xone_profiles").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: 0, error: null }),
    consoleDb
      ? consoleDb.from("xone_api_keys").select("*", { count: "exact", head: true })
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (profilesRes.error) return c.json({ error: profilesRes.error.message }, 500);
  if (paymentsRes.error) return c.json({ error: paymentsRes.error.message }, 500);

  const walletUsersByDay = new Map<string, number>();
  for (const row of profilesRes.data ?? []) {
    const key = String(row.created_at ?? "").slice(0, 10);
    if (!key) continue;
    walletUsersByDay.set(key, (walletUsersByDay.get(key) ?? 0) + 1);
  }

  const paymentAmountByDay = new Map<string, number>();
  let paymentAmountTotal = 0;
  for (const row of paymentsRes.data ?? []) {
    const key = String(row.created_at ?? "").slice(0, 10);
    if (!key) continue;
    const amount = Number(row.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    // Count confirmed/submitted-style successes; still include all non-failed for ops trend.
    if (row.status === "failed" || row.status === "rejected" || row.status === "cancelled") {
      continue;
    }
    paymentAmountByDay.set(key, (paymentAmountByDay.get(key) ?? 0) + amount);
    paymentAmountTotal += amount;
  }

  const consoleUsersByDay = new Map<string, number>();
  for (const row of xoneProfilesRes.data ?? []) {
    const key = String(row.created_at ?? "").slice(0, 10);
    if (!key) continue;
    consoleUsersByDay.set(key, (consoleUsersByDay.get(key) ?? 0) + 1);
  }

  const apiKeysByDay = new Map<string, number>();
  for (const row of xoneKeysRes.data ?? []) {
    const key = String(row.created_at ?? "").slice(0, 10);
    if (!key) continue;
    apiKeysByDay.set(key, (apiKeysByDay.get(key) ?? 0) + 1);
  }

  const walletUsers = fillSeries(days, walletUsersByDay);
  const consoleUsers = fillSeries(days, consoleUsersByDay);
  const paymentAmount = fillSeries(days, paymentAmountByDay);
  const apiKeys = fillSeries(days, apiKeysByDay);

  return c.json({
    ok: true,
    windowDays: 30,
    since,
    charts: {
      walletUsers: {
        total: profilesTotal.error ? 0 : (profilesTotal.count ?? 0),
        series: walletUsers,
      },
      consoleUsers: {
        total: xoneProfilesTotal.error ? 0 : (xoneProfilesTotal.count ?? 0),
        series: consoleUsers,
      },
      paymentAmount: {
        total: paymentAmountTotal,
        series: paymentAmount,
      },
      apiKeys: {
        total: xoneKeysTotal.error ? 0 : (xoneKeysTotal.count ?? 0),
        series: apiKeys,
      },
    },
  });
});
