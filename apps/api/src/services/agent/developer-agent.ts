import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_CHAIN } from "@wallet/config";
import type { AgentPayment, DeveloperAgent, PaymentStatus } from "@wallet/types";
import { createThirdwebClient } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import {
  encryptSecret,
  generateAgentApiKey,
  generatePrivateKeyHex,
  hashApiKey,
} from "../../lib/crypto.js";
import { getEnv } from "../../lib/env.js";

type DeveloperAgentRow = {
  id: string;
  owner_wallet: string;
  name: string;
  description: string;
  api_key_prefix: string;
  wallet_address: string;
  encrypted_private_key: string;
  max_amount: string | number;
  max_single_payment: string | number;
  spent_amount: string | number;
  allowance_eth: string | number;
  asset: string;
  chain: string;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
};

type AgentPaymentRow = {
  id: string;
  agent_id: string;
  amount: string | number;
  asset: string;
  chain: string;
  recipient: string;
  merchant: string | null;
  resource: string | null;
  status: PaymentStatus;
  provider: string;
  failure_reason: string | null;
  created_at: string;
};

export type CreateDeveloperAgentResult = {
  agent: DeveloperAgent;
  /** Shown once — never persisted in plaintext. */
  apiKey: string;
  mcpEndpoint: string;
  x402Endpoint: string;
};

export type MachinePayResult =
  | {
      ok: true;
      payment: AgentPayment;
      agent: DeveloperAgent;
      receipt: {
        paymentId: string;
        amount: string;
        asset: "ETH";
        chain: string;
        recipient: string;
        provider: "x402";
        status: PaymentStatus;
      };
    }
  | {
      ok: false;
      status: 402 | 400 | 403;
      error: string;
      x402?: X402Challenge;
    };

export type X402Challenge = {
  x402Version: 1;
  error: string;
  accepts: Array<{
    scheme: "exact";
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    mimeType: string;
    payTo: string;
    maxTimeoutSeconds: number;
    asset: string;
    extra: {
      agentId: string;
      name: string;
      maxAmount: number;
      maxSinglePayment: number;
      allowanceEth: number;
      spentAmount: number;
    };
  }>;
};

/**
 * Maps a DB row to the public DeveloperAgent shape (no secrets).
 * @param row - Supabase row
 */
export function toDeveloperAgent(row: DeveloperAgentRow): DeveloperAgent {
  return {
    id: row.id,
    ownerWallet: row.owner_wallet,
    name: row.name,
    description: row.description,
    apiKeyPrefix: row.api_key_prefix,
    walletAddress: row.wallet_address,
    maxAmount: Number(row.max_amount),
    maxSinglePayment: Number(row.max_single_payment),
    spentAmount: Number(row.spent_amount),
    allowanceEth: Number(row.allowance_eth),
    asset: "ETH",
    chain: row.chain,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param row - Payment row
 */
function toAgentPayment(row: AgentPaymentRow): AgentPayment {
  return {
    id: row.id,
    agentId: row.agent_id,
    amount: Number(row.amount),
    asset: row.asset,
    chain: row.chain,
    recipient: row.recipient,
    merchant: row.merchant,
    resource: row.resource,
    status: row.status,
    provider: row.provider,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
  };
}

/**
 * Ensures a profiles row exists for FK inserts.
 * @param admin - Supabase admin
 * @param address - Lowercased wallet
 */
async function ensureProfile(admin: SupabaseClient, address: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin.from("profiles").upsert(
    {
      wallet_address: address,
      display_name: `${address.slice(0, 6)}…${address.slice(-4)}`,
      updated_at: now,
    },
    { onConflict: "wallet_address" },
  );
  if (error) throw new Error(`Failed to ensure profile: ${error.message}`);
}

/**
 * Creates a developer agent with a dedicated ETH EOA and spend caps.
 * @param admin - Supabase admin
 * @param input - Create payload
 * @returns Agent + one-time API key
 */
export async function createDeveloperAgent(
  admin: SupabaseClient,
  input: {
    ownerAddress: string;
    name: string;
    description?: string;
    maxAmount: number;
    maxSinglePayment: number;
    initialAllowance?: number;
  },
): Promise<CreateDeveloperAgentResult> {
  const env = getEnv();
  if (!env.jwtSecret && !env.supabaseServiceRoleKey) {
    throw new Error("JWT_SECRET (or service role) required to seal agent keys");
  }
  if (input.maxSinglePayment > input.maxAmount) {
    throw new Error("maxSinglePayment cannot exceed maxAmount");
  }

  const owner = input.ownerAddress.toLowerCase();
  const name = input.name.trim();
  if (!name) throw new Error("Agent name is required");

  await ensureProfile(admin, owner);

  const { data: existingNames, error: nameError } = await admin
    .from("developer_agents")
    .select("id, name")
    .eq("owner_wallet", owner)
    .eq("status", "active");
  if (nameError) throw new Error(nameError.message);
  const duplicated = (existingNames ?? []).some(
    (row) => String(row.name).trim().toLowerCase() === name.toLowerCase(),
  );
  if (duplicated) {
    throw new Error("Agent 名称已存在，请换一个名称");
  }

  const sealSecret = env.jwtSecret || env.supabaseServiceRoleKey;
  const client = createThirdwebClient({
    clientId: env.thirdwebClientId || "developer-agent",
    secretKey: env.thirdwebSecretKey || undefined,
  });

  const privateKey = generatePrivateKeyHex();
  const account = privateKeyToAccount({ client, privateKey });
  const walletAddress = account.address.toLowerCase();
  await ensureProfile(admin, walletAddress);

  const apiKey = generateAgentApiKey();
  const apiKeyHash = await hashApiKey(apiKey);
  const encryptedPrivateKey = await encryptSecret(privateKey, sealSecret);
  const initial = Math.min(input.initialAllowance ?? 0, input.maxAmount);
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("developer_agents")
    .insert({
      owner_wallet: owner,
      name,
      description: (input.description ?? "").trim(),
      api_key_hash: apiKeyHash,
      api_key_prefix: apiKey.slice(0, 16),
      wallet_address: walletAddress,
      encrypted_private_key: encryptedPrivateKey,
      max_amount: input.maxAmount,
      max_single_payment: input.maxSinglePayment,
      spent_amount: 0,
      allowance_eth: initial,
      asset: "ETH",
      chain: DEFAULT_CHAIN.slug,
      status: "active",
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create developer agent");
  }

  const agent = toDeveloperAgent(data as DeveloperAgentRow);
  return {
    agent,
    apiKey,
    mcpEndpoint: "/api/mcp",
    x402Endpoint: "/api/x402/pay",
  };
}

/**
 * Lists agents owned by a wallet.
 * @param admin - Supabase admin
 * @param ownerAddress - Owner wallet
 */
export async function listDeveloperAgents(
  admin: SupabaseClient,
  ownerAddress: string,
): Promise<DeveloperAgent[]> {
  const { data, error } = await admin
    .from("developer_agents")
    .select("*")
    .eq("owner_wallet", ownerAddress.toLowerCase())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DeveloperAgentRow[] | null)?.map(toDeveloperAgent) ?? [];
}

/**
 * Loads one agent by id for its owner.
 * @param admin - Supabase admin
 * @param id - Agent id
 * @param ownerAddress - Owner wallet
 */
export async function getDeveloperAgentForOwner(
  admin: SupabaseClient,
  id: string,
  ownerAddress: string,
): Promise<DeveloperAgent | null> {
  const { data, error } = await admin
    .from("developer_agents")
    .select("*")
    .eq("id", id)
    .eq("owner_wallet", ownerAddress.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toDeveloperAgent(data as DeveloperAgentRow) : null;
}

/**
 * Credits ETH spending allowance after a verified on-chain transfer to the agent wallet.
 * Idempotent on txHash — replaying the same hash returns the existing agent state.
 * @param admin - Supabase admin
 * @param id - Agent id
 * @param ownerAddress - Owner wallet
 * @param amount - ETH transferred
 * @param txHash - On-chain transaction hash
 */
export async function fundDeveloperAgent(
  admin: SupabaseClient,
  id: string,
  ownerAddress: string,
  amount: number,
  txHash: string,
): Promise<DeveloperAgent> {
  const owner = ownerAddress.toLowerCase();
  const hash = txHash.toLowerCase();

  const { data: existingFund } = await admin
    .from("agent_fundings")
    .select("agent_id")
    .eq("tx_hash", hash)
    .maybeSingle();

  if (existingFund) {
    if (existingFund.agent_id !== id) {
      throw new Error("Transaction already used for another agent");
    }
    const agent = await getDeveloperAgentForOwner(admin, id, owner);
    if (!agent) throw new Error("Agent not found");
    return agent;
  }

  const { data, error } = await admin
    .from("developer_agents")
    .select("*")
    .eq("id", id)
    .eq("owner_wallet", owner)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Agent not found");

  const row = data as DeveloperAgentRow;
  const nextAllowance = Number(row.allowance_eth) + amount;
  if (nextAllowance > Number(row.max_amount)) {
    throw new Error("Allowance would exceed maxAmount");
  }

  const { error: fundInsertError } = await admin.from("agent_fundings").insert({
    agent_id: id,
    tx_hash: hash,
    from_address: owner,
    amount,
  });
  if (fundInsertError) {
    // Race: another request inserted the same tx — treat as idempotent success.
    if (fundInsertError.code === "23505") {
      const agent = await getDeveloperAgentForOwner(admin, id, owner);
      if (!agent) throw new Error("Agent not found");
      return agent;
    }
    throw new Error(fundInsertError.message);
  }

  const { data: updated, error: updateError } = await admin
    .from("developer_agents")
    .update({
      allowance_eth: nextAllowance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Fund failed");
  }
  return toDeveloperAgent(updated as DeveloperAgentRow);
}

/**
 * Resolves an agent from a raw API key.
 * @param admin - Supabase admin
 * @param apiKey - Bearer API key
 */
export async function getDeveloperAgentByApiKey(
  admin: SupabaseClient,
  apiKey: string,
): Promise<DeveloperAgentRow | null> {
  const apiKeyHash = await hashApiKey(apiKey);
  const { data, error } = await admin
    .from("developer_agents")
    .select("*")
    .eq("api_key_hash", apiKeyHash)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DeveloperAgentRow | null) ?? null;
}

/**
 * Builds an x402 Payment Required challenge for a machine pay attempt.
 * @param agent - Agent row
 * @param amount - Requested amount string
 * @param resource - Resource identifier
 */
export function buildX402Challenge(
  agentRow: DeveloperAgentRow,
  amount: string,
  resource: string,
): X402Challenge {
  const view = toDeveloperAgent(agentRow);

  return {
    x402Version: 1,
    error: "Payment required",
    accepts: [
      {
        scheme: "exact",
        network: `eip155:${DEFAULT_CHAIN.id}`,
        maxAmountRequired: amount,
        resource,
        description: `Machine payment from agent ${view.name}`,
        mimeType: "application/json",
        payTo: view.walletAddress,
        maxTimeoutSeconds: 300,
        asset: "0x0000000000000000000000000000000000000000",
        extra: {
          agentId: view.id,
          name: view.name,
          maxAmount: view.maxAmount,
          maxSinglePayment: view.maxSinglePayment,
          allowanceEth: view.allowanceEth,
          spentAmount: view.spentAmount,
        },
      },
    ],
  };
}

/**
 * Executes a policy-gated machine payment from the agent allowance (x402 rail).
 * Does not claim an on-chain tx succeeded — debit is the restricted ETH wallet budget.
 * @param admin - Supabase admin
 * @param agentRow - Authenticated agent
 * @param input - Pay payload
 */
export async function executeMachinePayment(
  admin: SupabaseClient,
  agentRow: DeveloperAgentRow,
  input: {
    amount: string;
    recipient: string;
    merchant?: string;
    resource?: string;
    chain: string;
    asset: "ETH";
    idempotencyKey?: string;
    challengeOnly?: boolean;
  },
): Promise<MachinePayResult> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, status: 400, error: "Invalid amount" };
  }

  const agent = toDeveloperAgent(agentRow);
  const resource = input.resource ?? `agent://${agent.id}/pay`;

  if (input.challengeOnly) {
    return {
      ok: false,
      status: 402,
      error: "Payment required",
      x402: buildX402Challenge(agentRow, input.amount, resource),
    };
  }

  if (input.idempotencyKey) {
    const { data: existing } = await admin
      .from("agent_payments")
      .select("*")
      .eq("agent_id", agent.id)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) {
      const payment = toAgentPayment(existing as AgentPaymentRow);
      return {
        ok: true,
        payment,
        agent,
        receipt: {
          paymentId: payment.id,
          amount: String(payment.amount),
          asset: "ETH",
          chain: payment.chain,
          recipient: payment.recipient,
          provider: "x402",
          status: payment.status,
        },
      };
    }
  }

  if (amount > agent.maxSinglePayment) {
    await insertFailedPayment(admin, agent.id, input, amount, "Exceeds maxSinglePayment");
    return { ok: false, status: 403, error: "Exceeds maxSinglePayment" };
  }

  if (agent.spentAmount + amount > agent.maxAmount) {
    await insertFailedPayment(admin, agent.id, input, amount, "Exceeds maxAmount");
    return { ok: false, status: 403, error: "Exceeds maxAmount" };
  }

  if (amount > agent.allowanceEth) {
    return {
      ok: false,
      status: 402,
      error: "Insufficient agent allowance — fund the restricted ETH wallet first",
      x402: buildX402Challenge(agentRow, input.amount, resource),
    };
  }

  const { data: paymentRow, error: payError } = await admin
    .from("agent_payments")
    .insert({
      agent_id: agent.id,
      idempotency_key: input.idempotencyKey ?? null,
      amount,
      asset: "ETH",
      chain: input.chain,
      recipient: input.recipient.toLowerCase(),
      merchant: input.merchant ?? null,
      resource,
      status: "confirmed",
      provider: "x402",
      metadata: {
        rail: "restricted-eth-allowance",
        note: "Debited from agent policy wallet allowance (not an on-chain broadcast)",
      },
    })
    .select("*")
    .single();

  if (payError || !paymentRow) {
    return { ok: false, status: 400, error: payError?.message ?? "Payment insert failed" };
  }

  const { data: updated, error: updateError } = await admin
    .from("developer_agents")
    .update({
      allowance_eth: agent.allowanceEth - amount,
      spent_amount: agent.spentAmount + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agent.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return { ok: false, status: 400, error: updateError?.message ?? "Failed to update allowance" };
  }

  const payment = toAgentPayment(paymentRow as AgentPaymentRow);
  return {
    ok: true,
    payment,
    agent: toDeveloperAgent(updated as DeveloperAgentRow),
    receipt: {
      paymentId: payment.id,
      amount: String(payment.amount),
      asset: "ETH",
      chain: payment.chain,
      recipient: payment.recipient,
      provider: "x402",
      status: payment.status,
    },
  };
}

/**
 * Lists recent machine payments for an agent.
 * @param admin - Supabase admin
 * @param agentId - Agent id
 * @param limit - Max rows
 */
export async function listAgentPayments(
  admin: SupabaseClient,
  agentId: string,
  limit = 20,
): Promise<AgentPayment[]> {
  const { data, error } = await admin
    .from("agent_payments")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as AgentPaymentRow[] | null)?.map(toAgentPayment) ?? [];
}

/**
 * @param admin - Supabase admin
 * @param agentId - Agent id
 * @param input - Pay input
 * @param amount - Numeric amount
 * @param reason - Failure reason
 */
async function insertFailedPayment(
  admin: SupabaseClient,
  agentId: string,
  input: {
    recipient: string;
    merchant?: string;
    resource?: string;
    chain: string;
    idempotencyKey?: string;
  },
  amount: number,
  reason: string,
): Promise<void> {
  await admin.from("agent_payments").insert({
    agent_id: agentId,
    idempotency_key: input.idempotencyKey ?? null,
    amount,
    asset: "ETH",
    chain: input.chain,
    recipient: input.recipient.toLowerCase(),
    merchant: input.merchant ?? null,
    resource: input.resource ?? null,
    status: "rejected",
    provider: "x402",
    failure_reason: reason,
  });
}
