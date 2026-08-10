import type { SupabaseClient } from "@supabase/supabase-js";

export type A2AAgentSetting = {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  maxAmount: number;
  maxSinglePayment: number;
  spentAmount: number;
};

export type A2ALedgerRow = {
  id: string;
  wallet_address: string;
  kind: string;
  agent_id: string | null;
  title: string;
  counterparty: string;
  amount: string;
  asset: string;
  status: string;
  note: string;
  created_at: string;
};

export type A2AAccountView = {
  walletAddress: string;
  balance: number;
  agents: A2AAgentSetting[];
  ledger: A2ALedgerRow[];
};

const DEFAULT_AGENTS: Omit<
  A2AAgentSetting,
  "enabled" | "maxAmount" | "maxSinglePayment" | "spentAmount"
>[] = [
  {
    id: "agent-rail",
    name: "车票预订 Agent",
    category: "出行",
    description: "动态报价购票，价格由对方 Agent 给出，本地只校验限额。",
  },
  {
    id: "agent-hotel",
    name: "酒店预订 Agent",
    category: "住宿",
    description: "根据房型与日期报价，单笔支出受你设置的上限约束。",
  },
  {
    id: "agent-food",
    name: "餐饮外卖 Agent",
    category: "生活",
    description: "订单金额由商户 Agent 返回，超过限额将自动拦截。",
  },
];

const DEFAULT_LIMITS: Record<
  string,
  { enabled: boolean; maxAmount: number; maxSinglePayment: number }
> = {
  "agent-rail": { enabled: true, maxAmount: 0.5, maxSinglePayment: 0.2 },
  "agent-hotel": { enabled: true, maxAmount: 1, maxSinglePayment: 0.4 },
  "agent-food": { enabled: false, maxAmount: 0.2, maxSinglePayment: 0.05 },
};

/**
 * Ensures a profile row exists for FK inserts.
 * @param admin - Supabase admin client
 * @param address - Lowercased wallet address
 */
async function ensureProfile(admin: SupabaseClient, address: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin.from("profiles").upsert(
    {
      wallet_address: address,
      display_name: `${address.slice(0, 6)}…${address.slice(-4)}`,
      updated_at: now,
    },
    { onConflict: "wallet_address" },
  );
  if (error) throw new Error(`Failed to ensure profile: ${error.message}`);
}

/**
 * Ensures an a2a_accounts row exists for the wallet.
 * @param admin - Supabase admin client
 * @param address - Lowercased wallet address
 */
async function ensureAccount(admin: SupabaseClient, address: string): Promise<number> {
  await ensureProfile(admin, address);
  const { data, error } = await admin
    .from("a2a_accounts")
    .select("balance")
    .eq("wallet_address", address)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return Number(data.balance);

  const { data: created, error: insertError } = await admin
    .from("a2a_accounts")
    .insert({ wallet_address: address, balance: 0 })
    .select("balance")
    .maybeSingle();
  if (insertError) throw new Error(insertError.message);
  return Number(created?.balance ?? 0);
}

/**
 * Loads agent catalog merged with per-wallet settings from DB.
 * @param admin - Supabase admin client
 * @param address - Wallet address
 */
async function loadAgents(
  admin: SupabaseClient,
  address: string,
): Promise<A2AAgentSetting[]> {
  const { data, error } = await admin
    .from("a2a_agent_settings")
    .select("agent_id, enabled, max_amount, max_single_payment, spent_amount")
    .eq("wallet_address", address);
  if (error) throw new Error(error.message);

  const byId = new Map(
    (data ?? []).map((row) => [
      row.agent_id as string,
      {
        enabled: Boolean(row.enabled),
        maxAmount: Number(row.max_amount),
        maxSinglePayment: Number(row.max_single_payment),
        spentAmount: Number(row.spent_amount),
      },
    ]),
  );

  return DEFAULT_AGENTS.map((agent) => {
    const defaults = DEFAULT_LIMITS[agent.id]!;
    const saved = byId.get(agent.id);
    return {
      ...agent,
      enabled: saved?.enabled ?? defaults.enabled,
      maxAmount: saved?.maxAmount ?? defaults.maxAmount,
      maxSinglePayment: saved?.maxSinglePayment ?? defaults.maxSinglePayment,
      spentAmount: saved?.spentAmount ?? 0,
    };
  });
}

/**
 * Loads A2A account snapshot for a wallet.
 * @param admin - Supabase admin client
 * @param walletAddress - Wallet address
 */
export async function getA2AAccount(
  admin: SupabaseClient,
  walletAddress: string,
): Promise<A2AAccountView> {
  const address = walletAddress.toLowerCase();
  const balance = await ensureAccount(admin, address);
  const agents = await loadAgents(admin, address);

  const { data: ledger, error } = await admin
    .from("a2a_ledger")
    .select(
      "id, wallet_address, kind, agent_id, title, counterparty, amount, asset, status, note, created_at",
    )
    .eq("wallet_address", address)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  return {
    walletAddress: address,
    balance,
    agents,
    ledger: (ledger ?? []).map((row) => ({
      ...row,
      amount: String(row.amount),
    })) as A2ALedgerRow[],
  };
}

/**
 * Credits A2A spendable balance from the wallet (demo internal ledger).
 * @param admin - Supabase admin client
 * @param walletAddress - Wallet address
 * @param amount - ETH amount to credit
 */
export async function fundA2AAccount(
  admin: SupabaseClient,
  walletAddress: string,
  amount: number,
): Promise<A2AAccountView> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("请输入有效金额");
  }
  const address = walletAddress.toLowerCase();
  const current = await ensureAccount(admin, address);
  const next = Number((current + amount).toFixed(6));
  const now = new Date().toISOString();

  const { error } = await admin
    .from("a2a_accounts")
    .update({ balance: next, updated_at: now })
    .eq("wallet_address", address);
  if (error) throw new Error(error.message);

  const { error: ledgerError } = await admin.from("a2a_ledger").insert({
    wallet_address: address,
    kind: "fund",
    agent_id: null,
    title: "转入 A2A",
    counterparty: "A2A 可支付",
    amount,
    asset: "ETH",
    status: "success",
    note: "从钱包转入 A2A 余额",
  });
  if (ledgerError) throw new Error(ledgerError.message);

  return getA2AAccount(admin, address);
}

/**
 * Updates per-agent spend limits for a wallet.
 */
export async function updateA2AAgentSettings(
  admin: SupabaseClient,
  walletAddress: string,
  agentId: string,
  input: {
    enabled?: boolean;
    maxAmount?: number;
    maxSinglePayment?: number;
  },
): Promise<A2AAccountView> {
  const address = walletAddress.toLowerCase();
  await ensureAccount(admin, address);
  const agents = await loadAgents(admin, address);
  const agent = agents.find((item) => item.id === agentId);
  if (!agent) throw new Error("未找到对接的 Agent");

  const enabled = input.enabled ?? agent.enabled;
  const maxAmount = input.maxAmount ?? agent.maxAmount;
  const maxSinglePayment = input.maxSinglePayment ?? agent.maxSinglePayment;

  if (!Number.isFinite(maxAmount) || maxAmount <= 0) {
    throw new Error("请输入有效的最大金额");
  }
  if (!Number.isFinite(maxSinglePayment) || maxSinglePayment <= 0) {
    throw new Error("请输入有效的最大单笔支出");
  }
  if (maxSinglePayment > maxAmount) {
    throw new Error("单笔支出不能大于最大金额");
  }
  if (maxAmount > 100) {
    throw new Error("最大金额不能超过 100 ETH");
  }

  const { error } = await admin.from("a2a_agent_settings").upsert(
    {
      wallet_address: address,
      agent_id: agentId,
      enabled,
      max_amount: maxAmount,
      max_single_payment: maxSinglePayment,
      spent_amount: agent.spentAmount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "wallet_address,agent_id" },
  );
  if (error) throw new Error(error.message);

  return getA2AAccount(admin, address);
}

/**
 * Settles a dynamic agent payment against A2A balance and policy limits.
 */
export async function settleA2APayment(
  admin: SupabaseClient,
  walletAddress: string,
  agentId: string,
  amount: number,
  title: string,
): Promise<{ ok: boolean; message: string; account: A2AAccountView }> {
  const address = walletAddress.toLowerCase();
  await ensureAccount(admin, address);
  const agents = await loadAgents(admin, address);
  const agent = agents.find((item) => item.id === agentId);
  if (!agent) {
    return {
      ok: false,
      message: "未找到对接的 Agent",
      account: await getA2AAccount(admin, address),
    };
  }
  if (!agent.enabled) {
    return {
      ok: false,
      message: `${agent.name} 未启用`,
      account: await getA2AAccount(admin, address),
    };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      message: "对方报价无效",
      account: await getA2AAccount(admin, address),
    };
  }

  const balance = await ensureAccount(admin, address);

  if (amount > agent.maxSinglePayment) {
    await admin.from("a2a_ledger").insert({
      wallet_address: address,
      kind: "blocked",
      agent_id: agent.id,
      title,
      counterparty: agent.name,
      amount,
      asset: "ETH",
      status: "blocked",
      note: `超过该 Agent 单笔上限 ${agent.maxSinglePayment} ETH`,
    });
    return {
      ok: false,
      message: `已拦截：报价 ${amount} ETH 超过 ${agent.name} 单笔上限`,
      account: await getA2AAccount(admin, address),
    };
  }

  if (agent.spentAmount + amount > agent.maxAmount) {
    await admin.from("a2a_ledger").insert({
      wallet_address: address,
      kind: "blocked",
      agent_id: agent.id,
      title,
      counterparty: agent.name,
      amount,
      asset: "ETH",
      status: "blocked",
      note: `超过该 Agent 最大金额 ${agent.maxAmount} ETH`,
    });
    return {
      ok: false,
      message: `已拦截：将超过 ${agent.name} 最大金额上限`,
      account: await getA2AAccount(admin, address),
    };
  }

  if (amount > balance) {
    await admin.from("a2a_ledger").insert({
      wallet_address: address,
      kind: "failed",
      agent_id: agent.id,
      title,
      counterparty: agent.name,
      amount,
      asset: "ETH",
      status: "failed",
      note: "A2A 余额不足",
    });
    return {
      ok: false,
      message: "A2A 余额不足，请先在设置中转入",
      account: await getA2AAccount(admin, address),
    };
  }

  const nextBalance = Number((balance - amount).toFixed(6));
  const nextSpent = Number((agent.spentAmount + amount).toFixed(6));
  const now = new Date().toISOString();

  const { error: balError } = await admin
    .from("a2a_accounts")
    .update({ balance: nextBalance, updated_at: now })
    .eq("wallet_address", address);
  if (balError) throw new Error(balError.message);

  const { error: agentError } = await admin.from("a2a_agent_settings").upsert(
    {
      wallet_address: address,
      agent_id: agent.id,
      enabled: agent.enabled,
      max_amount: agent.maxAmount,
      max_single_payment: agent.maxSinglePayment,
      spent_amount: nextSpent,
      updated_at: now,
    },
    { onConflict: "wallet_address,agent_id" },
  );
  if (agentError) throw new Error(agentError.message);

  const { error: ledgerError } = await admin.from("a2a_ledger").insert({
    wallet_address: address,
    kind: "pay",
    agent_id: agent.id,
    title,
    counterparty: agent.name,
    amount,
    asset: "ETH",
    status: "success",
    note: "对方 Agent 动态报价已结算",
  });
  if (ledgerError) throw new Error(ledgerError.message);

  return {
    ok: true,
    message: `已向 ${agent.name} 支付 ${amount} ETH（动态报价）`,
    account: await getA2AAccount(admin, address),
  };
}
