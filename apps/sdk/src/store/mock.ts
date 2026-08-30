import { uuidHex } from "../utils/id.js";
import {
  AgentDeletedError,
  AgentNotFoundError,
  AgentPausedError,
  LimitExceededError,
  ValidationError,
} from "../errors.js";
import type {
  AgentCreateParams,
  AgentHistoryEntry,
  AgentHistoryType,
  AgentRecord,
  GetHistoryParams,
  SpendMeta,
  UpdateLimitsParams,
  WalletInfo,
} from "../types.js";
import {
  assertPositiveMoney,
  moneyToNumber,
  numberToMoney,
  parseMoney,
  utcDayKey,
} from "../utils/money.js";
import { createLocalWallet } from "../wallet/generate.js";
import { requireActiveApiKeyByToken } from "./apiKeys.js";

/** In-memory mock store (no remote API yet). */
const agents = new Map<string, AgentRecord>();

/**
 * Creates an agent with a local wallet and spend limits (mock).
 * Requires an active API key token issued by the personal console.
 *
 * @param params - Name, limits, optional chain/currency
 * @param agentToken - API key token
 * @returns Persisted agent record
 * @throws When token/params are invalid
 */
export async function createAgentRecord(
  params: AgentCreateParams,
  agentToken: string,
): Promise<AgentRecord> {
  await delay(15);

  const apiKey = requireActiveApiKeyByToken(agentToken);

  // One API key ↔ one agent
  for (const existing of agents.values()) {
    if (existing.apiKeyId === apiKey.id) {
      throw new ValidationError(
        "This API key is already bound to an agent (1 key = 1 agent)",
      );
    }
  }

  if (!params.name?.trim()) {
    throw new ValidationError("name is required");
  }

  const dailyLimit = moneyToNumber(parseMoney(params.dailyLimit));
  const perTransaction = moneyToNumber(parseMoney(params.perTransaction));
  validateLimits(dailyLimit, perTransaction);

  const chain = params.chain ?? "base-sepolia";
  const wallet = createLocalWallet(chain);
  const currency = (params.currency ?? "USDC").toUpperCase();
  const defaultAmount = "0.01";
  const today = utcDayKey();
  const allowedHosts = normalizeHostList(params.allowedHosts);
  const allowedPayees = normalizePayeeList(params.allowedPayees);

  const record: AgentRecord = {
    id: `agent_${uuidHex(16)}`,
    name: params.name.trim(),
    apiKeyId: apiKey.id,
    chain,
    currency,
    defaultAmount,
    dailyLimit,
    perTransaction,
    remainingDaily: dailyLimit,
    dailyPeriod: today,
    wallet,
    createdAt: new Date().toISOString(),
    status: "active",
    allowedHosts,
    allowedPayees,
    history: [],
  };

  agents.set(record.id, record);
  return clone(record);
}

/**
 * @param id - Agent id
 * @returns Cloned record or `undefined`
 */
export function getAgentRecord(id: string): AgentRecord | undefined {
  const record = agents.get(id);
  if (!record) return undefined;
  ensureDailyPeriod(record);
  return clone(record);
}

/**
 * Lists agents, optionally filtered by API key id(s).
 *
 * @param apiKeyIds - When set, only agents created with these keys
 * @returns Agent records (newest created first)
 */
export function listAgentRecords(apiKeyIds?: string[]): AgentRecord[] {
  const allow = apiKeyIds ? new Set(apiKeyIds) : null;
  return [...agents.values()]
    .filter((a) => (allow ? allow.has(a.apiKeyId) : true))
    .map(clone)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * @returns Live agent map (for api key stats)
 */
export function getAgentMap(): Map<string, AgentRecord> {
  return agents;
}

/**
 * Soft-deletes every agent bound to an API key.
 * @param apiKeyId - Owning API key id
 */
export function softDeleteAgentsForApiKey(apiKeyId: string): void {
  for (const record of agents.values()) {
    if (record.apiKeyId === apiKeyId && record.status !== "deleted") {
      record.status = "deleted";
      pushHistory(record, { type: "delete" });
    }
  }
}

/**
 * Soft-deletes an agent: spending is permanently blocked; record + history remain.
 *
 * @param id - Agent id
 * @returns Updated record
 */
export function deleteAgentRecord(id: string): AgentRecord {
  const record = requireRecord(id);
  if (record.status === "deleted") {
    return clone(record);
  }
  record.status = "deleted";
  pushHistory(record, { type: "delete" });
  return clone(record);
}

/**
 * Pauses spending without deleting the agent.
 *
 * @param id - Agent id
 * @returns Updated record
 */
export function pauseAgentRecord(id: string): AgentRecord {
  const record = requireRecord(id);
  assertNotDeleted(record);
  if (record.status === "paused") {
    return clone(record);
  }
  record.status = "paused";
  pushHistory(record, { type: "pause" });
  return clone(record);
}

/**
 * Resumes a paused agent (or reactivates from exhausted if budget remains).
 *
 * @param id - Agent id
 * @returns Updated record
 */
export function resumeAgentRecord(id: string): AgentRecord {
  const record = requireRecord(id);
  assertNotDeleted(record);
  if (record.status !== "paused" && record.status !== "exhausted") {
    return clone(record);
  }
  record.status = record.remainingDaily > 0 ? "active" : "exhausted";
  pushHistory(record, { type: "resume" });
  return clone(record);
}

/**
 * Mutates spend limits; clamps remaining daily when lowering the cap.
 *
 * @param id - Agent id
 * @param params - Partial limit updates
 * @returns Updated record
 */
export function updateAgentLimits(
  id: string,
  params: UpdateLimitsParams,
): AgentRecord {
  const record = requireRecord(id);
  assertNotDeleted(record);

  const dailyLimit =
    params.dailyLimit !== undefined
      ? moneyToNumber(parseMoney(params.dailyLimit))
      : record.dailyLimit;
  const perTransaction =
    params.perTransaction !== undefined
      ? moneyToNumber(parseMoney(params.perTransaction))
      : record.perTransaction;
  validateLimits(dailyLimit, perTransaction);

  const previous = {
    dailyLimit: record.dailyLimit,
    perTransaction: record.perTransaction,
    remainingDaily: record.remainingDaily,
  };

  const spentToday = moneyToNumber(
    numberToMoney(record.dailyLimit) - numberToMoney(record.remainingDaily),
  );
  record.dailyLimit = dailyLimit;
  record.perTransaction = perTransaction;
  if (params.allowedHosts !== undefined) {
    record.allowedHosts = normalizeHostList(params.allowedHosts);
  }
  if (params.allowedPayees !== undefined) {
    record.allowedPayees = normalizePayeeList(params.allowedPayees);
  }
  record.remainingDaily = moneyToNumber(
    numberToMoney(
      Math.max(0, Math.min(dailyLimit, dailyLimit - spentToday)),
    ),
  );
  syncStatus(record);
  pushHistory(record, {
    type: "limits_update",
    meta: { previous, next: params },
  });

  return clone(record);
}

/**
 * Debits daily budget for an agent spend (x402 / transfer).
 * On-chain USDC is separate — not tracked in this ledger.
 *
 * @param id - Agent id
 * @param amount - Amount to spend
 * @param meta - History classification and optional fields
 * @returns Updated record
 */
export function spendFromAgent(
  id: string,
  amount: number,
  meta: SpendMeta,
): AgentRecord {
  const record = requireRecord(id);
  ensureDailyPeriod(record);
  assertSpendAllowed(record, amount);

  const micros = numberToMoney(amount);
  record.remainingDaily = moneyToNumber(
    numberToMoney(record.remainingDaily) - micros,
  );
  syncStatus(record);
  if (!meta.silent) {
    pushHistory(record, {
      type: meta.type,
      amount,
      currency: record.currency,
      to: meta.to,
      url: meta.url,
      txHash: meta.txHash,
    });
  }
  return clone(record);
}

/**
 * Restores daily budget after a failed reserved mock payment.
 *
 * @param id - Agent id
 * @param amount - Amount to refund
 * @returns Updated record
 */
export function refundAgentSpend(id: string, amount: number): AgentRecord {
  const record = requireRecord(id);
  const next = moneyToNumber(
    numberToMoney(record.remainingDaily) + numberToMoney(amount),
  );
  record.remainingDaily = Math.min(record.dailyLimit, next);
  syncStatus(record);
  return clone(record);
}

/**
 * Appends a history row without changing balances.
 *
 * @param id - Agent id
 * @param entry - History fields
 */
export function appendAgentHistory(
  id: string,
  entry: Omit<AgentHistoryEntry, "id" | "createdAt">,
): void {
  pushHistory(requireRecord(id), entry);
}

/**
 * Validates that a spend is allowed without mutating state.
 *
 * @param id - Agent id
 * @param amount - Proposed spend
 * @throws Limit / paused / deleted errors
 */
export function assertAgentCanSpend(id: string, amount: number): void {
  const record = requireRecord(id);
  ensureDailyPeriod(record);
  assertSpendAllowed(record, amount);
}

/**
 * @param id - Agent id
 * @param params - Optional filters
 * @returns History newest-first
 */
export function getAgentHistory(
  id: string,
  params: GetHistoryParams = {},
): AgentHistoryEntry[] {
  const record = requireRecord(id);
  let entries = [...record.history].reverse();
  if (params.types?.length) {
    const allowed = new Set<AgentHistoryType>(params.types);
    entries = entries.filter((e) => allowed.has(e.type));
  }
  if (params.limit !== undefined) {
    if (!Number.isFinite(params.limit) || params.limit < 0) {
      throw new ValidationError(`Invalid history limit: ${params.limit}`);
    }
    entries = entries.slice(0, params.limit);
  }
  return entries.map((e) => ({ ...e, meta: e.meta ? { ...e.meta } : undefined }));
}

/**
 * @param id - Agent id
 * @returns Live wallet material (includes private key — SDK-internal only)
 */
export function getAgentWallet(id: string): WalletInfo {
  return requireRecord(id).wallet;
}

/**
 * Clears all agents (test helper).
 */
export function clearAgentStore(): void {
  agents.clear();
}

/**
 * @param dailyLimit - Daily cap
 * @param perTransaction - Per-tx cap
 * @throws When limits are invalid
 */
function validateLimits(dailyLimit: number, perTransaction: number): void {
  if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) {
    throw new ValidationError(`Invalid dailyLimit: ${dailyLimit}`);
  }
  if (!Number.isFinite(perTransaction) || perTransaction <= 0) {
    throw new ValidationError(`Invalid perTransaction: ${perTransaction}`);
  }
  if (perTransaction > dailyLimit) {
    throw new ValidationError("perTransaction cannot exceed dailyLimit");
  }
}

/**
 * @param id - Agent id
 * @returns Mutable store record
 * @throws When missing
 */
function requireRecord(id: string): AgentRecord {
  const record = agents.get(id);
  if (!record) {
    throw new AgentNotFoundError(id);
  }
  ensureDailyPeriod(record);
  return record;
}

/**
 * Resets remainingDaily when the UTC calendar day changes.
 * @param record - Live store record
 */
function ensureDailyPeriod(record: AgentRecord): void {
  const today = utcDayKey();
  if (!record.dailyPeriod) record.dailyPeriod = today;
  if (record.dailyPeriod === today) return;
  record.dailyPeriod = today;
  record.remainingDaily = record.dailyLimit;
  if (record.status === "exhausted") {
    record.status = "active";
  }
}

/**
 * @param record - Agent record
 * @throws When soft-deleted
 */
function assertNotDeleted(record: AgentRecord): void {
  if (record.status === "deleted") {
    throw new AgentDeletedError(record.id);
  }
}

/**
 * @param record - Agent record
 * @param amount - Proposed spend
 * @throws When paused, deleted, exhausted, over limit, or underfunded
 */
function assertSpendAllowed(record: AgentRecord, amount: number): void {
  assertPositiveAmount(amount);
  assertCanSpend(record);

  if (amount > record.perTransaction) {
    throw new LimitExceededError(
      "perTransaction",
      amount,
      record.perTransaction,
      record.currency,
    );
  }
  if (amount > record.remainingDaily) {
    throw new LimitExceededError(
      "daily",
      amount,
      record.remainingDaily,
      record.currency,
    );
  }
}

/**
 * @param record - Agent record
 * @throws When paused, deleted, or exhausted with no budget path
 */
function assertCanSpend(record: AgentRecord): void {
  if (record.status === "deleted") {
    throw new AgentDeletedError(record.id);
  }
  if (record.status === "paused") {
    throw new AgentPausedError(record.id);
  }
  if (record.status === "exhausted") {
    throw new LimitExceededError(
      "daily",
      0,
      record.remainingDaily,
      record.currency,
    );
  }
}

/**
 * Updates exhausted/active based on remaining budget.
 * Does not override paused or deleted.
 *
 * @param record - Agent record
 */
function syncStatus(record: AgentRecord): void {
  if (record.status === "paused" || record.status === "deleted") {
    return;
  }
  if (record.remainingDaily <= 0) {
    record.remainingDaily = 0;
    record.status = "exhausted";
  } else {
    record.status = "active";
  }
}

/**
 * @param record - Agent record
 * @param entry - History fields without id/createdAt
 */
function pushHistory(
  record: AgentRecord,
  entry: Omit<AgentHistoryEntry, "id" | "createdAt">,
): void {
  record.history.push({
    id: `evt_${uuidHex(12)}`,
    createdAt: new Date().toISOString(),
    ...entry,
  });
}

/**
 * @param amount - Numeric amount
 * @throws When not a positive finite number
 */
function assertPositiveAmount(amount: number): void {
  try {
    assertPositiveMoney(numberToMoney(amount));
  } catch {
    throw new ValidationError(`Invalid amount: ${amount}`);
  }
}

/**
 * @param record - Agent record
 * @returns Deep-enough clone for safe external use
 */
function clone(record: AgentRecord): AgentRecord {
  return {
    ...record,
    wallet: { ...record.wallet },
    allowedHosts: [...(record.allowedHosts ?? [])],
    allowedPayees: [...(record.allowedPayees ?? [])],
    history: record.history.map((e) => ({
      ...e,
      meta: e.meta ? { ...e.meta } : undefined,
    })),
  };
}

/**
 * @param raw - Hostnames
 * @returns Normalized host rules
 */
function normalizeHostList(raw?: string[]): string[] {
  if (!raw?.length) return [];
  const out: string[] = [];
  for (const item of raw) {
    const value = item.trim().toLowerCase();
    if (!value) continue;
    if (value.startsWith("*.")) {
      out.push(value);
      continue;
    }
    try {
      const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
      if (url.hostname) out.push(url.hostname);
    } catch {
      throw new ValidationError(`Invalid host allowlist entry: ${item}`);
    }
  }
  return [...new Set(out)];
}

/**
 * @param raw - 0x addresses
 * @returns Lowercase addresses
 */
function normalizePayeeList(raw?: string[]): string[] {
  if (!raw?.length) return [];
  const out: string[] = [];
  for (const item of raw) {
    const addr = item.trim().toLowerCase();
    if (!addr) continue;
    if (!/^0x[0-9a-f]{40}$/.test(addr)) {
      throw new ValidationError(`Invalid payee address: ${item}`);
    }
    out.push(addr);
  }
  return [...new Set(out)];
}

/**
 * @param ms - Milliseconds to wait
 * @returns Resolves after delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * @param value - String or number amount
 * @returns Parsed positive number
 * @throws When invalid
 */
export function parseAmount(value: string | number): number {
  try {
    const micros = parseMoney(value);
    assertPositiveMoney(micros);
    return moneyToNumber(micros);
  } catch (err) {
    throw new ValidationError(
      err instanceof Error ? err.message : `Invalid amount: ${value}`,
    );
  }
}
