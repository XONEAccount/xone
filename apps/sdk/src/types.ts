/**
 * Supported x402 settlement networks.
 * Default for new agents is Base Sepolia (testnet).
 */
export type XOneChain =
  | "base"
  | "base-sepolia"
  | "solana"
  | "polygon"
  | "arbitrum";

/**
 * Lifecycle status for an agent wallet.
 */
export type AgentStatus = "active" | "paused" | "exhausted" | "deleted";

/**
 * Lifecycle status for an API key.
 */
export type ApiKeyStatus = "active" | "deleted";

/**
 * Configuration for the XOne client.
 */
export interface XOneConfig {
  /**
   * Console spend token (`xone_…`). Optional when `agent.create({ apiKey })`
   * supplies the key instead.
   */
  agentToken?: string;
}

/**
 * Parameters for creating an API key in the personal console.
 */
export interface ApiKeyCreateParams {
  /** Human-readable label for the key. */
  name: string;
}

/**
 * Public API key record (token is shown once / stored for mock).
 */
export interface ApiKeyRecord {
  id: string;
  name: string;
  /** Secret token passed to `new XOne({ agentToken })`. */
  token: string;
  createdAt: string;
  status: ApiKeyStatus;
}

/**
 * Parameters for creating an agent (1:1 with a local wallet + spend limits).
 */
export interface AgentCreateParams {
  /**
   * Console spend token (`xone_…`). User-supplied — never hard-code this.
   * Required so create cannot proceed without an explicit key.
   */
  apiKey: string;
  /** Human-readable agent name. */
  name: string;
  /**
   * Settlement chain for this agent.
   * @default "base-sepolia"
   */
  chain?: XOneChain;
  /** Maximum spend per UTC calendar day (currency units). */
  dailyLimit: number | string;
  /** Maximum spend per single transaction (currency units). */
  perTransaction: number | string;
  /**
   * Settlement currency.
   * @default "USDC"
   */
  currency?: string;
  /**
   * Optional x402 hostname allowlist (`example.com` or `*.example.com`).
   * Empty / omitted = any public host.
   */
  allowedHosts?: string[];
  /**
   * Optional 0x payTo allowlist. Empty / omitted = any payee.
   */
  allowedPayees?: string[];
}

/**
 * Snapshot of an agent's spend limits.
 */
export interface AgentLimits {
  dailyLimit: number;
  perTransaction: number;
  /** Remaining spend allowed today (UTC day). */
  remainingDaily: number;
  currency: string;
  /** UTC day key currently applied (`YYYY-MM-DD`). */
  dailyPeriod?: string;
  allowedHosts?: string[];
  allowedPayees?: string[];
}

/**
 * Partial update for spend limits.
 */
export interface UpdateLimitsParams {
  dailyLimit?: number | string;
  perTransaction?: number | string;
  /**
   * Optional x402 hostname allowlist (`example.com` or `*.example.com`).
   * Empty / omitted = any public host.
   */
  allowedHosts?: string[];
  /**
   * Optional 0x payTo allowlist. Empty / omitted = any payee.
   */
  allowedPayees?: string[];
}

/**
 * Pay an x402 HTTP resource with the agent wallet.
 */
export interface PayParams {
  /** URL that returns HTTP 402 Payment Required (x402). */
  url: string;
  /**
   * Optional ceiling (human USDC). If the 402 quote exceeds this, payment aborts.
   * Does **not** override the on-chain quote / ledger debit amount.
   */
  maxAmount?: string | number;
  /**
   * Required for safe retries. Reuse the same key on network retries;
   * never mint a new key until you know the previous attempt did not settle.
   * When omitted, the SDK generates one for this call only.
   */
  idempotencyKey?: string;
}

/**
 * Optional filters for `getHistory`.
 */
export interface GetHistoryParams {
  /** Max entries to return (newest first). */
  limit?: number;
  /** Only include these event types. */
  types?: AgentHistoryType[];
}

/**
 * History event kinds recorded for an agent.
 */
export type AgentHistoryType =
  | "deposit"
  | "withdraw"
  | "x402"
  | "transfer"
  | "limits_update"
  | "pause"
  | "resume"
  | "delete";

/**
 * A single ledger / lifecycle event.
 */
export interface AgentHistoryEntry {
  id: string;
  type: AgentHistoryType;
  createdAt: string;
  amount?: number;
  currency?: string;
  to?: string;
  url?: string;
  txHash?: string;
  /** Extra fields (e.g. previous limits). */
  meta?: Record<string, unknown>;
}

/**
 * Local wallet material generated or loaded by the SDK.
 */
export interface WalletInfo {
  chain: XOneChain;
  address: string;
  /** Never log or expose in production tools output. */
  privateKey: string;
  family: "evm" | "solana";
}

/**
 * Reason metadata when spending against limits (x402 / transfer).
 */
export interface SpendMeta {
  type: "x402" | "transfer";
  to?: string;
  url?: string;
  txHash?: string;
  /** Skip history (pre-settlement reserve). */
  silent?: boolean;
}

/**
 * Persisted agent record in the mock store.
 */
export interface AgentRecord {
  id: string;
  name: string;
  /** API key that created this agent. */
  apiKeyId: string;
  chain: XOneChain;
  currency: string;
  defaultAmount: string;
  dailyLimit: number;
  perTransaction: number;
  remainingDaily: number;
  /** UTC day key for remainingDaily. */
  dailyPeriod: string;
  wallet: WalletInfo;
  createdAt: string;
  status: AgentStatus;
  allowedHosts: string[];
  allowedPayees: string[];
  /** Append-only event log (newest last in store; APIs return newest first). */
  history: AgentHistoryEntry[];
}

/**
 * Wallet address + spend-policy snapshot (not an on-chain token balance).
 * Fund USDC on-chain at `address`; use `remainingDaily` / `perTransaction` for policy.
 */
export interface SpendSnapshot {
  currency: string;
  chain: XOneChain;
  address: string;
  remainingDaily: number;
  dailyLimit: number;
  perTransaction: number;
  status: AgentStatus;
  /**
   * Reminder: fund this address on-chain; this snapshot is policy, not RPC balance.
   */
  note: "Fund on-chain USDC at address; limits use remainingDaily / perTransaction";
}

/**
 * @deprecated Use {@link SpendSnapshot}. Same shape — kept for older imports.
 */
export type BalanceSnapshot = SpendSnapshot;

/**
 * Pay result shared by mock + remote.
 */
export interface PayResult {
  ok: true;
  mock: false;
  protocol: "x402";
  url: string;
  paid: number;
  currency: string;
  chain: XOneChain;
  from: string;
  status: number;
  body: unknown;
  remainingDaily: number;
  settlement?: unknown;
  network?: string;
  /** Key used for this payment (reuse on retries). */
  idempotencyKey: string;
  /** True when the server returned a cached success for the same key. */
  replay?: boolean;
}
