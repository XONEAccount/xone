import { Hono } from "hono";
import { getAddress, isAddress } from "viem";
import { fetchBaseSepoliaBalances } from "../lib/balances.js";
import { getSupabaseWallet } from "../lib/supabase.js";
import type { AdminAuthVariables } from "../middleware/admin-auth.js";
import { requireAdmin } from "../middleware/admin-auth.js";

export const profiles = new Hono<{ Variables: AdminAuthVariables }>();

profiles.use("*", requireAdmin);

type ProfileRow = {
  wallet_address: string;
  display_name: string | null;
  created_at: string;
  updated_at: string | null;
};

/**
 * Whether display_name is just the default short address label.
 * @param displayName - Stored display name
 * @param address - Wallet address
 */
function isAddressPlaceholder(displayName: string | null, address: string): boolean {
  if (!displayName) return true;
  const normalized = address.toLowerCase();
  const short = `${normalized.slice(0, 6)}…${normalized.slice(-4)}`;
  const asciiShort = `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
  const name = displayName.trim().toLowerCase();
  return name === short || name === asciiShort || name === normalized;
}

/**
 * Lists wallet profiles with legacy-agent / payment / A2A stats.
 */
profiles.get("/", async (c) => {
  const admin = getSupabaseWallet();
  if (!admin) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Number(c.req.query("limit") ?? "50") || 50, 200);
  const offset = Math.max(Number(c.req.query("offset") ?? "0") || 0, 0);

  let query = admin
    .from("profiles")
    .select("wallet_address, display_name, created_at, updated_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.or(`wallet_address.ilike.%${q}%,display_name.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    return c.json({ error: error.message }, 500);
  }

  const rows = (data ?? []) as ProfileRow[];
  const addresses = rows.map((r) => r.wallet_address.toLowerCase());

  const agentsByOwner = new Map<
    string,
    { total: number; active: number; agentIds: string[] }
  >();
  const paymentsByOwner = new Map<string, number>();
  const fundingsByOwner = new Map<string, number>();
  const a2aByOwner = new Map<string, number>();

  if (addresses.length > 0) {
    const [agentsRes, a2aRes] = await Promise.all([
      admin
        .from("developer_agents")
        .select("id, owner_wallet, status")
        .in("owner_wallet", addresses),
      admin.from("a2a_accounts").select("wallet_address, balance").in("wallet_address", addresses),
    ]);

    for (const agent of agentsRes.data ?? []) {
      const owner = String(agent.owner_wallet ?? "").toLowerCase();
      if (!owner) continue;
      const cur = agentsByOwner.get(owner) ?? { total: 0, active: 0, agentIds: [] };
      cur.total += 1;
      if (agent.status === "active") cur.active += 1;
      cur.agentIds.push(String(agent.id));
      agentsByOwner.set(owner, cur);
    }

    for (const row of a2aRes.data ?? []) {
      const addr = String(row.wallet_address ?? "").toLowerCase();
      if (!addr) continue;
      a2aByOwner.set(addr, Number(row.balance ?? 0));
    }

    const agentIds = [...agentsByOwner.values()].flatMap((v) => v.agentIds);
    if (agentIds.length > 0) {
      const [paymentsRes, fundingsRes] = await Promise.all([
        admin.from("agent_payments").select("agent_id").in("agent_id", agentIds),
        admin.from("agent_fundings").select("agent_id").in("agent_id", agentIds),
      ]);

      const agentOwner = new Map<string, string>();
      for (const [owner, stats] of agentsByOwner) {
        for (const id of stats.agentIds) agentOwner.set(id, owner);
      }

      for (const row of paymentsRes.data ?? []) {
        const owner = agentOwner.get(String(row.agent_id));
        if (!owner) continue;
        paymentsByOwner.set(owner, (paymentsByOwner.get(owner) ?? 0) + 1);
      }
      for (const row of fundingsRes.data ?? []) {
        const owner = agentOwner.get(String(row.agent_id));
        if (!owner) continue;
        fundingsByOwner.set(owner, (fundingsByOwner.get(owner) ?? 0) + 1);
      }
    }
  }

  const items = rows.map((row) => {
    const addr = row.wallet_address.toLowerCase();
    const agents = agentsByOwner.get(addr);
    const placeholder = isAddressPlaceholder(row.display_name, addr);
    return {
      wallet_address: row.wallet_address,
      display_name: placeholder ? null : row.display_name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      agents_total: agents?.total ?? 0,
      agents_active: agents?.active ?? 0,
      payments: paymentsByOwner.get(addr) ?? 0,
      fundings: fundingsByOwner.get(addr) ?? 0,
      a2a_balance: a2aByOwner.has(addr) ? a2aByOwner.get(addr)! : null,
    };
  });

  return c.json({
    ok: true,
    items,
    total: count ?? 0,
    limit,
    offset,
  });
});

const AGENT_SELECT =
  "id, owner_wallet, name, description, api_key_prefix, wallet_address, max_amount, max_single_payment, spent_amount, allowance_eth, asset, chain, status, created_at, updated_at";

/**
 * Wallet user detail: profile, on-chain balances, agents, and recent activity.
 */
profiles.get("/:address", async (c) => {
  const admin = getSupabaseWallet();
  if (!admin) {
    return c.json({ error: "Supabase is not configured" }, 503);
  }

  const raw = c.req.param("address").trim();
  if (!isAddress(raw)) {
    return c.json({ error: "Valid wallet address required" }, 400);
  }
  const address = getAddress(raw).toLowerCase();

  const historyLimit = Math.min(Number(c.req.query("limit") ?? "30") || 30, 100);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("wallet_address, display_name, created_at, updated_at")
    .eq("wallet_address", address)
    .maybeSingle();

  if (profileError) {
    return c.json({ error: profileError.message }, 500);
  }
  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const [
    agentsRes,
    a2aRes,
    a2aSettingsRes,
    walletTxRes,
    a2aLedgerRes,
    onChain,
  ] = await Promise.all([
    admin
      .from("developer_agents")
      .select(AGENT_SELECT)
      .eq("owner_wallet", address)
      .order("created_at", { ascending: false }),
    admin
      .from("a2a_accounts")
      .select("wallet_address, balance, updated_at")
      .eq("wallet_address", address)
      .maybeSingle(),
    admin
      .from("a2a_agent_settings")
      .select("agent_id, enabled, max_amount, max_single_payment, spent_amount")
      .eq("wallet_address", address),
    admin
      .from("wallet_transactions")
      .select(
        "id, chain, tx_hash, from_address, to_address, asset, amount, status, direction, created_at, confirmed_at",
      )
      .eq("wallet_address", address)
      .order("created_at", { ascending: false })
      .limit(historyLimit),
    admin
      .from("a2a_ledger")
      .select(
        "id, kind, agent_id, title, counterparty, amount, asset, status, note, created_at",
      )
      .eq("wallet_address", address)
      .order("created_at", { ascending: false })
      .limit(historyLimit),
    fetchBaseSepoliaBalances(address),
  ]);

  if (agentsRes.error) {
    return c.json({ error: agentsRes.error.message }, 500);
  }

  const agents = agentsRes.data ?? [];
  const agentIds = agents.map((a) => String(a.id));
  const agentNameById = new Map(agents.map((a) => [String(a.id), String(a.name)]));

  let payments: unknown[] = [];
  let fundings: unknown[] = [];

  if (agentIds.length > 0) {
    const [paymentsRes, fundingsRes] = await Promise.all([
      admin
        .from("agent_payments")
        .select(
          "id, agent_id, amount, asset, chain, recipient, merchant, status, provider, failure_reason, created_at",
        )
        .in("agent_id", agentIds)
        .order("created_at", { ascending: false })
        .limit(historyLimit),
      admin
        .from("agent_fundings")
        .select("id, agent_id, tx_hash, from_address, amount, created_at")
        .in("agent_id", agentIds)
        .order("created_at", { ascending: false })
        .limit(historyLimit),
    ]);

    payments = (paymentsRes.data ?? []).map((row) => ({
      ...row,
      agent_name: agentNameById.get(String(row.agent_id)) ?? null,
    }));
    fundings = (fundingsRes.data ?? []).map((row) => ({
      ...row,
      agent_name: agentNameById.get(String(row.agent_id)) ?? null,
    }));
  }

  const agentBalanceEntries = await Promise.all(
    agents.slice(0, 20).map(async (agent) => {
      const balances = await fetchBaseSepoliaBalances(String(agent.wallet_address));
      return [String(agent.id), balances] as const;
    }),
  );
  const agentOnChain = Object.fromEntries(agentBalanceEntries);

  const placeholder = isAddressPlaceholder(profile.display_name, address);
  const agentsWithBalances = agents.map((agent) => ({
    ...agent,
    on_chain: agentOnChain[String(agent.id)] ?? [],
  }));

  return c.json({
    ok: true,
    item: {
      wallet_address: profile.wallet_address,
      display_name: placeholder ? null : profile.display_name,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      on_chain: onChain,
      a2a: {
        balance: a2aRes.data ? Number(a2aRes.data.balance ?? 0) : null,
        updated_at: a2aRes.data?.updated_at ?? null,
        settings: a2aSettingsRes.error ? [] : (a2aSettingsRes.data ?? []),
      },
      stats: {
        agents_total: agents.length,
        agents_active: agents.filter((a) => a.status === "active").length,
        payments: Array.isArray(payments) ? payments.length : 0,
        fundings: Array.isArray(fundings) ? fundings.length : 0,
      },
    },
    agents: agentsWithBalances,
    recent: {
      wallet_transactions: walletTxRes.error ? [] : (walletTxRes.data ?? []),
      a2a_ledger: a2aLedgerRes.error ? [] : (a2aLedgerRes.data ?? []),
      payments,
      fundings,
    },
  });
});
