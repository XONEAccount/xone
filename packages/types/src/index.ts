/** Shared domain types for the Web3 AI Wallet. */

export type PaymentStatus =
  | "created"
  | "awaiting_authorization"
  | "authorized"
  | "submitting"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "rejected"
  | "expired"
  | "failed"
  | "cancelled";

export type PolicyDecision = "allow" | "confirm" | "block";

export type ActorType = "user" | "agent" | "system" | "admin";

export type ChainType = "evm" | "solana";

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  privyUserId: string | null;
  primaryWalletAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  provider: string;
  providerWalletId: string | null;
  address: string;
  chainType: ChainType;
  isPrimary: boolean;
  createdAt: string;
}

export interface AssetBalance {
  symbol: string;
  name: string;
  address: string | null;
  decimals: number;
  balance: string;
  balanceUsd: string | null;
  chainId: number;
}

export interface PaymentRequest {
  id: string;
  userId: string;
  agentTaskId: string | null;
  orderId: string | null;
  merchant: string | null;
  merchantAgentId: string | null;
  asset: string;
  amount: string;
  currency: string;
  chain: string;
  recipient: string;
  status: PaymentStatus;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAuthorization {
  id: string;
  paymentRequestId: string;
  userId: string;
  decision: PolicyDecision;
  authorizedBy: ActorType;
  maxAmount: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  paymentRequestId: string;
  provider: string;
  txHash: string | null;
  amount: string;
  asset: string;
  chain: string;
  status: PaymentStatus;
  submittedAt: string | null;
  confirmedAt: string | null;
  failureReason: string | null;
  metadata: Record<string, unknown>;
}

export interface PaymentResult {
  payment: Payment;
  txHash: string | null;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  walletId: string;
  chain: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  asset: string;
  amount: string;
  status: "pending" | "confirmed" | "failed";
  direction: "in" | "out";
  createdAt: string;
  confirmedAt: string | null;
}

export interface PaymentPolicy {
  maxAutoAmount: string;
  maxDailyAutoAmount: string;
  allowedMerchants: string[];
  allowedCategories: string[];
  allowedChains: string[];
  allowedAssets: string[];
  requireConfirmationAbove: string;
  blockAbove: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  actorType: ActorType;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentTask {
  id: string;
  userId: string;
  sessionId: string | null;
  type: string;
  status: "pending" | "running" | "awaiting_user" | "completed" | "failed" | "cancelled";
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Developer-created agent with a restricted spending wallet. */
export interface DeveloperAgent {
  id: string;
  ownerWallet: string;
  name: string;
  description: string;
  apiKeyPrefix: string;
  walletAddress: string;
  /**
   * Policy spend cap. Same value as `dailyLimit` (SDK-aligned alias).
   */
  maxAmount: number;
  /** Per-payment cap. Same value as `perTransaction`. */
  maxSinglePayment: number;
  /** SDK-aligned alias of `maxAmount`. */
  dailyLimit: number;
  /** SDK-aligned alias of `maxSinglePayment`. */
  perTransaction: number;
  spentAmount: number;
  allowanceEth: number;
  asset: "ETH" | "USDC";
  /** Settlement currency (SDK `currency`). */
  currency: string;
  chain: string;
  status: "active" | "paused" | "disabled";
  allowedHosts: string[];
  allowedPayees: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentPayment {
  id: string;
  agentId: string;
  amount: number;
  asset: string;
  chain: string;
  recipient: string;
  merchant: string | null;
  resource: string | null;
  status: PaymentStatus;
  provider: string;
  failureReason: string | null;
  createdAt: string;
}
