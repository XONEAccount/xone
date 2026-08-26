import type { Context } from "hono";
import type { ApiBindings, ApiVariables } from "../env";
import { decryptSecret, encryptSecret } from "./crypto";
import { HttpError, validateLimits } from "./errors";
import { uuidHex } from "./ids";
import {
  assertPositiveMoney,
  moneyToNumber,
  numberToMoney,
  utcDayKey,
} from "./money";
import {
  createServiceClient,
  type DbAgent,
  type DbHistory,
} from "./supabase";
import { createLocalWallet, normalizeChain, type Chain } from "./wallet";
import {
  beginPayIntent,
  completePayIntent,
  failPayIntent,
  normalizeIdempotencyKey,
  uncertainPayIntent,
  type CachedPayResult,
} from "./pay-intents";
import {
  normalizeAllowedHosts,
  normalizeAllowedPayees,
  type PayUrlPolicy,
} from "./pay-url-guard";
import { payX402WithKey } from "./x402-pay";

type AppContext = Context<{ Bindings: ApiBindings; Variables: ApiVariables }>;

/**
 * Ensures a profile row exists for the authenticated user.
 *
 * @param c - Hono context
 */
export async function ensureProfile(c: AppContext): Promise<void> {
  const supabase = createServiceClient(c.env);
  const userId = c.get("userId");
  const email = c.get("userEmail");
  const { data } = await supabase
    .from("xone_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (data) return;

  const name = email.split("@")[0] || "User";
  await supabase.from("xone_profiles").upsert({
    id: userId,
    email,
    name,
    avatar_url: `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(email)}`,
  });
}

/**
 * Loads an agent owned by the current user (or by api key context).
 *
 * @param c - Context
 * @param agentId - Agent id
 * @returns Agent row
 */
export async function requireOwnedAgent(
  c: AppContext,
  agentId: string,
): Promise<DbAgent> {
  const supabase = createServiceClient(c.env);
  const { data, error } = await supabase
    .from("xone_agents")
    .select("*")
    .eq("id", agentId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message, "db_error");
  if (!data) throw new HttpError(404, `Agent not found: ${agentId}`, "not_found");

  const row = data as DbAgent;
  const userId = c.get("userId");
  const apiKeyId = c.get("apiKeyId");

  if (apiKeyId) {
    if (row.api_key_id !== apiKeyId) {
      throw new HttpError(404, `Agent not found: ${agentId}`, "not_found");
    }
  } else if (row.user_id !== userId) {
    throw new HttpError(404, `Agent not found: ${agentId}`, "not_found");
  }

  return row;
}

/**
 * Appends a history row and returns it.
 *
 * @param c - Context
 * @param agent - Agent
 * @param entry - History fields
 * @returns Inserted history
 */
export async function pushHistory(
  c: AppContext,
  agent: DbAgent,
  entry: {
    type: string;
    amount?: number;
    currency?: string;
    to?: string;
    url?: string;
    txHash?: string;
    meta?: Record<string, unknown>;
  },
): Promise<DbHistory> {
  const supabase = createServiceClient(c.env);
  const row = {
    id: `evt_${uuidHex(16)}`,
    agent_id: agent.id,
    user_id: agent.user_id,
    type: entry.type,
    amount: entry.amount ?? null,
    currency: entry.currency ?? null,
    to_address: entry.to ?? null,
    url: entry.url ?? null,
    tx_hash: entry.txHash ?? null,
    meta: entry.meta ?? null,
  };

  const { data, error } = await supabase
    .from("xone_agent_history")
    .insert(row)
    .select("*")
    .single();

  if (error) throw new HttpError(500, error.message, "db_error");
  return data as DbHistory;
}

/**
 * Creates an agent bound to an API key (1:1).
 *
 * @param c - Context
 * @param params - Create params
 * @param apiKeyId - Owning key
 * @param userId - Owning user
 * @returns Created agent
 */
export async function createAgentForKey(
  c: AppContext,
  params: {
    name: string;
    dailyLimit: number;
    perTransaction: number;
    currency?: string;
    chain?: string;
    allowedHosts?: unknown;
    allowedPayees?: unknown;
  },
  apiKeyId: string,
  userId: string,
): Promise<{ agent: DbAgent }> {
  const name = params.name?.trim();
  if (!name) throw new HttpError(400, "name is required", "validation_error");
  validateLimits(params.dailyLimit, params.perTransaction);
  const allowedHosts = normalizeAllowedHosts(params.allowedHosts);
  const allowedPayees = normalizeAllowedPayees(params.allowedPayees);

  const supabase = createServiceClient(c.env);
  const { data: existing } = await supabase
    .from("xone_agents")
    .select("*")
    .eq("api_key_id", apiKeyId)
    .maybeSingle();

  if (existing) {
    return { agent: existing as DbAgent };
  }

  const chain = normalizeChain(params.chain);
  const wallet = createLocalWallet(chain);
  const enc = await encryptSecret(wallet.privateKey, c.env.WALLET_ENCRYPTION_KEY);
  const currency = (params.currency ?? "USDC").toUpperCase();
  const defaultAmount = "0.01";
  const today = utcDayKey();

  const now = new Date().toISOString();
  const row = {
    id: `agent_${uuidHex(16)}`,
    user_id: userId,
    api_key_id: apiKeyId,
    name,
    chain,
    currency,
    default_amount: defaultAmount,
    daily_limit: params.dailyLimit,
    per_transaction: params.perTransaction,
    remaining_daily: params.dailyLimit,
    daily_period: today,
    balance: 0,
    wallet_address: wallet.address,
    wallet_private_key_enc: enc,
    wallet_family: wallet.family,
    status: "active" as const,
    allowed_hosts: allowedHosts,
    allowed_payees: allowedPayees,
    created_at: now,
    updated_at: now,
  };

  const inserted = await supabase.from("xone_agents").insert(row).select("*").single();
  let data = inserted.data;
  let error = inserted.error;

  // Remote DB may lag migrations — retry without allowlist columns.
  if (error && /allowed_hosts|allowed_payees|schema cache/i.test(error.message)) {
    const { allowed_hosts: _h, allowed_payees: _p, ...rest } = row;
    const second = await supabase.from("xone_agents").insert(rest).select("*").single();
    data = second.data;
    error = second.error;
  }

  if (error) throw new HttpError(500, error.message, "db_error");
  // Private key stays sealed server-side; SDK never receives it.
  return { agent: data as DbAgent };
}

/**
 * Soft-deletes an agent.
 *
 * @param c - Context
 * @param agent - Agent
 * @returns Updated agent
 */
export async function softDeleteAgent(
  c: AppContext,
  agent: DbAgent,
): Promise<DbAgent> {
  if (agent.status === "deleted") return agent;
  const supabase = createServiceClient(c.env);
  const { data, error } = await supabase
    .from("xone_agents")
    .update({ status: "deleted", updated_at: new Date().toISOString() })
    .eq("id", agent.id)
    .select("*")
    .single();
  if (error) throw new HttpError(500, error.message, "db_error");
  const updated = data as DbAgent;
  await pushHistory(c, updated, { type: "delete" });
  return updated;
}

/**
 * @param c - Context
 * @param agent - Agent
 * @param status - New status
 * @param historyType - Event type
 * @returns Updated agent
 */
export async function setAgentStatus(
  c: AppContext,
  agent: DbAgent,
  status: "active" | "paused",
  historyType: "pause" | "resume",
): Promise<DbAgent> {
  assertNotDeleted(agent);
  if (agent.status === status) return agent;
  const supabase = createServiceClient(c.env);
  const { data, error } = await supabase
    .from("xone_agents")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", agent.id)
    .select("*")
    .single();
  if (error) throw new HttpError(500, error.message, "db_error");
  const updated = data as DbAgent;
  await pushHistory(c, updated, { type: historyType });
  return updated;
}

/**
 * Resets remaining daily budget when the UTC calendar day changes.
 * @param c - Context
 * @param agent - Agent row
 * @returns Agent with current-day budget
 */
export async function ensureDailyPeriod(
  c: AppContext,
  agent: DbAgent,
): Promise<DbAgent> {
  const today = utcDayKey();
  const period = agent.daily_period || "";
  if (period === today) return agent;

  const status =
    agent.status === "paused" || agent.status === "deleted"
      ? agent.status
      : "active";

  const supabase = createServiceClient(c.env);
  const { data, error } = await supabase
    .from("xone_agents")
    .update({
      daily_period: today,
      remaining_daily: agent.daily_limit,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agent.id)
    .neq("daily_period", today)
    .select("*")
    .maybeSingle();
  if (error) throw new HttpError(500, error.message, "db_error");
  if (data) return data as DbAgent;

  const { data: fresh, error: readError } = await supabase
    .from("xone_agents")
    .select("*")
    .eq("id", agent.id)
    .single();
  if (readError) throw new HttpError(500, readError.message, "db_error");
  return fresh as DbAgent;
}

/**
 * Asserts spend is allowed against daily / per-tx limits (money micros).
 * @param agent - Agent (already daily-reset)
 * @param amountMicros - Proposed spend
 */
function assertCanSpendMicros(agent: DbAgent, amountMicros: bigint): void {
  assertNotDeleted(agent);
  if (agent.status === "paused") {
    throw new HttpError(400, "Agent is paused", "agent_paused");
  }
  assertPositiveMoney(amountMicros);
  const amount = moneyToNumber(amountMicros);
  if (amountMicros > numberToMoney(agent.per_transaction)) {
    throw new HttpError(400, "Exceeds per-transaction limit", "limit_exceeded");
  }
  if (amountMicros > numberToMoney(agent.remaining_daily)) {
    throw new HttpError(400, "Exceeds daily limit", "limit_exceeded");
  }
  void amount;
}

/**
 * Debits daily budget atomically (SQL remaining_daily = remaining_daily - amount).
 * @param c - Context
 * @param agent - Agent
 * @param params - Spend details
 * @returns Updated agent
 */
async function debitSpend(
  c: AppContext,
  agent: DbAgent,
  params: {
    amountMicros: bigint;
    url?: string;
    to?: string;
    txHash?: string;
    type: "x402";
    /** When true, skip history (used as pre-settlement reserve). */
    silent?: boolean;
  },
): Promise<DbAgent> {
  assertCanSpendMicros(agent, params.amountMicros);
  const amount = moneyToNumber(params.amountMicros);
  const supabase = createServiceClient(c.env);
  const { data, error } = await supabase.rpc("xone_debit_agent_spend", {
    p_agent_id: agent.id,
    p_amount: amount,
    p_daily_period: agent.daily_period,
  });
  if (error) {
    if (error.message?.includes("xone_debit_failed")) {
      throw new HttpError(400, "Exceeds daily limit", "limit_exceeded");
    }
    throw new HttpError(500, error.message, "db_error");
  }
  const updated = data as DbAgent;
  if (!params.silent) {
    await pushHistory(c, updated, {
      type: params.type,
      amount,
      currency: updated.currency,
      url: params.url,
      to: params.to,
      txHash: params.txHash,
    });
  }
  return updated;
}

/**
 * Restores daily budget after a failed reserved payment (atomic add).
 * @param c - Context
 * @param agent - Agent after failed debit
 * @param amountMicros - Amount to refund
 * @returns Updated agent
 */
async function refundSpend(
  c: AppContext,
  agent: DbAgent,
  amountMicros: bigint,
): Promise<DbAgent> {
  const amount = moneyToNumber(amountMicros);
  const supabase = createServiceClient(c.env);
  const { data, error } = await supabase.rpc("xone_refund_agent_spend", {
    p_agent_id: agent.id,
    p_amount: amount,
  });
  if (error) throw new HttpError(500, error.message, "db_error");
  return data as DbAgent;
}

export type PayX402AgentResult = {
  agent: DbAgent;
  paid: number;
  currency: string;
  from: string;
  status: number;
  body: unknown;
  settlement?: unknown;
  network?: string;
  url: string;
  idempotencyKey: string;
  replay?: boolean;
};

/**
 * Server-side x402 pay with idempotency.
 * Flow: claim intent → quote → reserve ledger → settle → complete intent.
 * Retries with the same key replay a succeeded result; never settle twice.
 *
 * @param c - Context
 * @param agent - Agent
 * @param params - URL, optional max ceiling, required idempotency key
 * @returns Payment result + updated agent
 */
export async function payX402Agent(
  c: AppContext,
  agent: DbAgent,
  params: {
    url: string;
    maxAmount?: string | number;
    idempotencyKey: string;
  },
): Promise<PayX402AgentResult> {
  const idempotencyKey = normalizeIdempotencyKey(params.idempotencyKey);
  let current = await ensureDailyPeriod(c, agent);
  assertNotDeleted(current);
  if (current.status === "paused") {
    throw new HttpError(400, "Agent is paused", "agent_paused");
  }

  const begun = await beginPayIntent(c, current.id, {
    idempotencyKey,
    url: params.url,
    maxAmount: params.maxAmount,
  });

  if (begun.kind === "replay") {
    const cached = begun.result;
    current = await ensureDailyPeriod(
      c,
      await requireOwnedAgent(c, current.id),
    );
    return {
      agent: current,
      paid: cached.paid,
      currency: cached.currency,
      from: cached.from,
      status: cached.status,
      body: cached.body,
      settlement: cached.settlement,
      network: cached.network,
      url: cached.url,
      idempotencyKey,
      replay: true,
    };
  }

  const intent = begun.intent;
  const privateKey = await decryptSecret(
    current.wallet_private_key_enc,
    c.env.WALLET_ENCRYPTION_KEY,
  );

  let reserved: DbAgent | null = null;
  let reservedMicros = 0n;
  let settleAttempted = false;

  try {
    const result = await payX402WithKey({
      url: params.url,
      privateKey,
      chain: current.chain as Chain,
      maxAmount: params.maxAmount,
      policy: agentPayPolicy(current),
      beforePay: async (paidMicros) => {
        if (paidMicros === 0n) return;
        assertCanSpendMicros(current, paidMicros);
        reserved = await debitSpend(c, current, {
          amountMicros: paidMicros,
          url: params.url,
          type: "x402",
          silent: true,
        });
        reservedMicros = paidMicros;
        current = reserved;
      },
      onReadyToSettle: () => {
        settleAttempted = true;
      },
    });

    if (result.paidMicros === 0n) {
      const payload: CachedPayResult = {
        agentId: current.id,
        paid: 0,
        currency: result.currency,
        from: result.from,
        status: result.status,
        body: result.body,
        settlement: result.settlement,
        network: result.network,
        url: params.url,
        remainingDaily: current.remaining_daily,
        chain: current.chain,
        idempotencyKey,
        replay: true,
      };
      await completePayIntent(c, intent.id, payload);
      return {
        agent: current,
        paid: 0,
        currency: result.currency,
        from: result.from,
        status: result.status,
        body: result.body,
        settlement: result.settlement,
        network: result.network,
        url: params.url,
        idempotencyKey,
      };
    }

    const txHash =
      typeof result.settlement === "object" &&
      result.settlement &&
      "transaction" in (result.settlement as Record<string, unknown>)
        ? String((result.settlement as { transaction?: string }).transaction)
        : undefined;

    if (reserved) {
      await pushHistory(c, reserved, {
        type: "x402",
        amount: result.paid,
        currency: result.currency,
        url: params.url,
        txHash,
        meta: { idempotencyKey },
      });
    }

    const agentRow = reserved ?? current;
    const payload: CachedPayResult = {
      agentId: agentRow.id,
      paid: result.paid,
      currency: result.currency,
      from: result.from,
      status: result.status,
      body: result.body,
      settlement: result.settlement,
      network: result.network,
      url: params.url,
      remainingDaily: agentRow.remaining_daily,
      chain: agentRow.chain,
      idempotencyKey,
      replay: true,
    };
    await completePayIntent(c, intent.id, payload);

    return {
      agent: agentRow,
      paid: result.paid,
      currency: result.currency,
      from: result.from,
      status: result.status,
      body: result.body,
      settlement: result.settlement,
      network: result.network,
      url: params.url,
      idempotencyKey,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (settleAttempted) {
      // Possible on-chain success — keep debit, block retries with this key.
      await uncertainPayIntent(c, intent.id, message);
      throw new HttpError(
        409,
        `Payment uncertain after settlement attempt: ${message}. Reusing this idempotencyKey will not pay again; verify on-chain before any new pay.`,
        "payment_uncertain",
      );
    }
    if (reserved && reservedMicros > 0n) {
      await refundSpend(c, reserved, reservedMicros);
    }
    await failPayIntent(c, intent.id, message);
    throw err;
  }
}

/**
 * @param c - Context
 * @param agent - Agent
 * @param patch - Limits and optional allowlists
 * @returns Updated agent
 */
export async function updateLimits(
  c: AppContext,
  agent: DbAgent,
  patch: {
    dailyLimit?: number;
    perTransaction?: number;
    allowedHosts?: unknown;
    allowedPayees?: unknown;
  },
): Promise<DbAgent> {
  assertNotDeleted(agent);
  const dailyLimit = patch.dailyLimit ?? agent.daily_limit;
  const perTransaction = patch.perTransaction ?? agent.per_transaction;
  validateLimits(dailyLimit, perTransaction);
  const allowedHosts =
    patch.allowedHosts !== undefined
      ? normalizeAllowedHosts(patch.allowedHosts)
      : (agent.allowed_hosts ?? []);
  const allowedPayees =
    patch.allowedPayees !== undefined
      ? normalizeAllowedPayees(patch.allowedPayees)
      : (agent.allowed_payees ?? []);

  const remainingDaily =
    patch.dailyLimit !== undefined
      ? Math.min(agent.remaining_daily, dailyLimit)
      : agent.remaining_daily;

  const supabase = createServiceClient(c.env);
  const { data, error } = await supabase
    .from("xone_agents")
    .update({
      daily_limit: dailyLimit,
      per_transaction: perTransaction,
      remaining_daily: remainingDaily,
      allowed_hosts: allowedHosts,
      allowed_payees: allowedPayees,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agent.id)
    .select("*")
    .single();
  if (error) throw new HttpError(500, error.message, "db_error");
  const updated = data as DbAgent;
  await pushHistory(c, updated, {
    type: "limits_update",
    meta: {
      dailyLimit,
      perTransaction,
      allowedHosts,
      allowedPayees,
      previous: {
        dailyLimit: agent.daily_limit,
        perTransaction: agent.per_transaction,
        allowedHosts: agent.allowed_hosts ?? [],
        allowedPayees: agent.allowed_payees ?? [],
      },
    },
  });
  return updated;
}

/**
 * @param agent - Agent row
 * @returns Pay URL policy
 */
function agentPayPolicy(agent: DbAgent): PayUrlPolicy {
  return {
    allowedHosts: agent.allowed_hosts ?? [],
    allowedPayees: agent.allowed_payees ?? [],
  };
}

/**
 * @param agent - Agent row
 */
function assertNotDeleted(agent: DbAgent): void {
  if (agent.status === "deleted") {
    throw new HttpError(400, "Agent is deleted", "agent_deleted");
  }
}
