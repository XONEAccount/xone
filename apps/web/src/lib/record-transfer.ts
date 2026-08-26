import { DEFAULT_CHAIN } from "@xone/config";
import { apiFetch } from "@/lib/api";

export type RecordTransferBody = {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  asset: "ETH" | "USDC";
  status?: "pending" | "submitted" | "confirmed" | "failed";
};

/**
 * Persists a successful on-chain transfer on the backend (sender out + recipient in).
 * @param body - Transfer details after tx is submitted
 */
export async function recordTransferOnServer(body: RecordTransferBody): Promise<void> {
  await apiFetch("/api/transactions", {
    method: "POST",
    token: "demo",
    idempotencyKey: body.txHash,
    body: {
      ...body,
      chain: DEFAULT_CHAIN.slug,
      chainId: DEFAULT_CHAIN.id,
      status: body.status ?? "submitted",
    },
  });
}

export type ServerTransferRow = {
  id: string;
  wallet_address: string;
  chain: string;
  chain_id: number;
  tx_hash: string;
  from_address: string;
  to_address: string;
  asset: string;
  amount: string;
  status: string;
  direction: "in" | "out";
  created_at: string;
  confirmed_at: string | null;
};

/**
 * Loads backend-recorded transfers for a wallet.
 * @param address - Wallet address
 */
export async function fetchServerTransfers(address: string): Promise<ServerTransferRow[]> {
  const data = await apiFetch<{ transactions: ServerTransferRow[] }>(
    `/api/transactions?address=${encodeURIComponent(address)}`,
    { token: "demo" },
  );
  return data.transactions ?? [];
}
