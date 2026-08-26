import type {
  AgentHistoryEntry,
  AgentLimits,
  AgentStatus,
  SpendSnapshot,
  GetHistoryParams,
  UpdateLimitsParams,
  XOneChain,
} from "@xone/sdk";
import { api } from "./api";
import type { AgentDto } from "./types";

/**
 * Console-side agent bound to the Hono API (same surface as SDK `Agent` methods).
 */
export class RemoteAgent {
  readonly id: string;
  readonly name: string;
  readonly chain: XOneChain;
  readonly currency: string;
  readonly apiKeyId: string;

  private snapshot: AgentDto;
  private readonly onChange: () => void;

/**
 * @param dto - Agent DTO from API
 * @param onChange - Called after mutations so the console can refresh lists
 */
  constructor(dto: AgentDto, onChange: () => void) {
    this.snapshot = dto;
    this.onChange = onChange;
    this.id = dto.id;
    this.name = dto.name;
    this.chain = dto.chain;
    this.currency = dto.currency;
    this.apiKeyId = dto.apiKeyId;
  }

  /**
   * Replaces local snapshot after a remote mutation.
   *
   * @param dto - Fresh DTO
   */
  apply(dto: AgentDto): void {
    this.snapshot = dto;
  }

  /**
   * @returns Lifecycle status
   */
  getStatus(): AgentStatus {
    return this.snapshot.status;
  }

  /**
   * @returns Wallet address
   */
  getAddress(): string {
    return this.snapshot.address;
  }

  /**
   * Address + spend-policy snapshot (not an on-chain USDC balance).
   * @returns Spend snapshot
   */
  async getSpendSnapshot(): Promise<SpendSnapshot> {
    const fresh = await api.getAgent(this.id);
    this.apply(fresh);
    return {
      currency: fresh.currency,
      chain: fresh.chain,
      address: fresh.address,
      remainingDaily: fresh.remainingDaily,
      dailyLimit: fresh.dailyLimit,
      perTransaction: fresh.perTransaction,
      status: fresh.status,
      note: "Fund on-chain USDC at address; limits use remainingDaily / perTransaction",
    };
  }

  /**
   * @deprecated Use {@link getSpendSnapshot}.
   * @returns Spend snapshot
   */
  async getBalance(): Promise<SpendSnapshot> {
    return this.getSpendSnapshot();
  }

  /**
   * @returns Spend limits
   */
  getLimits(): AgentLimits {
    return {
      dailyLimit: this.snapshot.dailyLimit,
      perTransaction: this.snapshot.perTransaction,
      remainingDaily: this.snapshot.remainingDaily,
      currency: this.snapshot.currency,
      allowedHosts: this.snapshot.allowedHosts ?? [],
      allowedPayees: this.snapshot.allowedPayees ?? [],
    };
  }

  /**
   * @param params - Filters
   * @returns History entries
   */
  async getHistory(params?: GetHistoryParams): Promise<AgentHistoryEntry[]> {
    const items = await api.agentHistory(this.id, params?.limit ?? 50);
    const types = params?.types ? new Set(params.types) : null;
    return items
      .filter((e) => (types ? types.has(e.type) : true))
      .map((e) => ({
        id: e.id,
        type: e.type,
        createdAt: e.createdAt,
        amount: e.amount,
        currency: e.currency,
        to: e.to,
        url: e.url,
        txHash: e.txHash,
        meta: e.meta,
      }));
  }

  /**
   * @param params - Limits patch
   * @returns Updated limits
   */
  async updateLimits(params: UpdateLimitsParams): Promise<AgentLimits> {
    const dto = await api.updateLimits(this.id, {
      dailyLimit:
        params.dailyLimit === undefined ? undefined : Number(params.dailyLimit),
      perTransaction:
        params.perTransaction === undefined
          ? undefined
          : Number(params.perTransaction),
      allowedHosts: params.allowedHosts,
      allowedPayees: params.allowedPayees,
    });
    this.apply(dto);
    this.onChange();
    return this.getLimits();
  }

  /**
   * Pauses spending.
   *
   * @returns This agent
   */
  async pause(): Promise<this> {
    this.apply(await api.pauseAgent(this.id));
    this.onChange();
    return this;
  }

  /**
   * Resumes spending.
   *
   * @returns This agent
   */
  async resume(): Promise<this> {
    this.apply(await api.resumeAgent(this.id));
    this.onChange();
    return this;
  }

  /**
   * Soft-deletes the agent.
   *
   * @returns This agent
   */
  async delete(): Promise<this> {
    this.apply(await api.deleteAgent(this.id));
    this.onChange();
    return this;
  }
}
