import { apiFetch } from "@/lib/api";
import type { ConnectedAgent, LedgerRecord } from "@/stores/a2a";

export type A2AAccountDto = {
  walletAddress: string;
  balance: number;
  agents: ConnectedAgent[];
  ledger: Array<{
    id: string;
    wallet_address: string;
    kind: string;
    agent_id: string | null;
    title: string;
    counterparty: string;
    amount: string;
    asset: string;
    status: string;
    note: string;
    created_at: string;
  }>;
};

/**
 * Fetches A2A account snapshot from the API.
 * @param address - Wallet address
 */
export async function fetchA2AAccount(address: string): Promise<A2AAccountDto> {
  const data = await apiFetch<{ account?: A2AAccountDto }>(
    `/api/a2a/account?address=${encodeURIComponent(address)}`,
    { token: "demo" },
  );
  if (!data.account?.walletAddress) {
    throw new Error("A2A account missing from API response");
  }
  return data.account;
}

/**
 * Credits A2A balance in the database.
 * @param address - Wallet address
 * @param amount - ETH amount
 */
export async function fundA2AAccount(
  address: string,
  amount: number,
): Promise<A2AAccountDto> {
  const data = await apiFetch<{ account: A2AAccountDto }>("/api/a2a/fund", {
    method: "POST",
    token: "demo",
    body: { address, amount },
  });
  return data.account;
}

/**
 * Updates agent limits / enabled flag in the database.
 */
export async function updateA2AAgent(
  address: string,
  agentId: string,
  input: {
    enabled?: boolean;
    maxAmount?: number;
    maxSinglePayment?: number;
  },
): Promise<A2AAccountDto> {
  const data = await apiFetch<{ account: A2AAccountDto }>(
    `/api/a2a/agents/${encodeURIComponent(agentId)}`,
    {
      method: "PATCH",
      token: "demo",
      body: { address, ...input },
    },
  );
  return data.account;
}

/**
 * Settles an agent payment against A2A balance.
 * Policy blocks return HTTP 400 with a structured body — do not throw those away.
 */
export async function settleA2APayment(
  address: string,
  agentId: string,
  amount: number,
  title: string,
): Promise<{ ok: boolean; message: string; account: A2AAccountDto }> {
  const env = (await import("@/lib/env")).getWebEnv();
  const response = await fetch(`${env.apiUrl}/api/a2a/settle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer demo",
    },
    body: JSON.stringify({ address, agentId, amount, title }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    account?: A2AAccountDto;
    error?: string;
  };

  if (data.account) {
    return {
      ok: Boolean(data.ok),
      message: data.message ?? data.error ?? "结算完成",
      account: data.account,
    };
  }

  throw new Error(data.error ?? data.message ?? `Request failed (${response.status})`);
}

/**
 * Maps API A2A ledger rows into the shared UI ledger shape.
 * @param rows - Server a2a_ledger rows
 */
export function mapA2ALedger(rows: A2AAccountDto["ledger"]): LedgerRecord[] {
  return rows.map((row) => ({
    id: row.id,
    direction: "out" as const,
    kind: "a2a" as const,
    title: row.title || "A2A 支付",
    counterparty: row.counterparty,
    agentId: row.agent_id,
    amount: row.amount,
    asset: row.asset === "USDC" ? "USDC" : "ETH",
    status:
      row.status === "blocked"
        ? "blocked"
        : row.status === "failed"
          ? "failed"
          : row.status === "pending"
            ? "pending"
            : "success",
    note: row.note,
    createdAt: row.created_at,
  }));
}
