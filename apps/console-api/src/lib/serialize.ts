import type { DbAgent, DbApiKey, DbHistory } from "./supabase";

/**
 * Public API key shape.
 * Full `token` is only present on create; list responses omit the secret.
 *
 * @param row - DB row
 * @param token - Optional full token (create only)
 * @returns JSON-safe key
 */
export function serializeApiKey(row: DbApiKey, token?: string) {
  return {
    id: row.id,
    name: row.name,
    /** Full secret — only set when creating; otherwise empty (never re-shown). */
    token: token ?? "",
    createdAt: row.created_at,
    status: row.status,
  };
}

/**
 * Public agent shape (never includes private key).
 *
 * @param row - DB row
 * @returns JSON-safe agent
 */
export function serializeAgent(row: DbAgent) {
  return {
    id: row.id,
    name: row.name,
    apiKeyId: row.api_key_id,
    chain: row.chain,
    currency: row.currency,
    defaultAmount: row.default_amount,
    dailyLimit: row.daily_limit,
    perTransaction: row.per_transaction,
    remainingDaily: row.remaining_daily,
    dailyPeriod: row.daily_period ?? "",
    address: row.wallet_address,
    walletFamily: row.wallet_family,
    createdAt: row.created_at,
    status: row.status,
    allowedHosts: row.allowed_hosts ?? [],
    allowedPayees: row.allowed_payees ?? [],
  };
}

/**
 * @param row - History row
 * @returns JSON-safe history entry
 */
export function serializeHistory(row: DbHistory) {
  return {
    id: row.id,
    agentId: row.agent_id,
    type: row.type,
    createdAt: row.created_at,
    amount: row.amount ?? undefined,
    currency: row.currency ?? undefined,
    to: row.to_address ?? undefined,
    url: row.url ?? undefined,
    txHash: row.tx_hash ?? undefined,
    meta: row.meta ?? undefined,
  };
}
