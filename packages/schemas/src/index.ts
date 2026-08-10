import { z } from "zod";

export const paymentStatusSchema = z.enum([
  "created",
  "awaiting_authorization",
  "authorized",
  "submitting",
  "submitted",
  "confirming",
  "confirmed",
  "rejected",
  "expired",
  "failed",
  "cancelled",
]);

export const createPaymentRequestSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount"),
  asset: z.string().min(1),
  currency: z.string().min(1).default("USD"),
  chain: z.string().min(1),
  recipient: z.string().min(1),
  merchant: z.string().optional(),
  merchantAgentId: z.string().optional(),
  orderId: z.string().uuid().optional(),
  agentTaskId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const authorizePaymentSchema = z.object({
  confirm: z.boolean(),
  note: z.string().max(500).optional(),
});

export const sendTokenSchema = z.object({
  walletId: z.string().uuid(),
  to: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount"),
  asset: z.string().min(1),
  chain: z.string().min(1),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

const evmAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address");

const txHash = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash");

/**
 * Payload sent after an on-chain transfer is submitted successfully.
 * Backend records an `out` leg for the sender and an `in` leg for the recipient
 * when the recipient wallet is known (or creates a profile stub so they can see it).
 */
export const recordTransferSchema = z.object({
  txHash,
  from: evmAddress,
  to: evmAddress,
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount"),
  asset: z.enum(["ETH", "USDC"]),
  chain: z.string().min(1).default("ethereum-sepolia"),
  chainId: z.number().int().positive().default(11155111),
  status: z.enum(["pending", "submitted", "confirmed", "failed"]).default("submitted"),
});

export const agentChatSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
});

export const linkWalletSchema = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address"),
  provider: z.string().min(1).max(64).default("thirdweb"),
  providerWalletId: z.string().max(128).optional(),
  chainType: z.enum(["evm", "solana"]).default("evm"),
  email: z.string().email().optional(),
  displayName: z.string().max(120).optional(),
});

export const a2aFundSchema = z.object({
  address: evmAddress,
  amount: z.number().positive(),
});

export const a2aUpdateAgentSchema = z.object({
  address: evmAddress,
  enabled: z.boolean().optional(),
  maxAmount: z.number().positive().optional(),
  maxSinglePayment: z.number().positive().optional(),
});

export const a2aSettleSchema = z.object({
  address: evmAddress,
  agentId: z.string().min(1),
  amount: z.number().positive(),
  title: z.string().min(1).max(200),
});

export type CreatePaymentRequestInput = z.infer<typeof createPaymentRequestSchema>;
export type AuthorizePaymentInput = z.infer<typeof authorizePaymentSchema>;
export type SendTokenInput = z.infer<typeof sendTokenSchema>;
export type RecordTransferInput = z.infer<typeof recordTransferSchema>;
export type AgentChatInput = z.infer<typeof agentChatSchema>;
export type LinkWalletInput = z.infer<typeof linkWalletSchema>;
export type A2AFundInput = z.infer<typeof a2aFundSchema>;
export type A2AUpdateAgentInput = z.infer<typeof a2aUpdateAgentSchema>;
export type A2ASettleInput = z.infer<typeof a2aSettleSchema>;
