import type { AgentPayment, DeveloperAgent } from "@xone/types";
import { apiFetch } from "@/lib/api";
import { getWebEnv } from "@/lib/env";

export type CreateAgentResponse = {
  ok: true;
  agent: DeveloperAgent;
  apiKey: string;
  endpoints: { mcp: string; x402: string };
  warning: string;
};

/**
 * Creates a developer agent with a restricted spending wallet.
 * Params aligned with `@xonepay/sdk` `AgentCreateParams`.
 * @param input - Name, chain, dailyLimit, perTransaction, allowlists
 */
export async function createDeveloperAgent(input: {
  ownerAddress: string;
  name: string;
  description?: string;
  /** SDK dailyLimit */
  dailyLimit: number;
  /** SDK perTransaction */
  perTransaction: number;
  chain?: "base-sepolia" | "base" | "polygon" | "arbitrum" | "ethereum-sepolia";
  currency?: "USDC" | "ETH";
  allowedHosts?: string[];
  allowedPayees?: string[];
  initialAllowance?: number;
}): Promise<CreateAgentResponse> {
  return apiFetch<CreateAgentResponse>("/api/developer/agents", {
    method: "POST",
    body: {
      ownerAddress: input.ownerAddress,
      name: input.name,
      description: input.description,
      dailyLimit: input.dailyLimit,
      perTransaction: input.perTransaction,
      chain: input.chain ?? "base-sepolia",
      currency: input.currency ?? "USDC",
      allowedHosts: input.allowedHosts,
      allowedPayees: input.allowedPayees,
      initialAllowance: input.initialAllowance,
    },
    token: "demo",
  });
}

/**
 * Lists developer agents for an owner wallet.
 * @param ownerAddress - Owner wallet
 */
export async function listDeveloperAgents(
  ownerAddress: string,
): Promise<DeveloperAgent[]> {
  const data = await apiFetch<{ agents?: DeveloperAgent[] }>(
    `/api/developer/agents?address=${encodeURIComponent(ownerAddress)}`,
    { token: "demo" },
  );
  return Array.isArray(data.agents) ? data.agents : [];
}

/**
 * Credits restricted USDC allowance after an on-chain transfer to the agent wallet.
 * @param agentId - Agent id
 * @param ownerAddress - Owner wallet
 * @param amount - USDC amount
 * @param txHash - Funding transaction hash
 */
export async function fundDeveloperAgent(
  agentId: string,
  ownerAddress: string,
  amount: number,
  txHash: string,
): Promise<DeveloperAgent> {
  const data = await apiFetch<{ ok: true; agent: DeveloperAgent }>(
    `/api/developer/agents/${agentId}/fund`,
    {
      method: "POST",
      body: { ownerAddress, amount, txHash },
      token: "demo",
      idempotencyKey: txHash,
    },
  );
  return data.agent;
}

/**
 * Runs the first machine payment via the x402 endpoint using the agent API key.
 * @param apiKey - One-time returned agent key
 * @param input - Pay payload
 */
export async function runFirstMachinePayment(
  apiKey: string,
  input: {
    amount: string;
    recipient: string;
    merchant?: string;
    resource?: string;
    idempotencyKey?: string;
  },
): Promise<{
  ok: true;
  receipt: {
    paymentId: string;
    amount: string;
    asset: "ETH" | "USDC";
    chain: string;
    recipient: string;
    provider: "x402";
    status: string;
  };
  agent: Pick<
    DeveloperAgent,
    "id" | "walletAddress" | "allowanceEth" | "spentAmount" | "maxAmount" | "maxSinglePayment"
  >;
}> {
  const env = getWebEnv();
  const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
  const response = await fetch(`${env.apiUrl}/api/x402/pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      amount: input.amount,
      recipient: input.recipient,
      merchant: input.merchant ?? "xone-demo-merchant",
      resource: input.resource ?? "xone://first-machine-payment",
      asset: "USDC",
      chain: "base-sepolia",
      idempotencyKey,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    receipt?: {
      paymentId: string;
      amount: string;
      asset: "ETH" | "USDC";
      chain: string;
      recipient: string;
      provider: "x402";
      status: string;
    };
    agent?: Pick<
      DeveloperAgent,
      "id" | "walletAddress" | "allowanceEth" | "spentAmount" | "maxAmount" | "maxSinglePayment"
    >;
  };

  if (!response.ok || !data.ok || !data.receipt || !data.agent) {
    throw new Error(data.error ?? `Payment failed (${response.status})`);
  }

  return { ok: true, receipt: data.receipt, agent: data.agent };
}

/** Deployed x402 seller weather endpoint (exact $0.001 USDC). */
export const REMOTE_X402_MERCHANT_URL =
  "https://xone-x402-seller.tskwangyi.workers.dev/weather";

/** Local seller weather endpoint for Node/dev. */
export const LOCAL_X402_MERCHANT_URL = "http://localhost:4021/weather";

/** Default merchant URL for the create-agent machine-pay step (online seller). */
export const DEFAULT_X402_MERCHANT_URL = REMOTE_X402_MERCHANT_URL;

/**
 * Pays an allowlisted external x402 merchant with the agent sealed EOA.
 * Flow: GET merchant → 402 → sign → retry → debit allowance.
 * @param apiKey - Agent API key
 * @param input - Merchant URL + optional idempotency key
 */
export async function runMerchantPayment(
  apiKey: string,
  input: {
    merchantUrl: string;
    idempotencyKey?: string;
  },
): Promise<{
  ok: true;
  receipt: {
    paymentId: string;
    amount: string;
    asset: "USDC";
    chain: string;
    recipient: string;
    provider: "x402-merchant";
    status: string;
    merchantUrl: string;
    merchantBody: unknown;
    settlementTx?: string;
  };
  agent: Pick<
    DeveloperAgent,
    "id" | "walletAddress" | "allowanceEth" | "spentAmount" | "maxAmount" | "maxSinglePayment"
  >;
}> {
  const env = getWebEnv();
  const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
  const response = await fetch(`${env.apiUrl}/api/x402/merchant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      merchantUrl: input.merchantUrl,
      idempotencyKey,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    receipt?: {
      paymentId: string;
      amount: string;
      asset: "USDC";
      chain: string;
      recipient: string;
      provider: "x402-merchant";
      status: string;
      merchantUrl: string;
      merchantBody: unknown;
      settlementTx?: string;
    };
    agent?: Pick<
      DeveloperAgent,
      "id" | "walletAddress" | "allowanceEth" | "spentAmount" | "maxAmount" | "maxSinglePayment"
    >;
  };

  if (!response.ok || !data.ok || !data.receipt || !data.agent) {
    throw new Error(data.error ?? `Merchant payment failed (${response.status})`);
  }

  return { ok: true, receipt: data.receipt, agent: data.agent };
}

/**
 * Loads agent detail + payment history for the owner.
 * @param agentId - Agent id
 * @param ownerAddress - Owner wallet
 */
export async function getDeveloperAgentDetail(
  agentId: string,
  ownerAddress: string,
): Promise<{ agent: DeveloperAgent; payments: AgentPayment[] }> {
  const data = await apiFetch<{ agent?: DeveloperAgent; payments?: AgentPayment[] }>(
    `/api/developer/agents/${agentId}?address=${encodeURIComponent(ownerAddress)}`,
    { token: "demo" },
  );
  if (!data.agent) {
    throw new Error("Agent not found");
  }
  return {
    agent: data.agent,
    payments: Array.isArray(data.payments) ? data.payments : [],
  };
}

/**
 * Updates spend caps for an owned developer agent.
 * @param agentId - Agent id
 * @param ownerAddress - Owner wallet
 * @param dailyLimit - SDK daily spend cap
 * @param perTransaction - SDK per-payment cap
 * @param extras - Optional allowlists
 */
export async function updateDeveloperAgent(
  agentId: string,
  ownerAddress: string,
  dailyLimit: number,
  perTransaction: number,
  extras?: { allowedHosts?: string[]; allowedPayees?: string[] },
): Promise<DeveloperAgent> {
  const data = await apiFetch<{ ok: true; agent: DeveloperAgent }>(
    `/api/developer/agents/${agentId}`,
    {
      method: "PATCH",
      body: {
        ownerAddress,
        dailyLimit,
        perTransaction,
        allowedHosts: extras?.allowedHosts,
        allowedPayees: extras?.allowedPayees,
      },
      token: "demo",
    },
  );
  return data.agent;
}

/**
 * Soft-deletes (disables) an owned developer agent.
 * @param agentId - Agent id
 * @param ownerAddress - Owner wallet
 */
export async function deleteDeveloperAgent(
  agentId: string,
  ownerAddress: string,
): Promise<void> {
  await apiFetch<{ ok: true }>(`/api/developer/agents/${agentId}`, {
    method: "DELETE",
    body: { ownerAddress },
    token: "demo",
  });
}

/**
 * Pauses an agent wallet (blocks API-key payments until resumed).
 * @param agentId - Agent id
 * @param ownerAddress - Owner wallet
 */
export async function pauseDeveloperAgent(
  agentId: string,
  ownerAddress: string,
): Promise<DeveloperAgent> {
  const data = await apiFetch<{ ok: true; agent: DeveloperAgent }>(
    `/api/developer/agents/${agentId}/pause`,
    {
      method: "POST",
      body: { ownerAddress },
      token: "demo",
    },
  );
  return data.agent;
}

/**
 * Resumes a paused agent wallet.
 * @param agentId - Agent id
 * @param ownerAddress - Owner wallet
 */
export async function resumeDeveloperAgent(
  agentId: string,
  ownerAddress: string,
): Promise<DeveloperAgent> {
  const data = await apiFetch<{ ok: true; agent: DeveloperAgent }>(
    `/api/developer/agents/${agentId}/resume`,
    {
      method: "POST",
      body: { ownerAddress },
      token: "demo",
    },
  );
  return data.agent;
}

