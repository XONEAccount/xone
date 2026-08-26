import {
  AgentNotFoundError,
  ValidationError,
} from "./errors.js";
import { payMockAgent } from "./mockPay.js";
import {
  getAgentHistory,
  getAgentRecord,
  pauseAgentRecord,
  resumeAgentRecord,
  deleteAgentRecord,
  updateAgentLimits,
} from "./store/mock.js";
import { createXOneTools } from "./tools/index.js";
import type {
  AgentHistoryEntry,
  AgentLimits,
  AgentRecord,
  AgentStatus,
  SpendSnapshot,
  GetHistoryParams,
  PayParams,
  PayResult,
  UpdateLimitsParams,
  XOneChain,
} from "./types.js";

/**
 * An agent is a named local wallet with spend limits (1:1). Mock / local mode.
 */
export class Agent {
  readonly id: string;
  readonly name: string;
  readonly chain: XOneChain;
  readonly currency: string;
  /** API key that owns this agent. */
  readonly apiKeyId: string;

  /**
   * @param record - Initial agent record from the mock store
   */
  constructor(record: AgentRecord) {
    this.id = record.id;
    this.name = record.name;
    this.chain = record.chain;
    this.currency = record.currency;
    this.apiKeyId = record.apiKeyId;
  }

  /**
   * @returns Current lifecycle status
   */
  getStatus(): AgentStatus {
    return this.requireRecord().status;
  }

  /**
   * @returns Agent wallet address
   */
  getAddress(): string {
    return this.requireRecord().wallet.address;
  }

  /**
   * Address + spend-policy snapshot (not an on-chain USDC balance).
   * @returns Spend snapshot
   */
  async getSpendSnapshot(): Promise<SpendSnapshot> {
    await tick();
    const record = this.requireRecord();
    return {
      currency: record.currency,
      chain: record.chain,
      address: record.wallet.address,
      remainingDaily: record.remainingDaily,
      dailyLimit: record.dailyLimit,
      perTransaction: record.perTransaction,
      status: record.status,
      note: "Fund on-chain USDC at address; limits use remainingDaily / perTransaction",
    };
  }

  /**
   * @deprecated Use {@link getSpendSnapshot}. Same return value.
   * @returns Spend snapshot
   */
  async getBalance(): Promise<SpendSnapshot> {
    return this.getSpendSnapshot();
  }

  /**
   * @returns Current spend limits and remaining daily budget
   */
  async getLimits(): Promise<AgentLimits> {
    await tick();
    const record = this.requireRecord();
    return {
      dailyLimit: record.dailyLimit,
      perTransaction: record.perTransaction,
      remainingDaily: record.remainingDaily,
      currency: record.currency,
      dailyPeriod: record.dailyPeriod,
      allowedHosts: record.allowedHosts,
      allowedPayees: record.allowedPayees,
    };
  }

  /**
   * Returns ledger / lifecycle events (newest first).
   * @param params - Optional limit and type filters
   * @returns History entries
   */
  async getHistory(
    params: GetHistoryParams = {},
  ): Promise<AgentHistoryEntry[]> {
    await tick();
    return getAgentHistory(this.id, params);
  }

  /**
   * Updates daily and/or per-transaction spend limits.
   * @param params - Partial limit fields to change
   * @returns Updated limits snapshot
   */
  async updateLimits(params: UpdateLimitsParams): Promise<AgentLimits> {
    if (
      params.dailyLimit === undefined &&
      params.perTransaction === undefined &&
      params.allowedHosts === undefined &&
      params.allowedPayees === undefined
    ) {
      throw new ValidationError(
        "Provide dailyLimit, perTransaction, allowedHosts, and/or allowedPayees",
      );
    }
    const record = updateAgentLimits(this.id, params);
    return {
      dailyLimit: record.dailyLimit,
      perTransaction: record.perTransaction,
      remainingDaily: record.remainingDaily,
      currency: record.currency,
      dailyPeriod: record.dailyPeriod,
      allowedHosts: record.allowedHosts,
      allowedPayees: record.allowedPayees,
    };
  }

  /**
   * Pauses spending (x402 / transfer).
   * @returns Updated status
   */
  async pause(): Promise<AgentStatus> {
    return pauseAgentRecord(this.id).status;
  }

  /**
   * Resumes a paused agent (or clears exhausted when budget remains).
   * @returns Updated status
   */
  async resume(): Promise<AgentStatus> {
    return resumeAgentRecord(this.id).status;
  }

  /**
   * Soft-deletes this agent in **mock / local** mode only.
   * Production soft-delete is console JWT (`DELETE /v1/agents/:id`), not the spend SDK.
   * @returns Updated status (`deleted`)
   */
  async delete(): Promise<AgentStatus> {
    return deleteAgentRecord(this.id).status;
  }

  /**
   * Pays an x402 HTTP resource. Enforces limits before settlement; debit = quote.
   * Pass the same `idempotencyKey` on network retries to avoid a second settlement.
   * @param params - URL, optional max ceiling, optional idempotency key
   */
  async pay(params: PayParams): Promise<PayResult> {
    return payMockAgent(this.id, params);
  }

  /**
   * @returns LangChain tools bound to this agent's wallet and limits
   */
  getTools() {
    return createXOneTools({
      mode: "mock",
      getAgentId: () => this.id,
    });
  }

  /**
   * @returns Latest store record
   */
  private requireRecord(): AgentRecord {
    const record = getAgentRecord(this.id);
    if (!record) {
      throw new AgentNotFoundError(this.id);
    }
    return record;
  }
}

/**
 * Tiny delay so async surface feels consistent in mock mode.
 */
function tick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
