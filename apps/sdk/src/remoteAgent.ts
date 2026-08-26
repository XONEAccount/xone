import { httpJson } from "./http.js";
import { createXOneTools } from "./tools/index.js";
import type {
  AgentHistoryEntry,
  AgentLimits,
  AgentStatus,
  SpendSnapshot,
  GetHistoryParams,
  PayParams,
  PayResult,
  XOneChain,
  AgentCreateParams,
} from "./types.js";
import { resolvePayIdempotencyKey } from "./store/payIntents.js";

type AgentDto = {
  id: string;
  name: string;
  apiKeyId: string;
  chain: XOneChain;
  currency: string;
  defaultAmount: string;
  dailyLimit: number;
  perTransaction: number;
  remainingDaily: number;
  dailyPeriod?: string;
  address: string;
  walletFamily: "evm" | "solana";
  createdAt: string;
  status: AgentStatus;
  allowedHosts?: string[];
  allowedPayees?: string[];
};

type HistoryDto = {
  id: string;
  type: AgentHistoryEntry["type"];
  createdAt: string;
  amount?: number;
  currency?: string;
  to?: string;
  url?: string;
  txHash?: string;
  meta?: Record<string, unknown>;
};

/**
 * HTTP-backed spender agent. Private keys stay sealed on the API.
 * Operator actions (limits, pause, delete) are console JWT only.
 */
export class RemoteAgent {
  readonly id: string;
  readonly name: string;
  readonly chain: XOneChain;
  readonly currency: string;
  readonly apiKeyId: string;

  private snapshot: AgentDto;
  private readonly baseUrl: string;
  private readonly agentToken: string;

  /**
   * @param dto - Agent DTO
   * @param baseUrl - API origin
   * @param agentToken - API key token
   */
  constructor(dto: AgentDto, baseUrl: string, agentToken: string) {
    this.snapshot = dto;
    this.baseUrl = baseUrl;
    this.agentToken = agentToken;
    this.id = dto.id;
    this.name = dto.name;
    this.chain = dto.chain;
    this.currency = dto.currency;
    this.apiKeyId = dto.apiKeyId;
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
   * Refreshes from the API first.
   * @returns Spend snapshot
   */
  async getSpendSnapshot(): Promise<SpendSnapshot> {
    this.snapshot = await this.fetch(`/v1/sdk/agents/${this.id}`);
    return {
      currency: this.snapshot.currency,
      chain: this.snapshot.chain,
      address: this.snapshot.address,
      remainingDaily: this.snapshot.remainingDaily,
      dailyLimit: this.snapshot.dailyLimit,
      perTransaction: this.snapshot.perTransaction,
      status: this.snapshot.status,
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
   * @returns Spend limits (refreshed)
   */
  async getLimits(): Promise<AgentLimits> {
    this.snapshot = await this.fetch(`/v1/sdk/agents/${this.id}`);
    return {
      dailyLimit: this.snapshot.dailyLimit,
      perTransaction: this.snapshot.perTransaction,
      remainingDaily: this.snapshot.remainingDaily,
      currency: this.snapshot.currency,
      dailyPeriod: this.snapshot.dailyPeriod,
      allowedHosts: this.snapshot.allowedHosts ?? [],
      allowedPayees: this.snapshot.allowedPayees ?? [],
    };
  }

  /**
   * @param params - Filters
   * @returns History
   */
  async getHistory(params?: GetHistoryParams): Promise<AgentHistoryEntry[]> {
    const { items } = await this.fetch<{ items: HistoryDto[] }>(
      `/v1/sdk/agents/${this.id}/history?limit=${params?.limit ?? 50}`,
    );
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
   * Server-side x402 pay (idempotent; limits reserved before settlement).
   * Reuse `idempotencyKey` on network retries — never mint a new key blindly.
   * @param params - URL / optional max ceiling / idempotency key
   */
  async pay(params: PayParams): Promise<PayResult> {
    const idempotencyKey = resolvePayIdempotencyKey(params);
    const result = await this.fetch<
      PayResult & { agent?: AgentDto; replay?: boolean }
    >(`/v1/sdk/agents/${this.id}/pay`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        url: params.url,
        maxAmount: params.maxAmount,
        idempotencyKey,
      }),
    });
    if (result.agent) this.snapshot = result.agent;
    return {
      ok: true,
      mock: false,
      protocol: "x402",
      url: result.url,
      paid: result.paid,
      currency: result.currency,
      chain: result.chain ?? this.chain,
      from: result.from,
      status: result.status,
      body: result.body,
      remainingDaily: result.remainingDaily,
      settlement: result.settlement,
      network: result.network,
      idempotencyKey: result.idempotencyKey ?? idempotencyKey,
      replay: result.replay ?? false,
    };
  }

  /**
   * LangChain tools backed by remote API calls (including server-side x402 pay).
   */
  getTools() {
    return createXOneTools({
      mode: "remote",
      remote: this,
    });
  }

  /**
   * @param path - API path
   * @param init - Fetch init
   * @returns JSON
   */
  private fetch<T = AgentDto>(path: string, init?: RequestInit): Promise<T> {
    return httpJson<T>(this.baseUrl, path, {
      ...init,
      token: this.agentToken,
    });
  }
}

/**
 * Creates the wallet bound to this API key (idempotent: 1 key ↔ 1 agent).
 * @param baseUrl - API origin
 * @param agentToken - API key
 * @param params - Name, limits, optional chain
 * @returns Remote agent
 */
export async function createRemoteAgent(
  baseUrl: string,
  agentToken: string,
  params: AgentCreateParams,
): Promise<RemoteAgent> {
  const dto = await httpJson<AgentDto>(baseUrl, "/v1/sdk/agents", {
    method: "POST",
    token: agentToken,
    body: JSON.stringify({
      name: params.name,
      chain: params.chain,
      dailyLimit: params.dailyLimit,
      perTransaction: params.perTransaction,
      currency: params.currency,
      allowedHosts: params.allowedHosts,
      allowedPayees: params.allowedPayees,
    }),
  });
  return new RemoteAgent(dto, baseUrl, agentToken);
}

/**
 * Loads the single agent bound to this API key.
 * @param baseUrl - API origin
 * @param agentToken - API key
 * @returns Agent or undefined
 */
export async function getRemoteAgentForKey(
  baseUrl: string,
  agentToken: string,
): Promise<RemoteAgent | undefined> {
  const { items } = await httpJson<{ items: AgentDto[] }>(
    baseUrl,
    "/v1/sdk/agents",
    { token: agentToken },
  );
  const dto = items[0];
  return dto ? new RemoteAgent(dto, baseUrl, agentToken) : undefined;
}
