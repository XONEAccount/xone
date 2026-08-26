/**
 * Shared DTO shapes returned by the Hono API / consumed by the console.
 */

export type ApiKeyDto = {
  id: string;
  name: string;
  /** Full secret only on create; empty when listing. */
  token: string;
  createdAt: string;
  status: "active" | "deleted";
};

export type AgentDto = {
  id: string;
  name: string;
  apiKeyId: string;
  chain: "base" | "base-sepolia" | "solana" | "polygon" | "arbitrum";
  currency: string;
  defaultAmount: string;
  dailyLimit: number;
  perTransaction: number;
  remainingDaily: number;
  address: string;
  walletFamily: "evm" | "solana";
  createdAt: string;
  status: "active" | "paused" | "exhausted" | "deleted";
  allowedHosts?: string[];
  allowedPayees?: string[];
  /** Present only on SDK create response. */
  privateKey?: string;
};

export type HistoryDto = {
  id: string;
  agentId?: string;
  type:
    | "deposit"
    | "withdraw"
    | "x402"
    | "transfer"
    | "limits_update"
    | "pause"
    | "resume"
    | "delete";
  createdAt: string;
  amount?: number;
  currency?: string;
  to?: string;
  url?: string;
  txHash?: string;
  meta?: Record<string, unknown>;
};

export type ProfileDto = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  createdAt: string;
};
