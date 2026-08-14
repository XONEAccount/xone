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
  chain: z.string().min(1).default("base-sepolia"),
  chainId: z.number().int().positive().default(84532),
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
  provider: z.string().min(1).max(64).default("privy"),
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

/** Create a developer agent with a restricted ETH wallet and spend caps. */
export const createDeveloperAgentSchema = z.object({
  ownerAddress: evmAddress,
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  /** Total ETH the agent may spend over its lifetime (policy cap). */
  maxAmount: z.number().positive().max(100),
  /** Max ETH per single machine payment. */
  maxSinglePayment: z.number().positive().max(100),
  /** Optional initial allowance credited after create (ETH). */
  initialAllowance: z.number().min(0).max(100).optional(),
  /** Runtime chain — default Base Sepolia (x402 testnet). */
  chain: z
    .enum(["ethereum-sepolia", "base-sepolia"])
    .default("base-sepolia"),
  /** Allowed spend asset — default USDC. */
  asset: z.enum(["ETH", "USDC"]).default("USDC"),
});

export const fundDeveloperAgentSchema = z.object({
  ownerAddress: evmAddress,
  amount: z.number().positive().max(100),
  /** On-chain tx hash of ETH transfer to the agent wallet. */
  txHash,
});

/** Update developer agent spend caps (owner only). */
export const updateDeveloperAgentSchema = z.object({
  ownerAddress: evmAddress,
  maxAmount: z.number().positive().max(100),
  maxSinglePayment: z.number().positive().max(100),
});

/** Soft-delete / disable a developer agent (owner only). */
export const deleteDeveloperAgentSchema = z.object({
  ownerAddress: evmAddress,
});

/** Stream chat with a developer agent (Vercel AI SDK UI messages + tools). */
export const developerAgentChatSchema = z.object({
  ownerAddress: evmAddress,
  /** UIMessage[] from `@ai-sdk/react` useChat */
  messages: z.array(z.any()).min(1),
});

/** Machine payment via MCP tool or x402 endpoint. */
export const machinePaySchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount"),
  recipient: evmAddress,
  merchant: z.string().max(120).optional(),
  resource: z.string().max(500).optional(),
  chain: z.string().min(1).default("base-sepolia"),
  asset: z.enum(["ETH", "USDC"]).default("USDC"),
  idempotencyKey: z.string().min(8).max(128).optional(),
  /** When true, return HTTP 402 challenge instead of auto-executing. */
  challengeOnly: z.boolean().optional(),
});

/** Pay an external x402 merchant resource (402 → sign → retry) with the agent wallet. */
export const merchantPaySchema = z.object({
  /** Absolute HTTPS URL of the paid resource, e.g. …/weather */
  merchantUrl: z.string().url().max(500),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const mcpJsonRpcSchema = z.object({
  jsonrpc: z.literal("2.0").default("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
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
export type CreateDeveloperAgentInput = z.infer<typeof createDeveloperAgentSchema>;
export type FundDeveloperAgentInput = z.infer<typeof fundDeveloperAgentSchema>;
export type UpdateDeveloperAgentInput = z.infer<typeof updateDeveloperAgentSchema>;
export type DeleteDeveloperAgentInput = z.infer<typeof deleteDeveloperAgentSchema>;
export type DeveloperAgentChatInput = z.infer<typeof developerAgentChatSchema>;
export type MachinePayInput = z.infer<typeof machinePaySchema>;
export type MerchantPayInput = z.infer<typeof merchantPaySchema>;
export type McpJsonRpcInput = z.infer<typeof mcpJsonRpcSchema>;
