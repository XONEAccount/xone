import type { AgentPayment, DeveloperAgent } from "@wallet/types";
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
 * Creates a developer agent with a restricted ETH wallet.
 * @param ownerAddress - Connected owner wallet
 * @param input - Name and spend limits
 */
export async function createDeveloperAgent(input: {
  ownerAddress: string;
  name: string;
  description?: string;
  maxAmount: number;
  maxSinglePayment: number;
  initialAllowance?: number;
}): Promise<CreateAgentResponse> {
  return apiFetch<CreateAgentResponse>("/api/developer/agents", {
    method: "POST",
    body: input,
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
  const data = await apiFetch<{ agents: DeveloperAgent[] }>(
    `/api/developer/agents?address=${encodeURIComponent(ownerAddress)}`,
    { token: "demo" },
  );
  return data.agents;
}

/**
 * Credits restricted ETH allowance after an on-chain transfer to the agent wallet.
 * @param agentId - Agent id
 * @param ownerAddress - Owner wallet
 * @param amount - ETH amount
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
    asset: "ETH";
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
      asset: "ETH",
      chain: "ethereum-sepolia",
      idempotencyKey,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    receipt?: {
      paymentId: string;
      amount: string;
      asset: "ETH";
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

/**
 * Loads agent detail + payment history for the owner.
 * @param agentId - Agent id
 * @param ownerAddress - Owner wallet
 */
export async function getDeveloperAgentDetail(
  agentId: string,
  ownerAddress: string,
): Promise<{ agent: DeveloperAgent; payments: AgentPayment[] }> {
  return apiFetch<{ agent: DeveloperAgent; payments: AgentPayment[] }>(
    `/api/developer/agents/${agentId}?address=${encodeURIComponent(ownerAddress)}`,
    { token: "demo" },
  );
}
