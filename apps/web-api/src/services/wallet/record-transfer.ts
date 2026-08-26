import type { RecordTransferInput } from "@xone/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";

export type WalletTransactionRow = {
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
 * Ensures a profile row exists for a wallet address (needed for FK inserts).
 * @param admin - Supabase service-role client
 * @param address - Lowercased EVM address
 */
async function ensureProfile(
  admin: SupabaseClient,
  address: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin.from("profiles").upsert(
    {
      wallet_address: address,
      display_name: `${address.slice(0, 6)}…${address.slice(-4)}`,
      updated_at: now,
    },
    { onConflict: "wallet_address" },
  );
  if (error) {
    throw new Error(`Failed to ensure profile: ${error.message}`);
  }
}

/**
 * Inserts or updates one ledger leg (out or in) for a wallet.
 * Idempotent on (chain_id, tx_hash, wallet_address, direction).
 * @param admin - Supabase admin client
 * @param input - Transfer payload
 * @param walletAddress - Wallet that owns this ledger row
 * @param direction - in | out
 */
async function upsertLeg(
  admin: SupabaseClient,
  input: RecordTransferInput,
  walletAddress: string,
  direction: "in" | "out",
): Promise<WalletTransactionRow> {
  const txHash = input.txHash.toLowerCase();
  const from = input.from.toLowerCase();
  const to = input.to.toLowerCase();
  const confirmedAt = input.status === "confirmed" ? new Date().toISOString() : null;

  const { data: existing, error: findError } = await admin
    .from("wallet_transactions")
    .select(
      "id, wallet_address, chain, chain_id, tx_hash, from_address, to_address, asset, amount, status, direction, created_at, confirmed_at",
    )
    .eq("chain_id", input.chainId)
    .eq("tx_hash", txHash)
    .eq("wallet_address", walletAddress)
    .eq("direction", direction)
    .maybeSingle();

  if (findError) {
    throw new Error(`Failed to lookup ${direction} transfer: ${findError.message}`);
  }

  if (existing) {
    const { data, error } = await admin
      .from("wallet_transactions")
      .update({
        status: input.status,
        amount: input.amount,
        asset: input.asset,
        confirmed_at: confirmedAt ?? existing.confirmed_at,
      })
      .eq("id", existing.id)
      .select(
        "id, wallet_address, chain, chain_id, tx_hash, from_address, to_address, asset, amount, status, direction, created_at, confirmed_at",
      )
      .maybeSingle();

    if (error || !data) {
      throw new Error(
        `Failed to update ${direction} transfer: ${error?.message ?? "empty"}`,
      );
    }
    return data as WalletTransactionRow;
  }

  const { data, error } = await admin
    .from("wallet_transactions")
    .insert({
      wallet_address: walletAddress,
      chain: input.chain,
      chain_id: input.chainId,
      tx_hash: txHash,
      from_address: from,
      to_address: to,
      asset: input.asset,
      amount: input.amount,
      status: input.status,
      direction,
      confirmed_at: confirmedAt,
      metadata: {},
    })
    .select(
      "id, wallet_address, chain, chain_id, tx_hash, from_address, to_address, asset, amount, status, direction, created_at, confirmed_at",
    )
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `Failed to insert ${direction} transfer: ${error?.message ?? "empty"}`,
    );
  }
  return data as WalletTransactionRow;
}

/**
 * Records a successful (or submitted) on-chain transfer for both parties.
 * Always writes sender `out` and recipient `in` (creates profile stubs if needed).
 * @param admin - Supabase service-role client
 * @param input - Validated transfer payload
 * @returns Recorded legs
 */
export async function recordTransferLegs(
  admin: SupabaseClient,
  input: RecordTransferInput,
): Promise<{ out: WalletTransactionRow; in: WalletTransactionRow }> {
  const from = input.from.toLowerCase();
  const to = input.to.toLowerCase();
  const normalized = { ...input, from, to, txHash: input.txHash.toLowerCase() };

  await ensureProfile(admin, from);
  await ensureProfile(admin, to);

  const out = await upsertLeg(admin, normalized, from, "out");
  const incoming = await upsertLeg(admin, normalized, to, "in");

  return { out, in: incoming };
}

/**
 * Lists recorded transfers for a wallet address.
 * @param admin - Supabase admin client
 * @param walletAddress - Wallet address
 * @param limit - Max rows
 */
export async function listWalletTransfers(
  admin: SupabaseClient,
  walletAddress: string,
  limit = 50,
): Promise<WalletTransactionRow[]> {
  const { data, error } = await admin
    .from("wallet_transactions")
    .select(
      "id, wallet_address, chain, chain_id, tx_hash, from_address, to_address, asset, amount, status, direction, created_at, confirmed_at",
    )
    .eq("wallet_address", walletAddress.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list transfers: ${error.message}`);
  }
  return (data ?? []) as WalletTransactionRow[];
}
