import { useQuery } from "@tanstack/react-query";
import { useActiveAccount } from "thirdweb/react";
import { fetchServerTransfers, type ServerTransferRow } from "@/lib/record-transfer";
import { useA2AStore, type LedgerRecord } from "@/stores/a2a";
import { fetchWalletLedger } from "@/web3/history";

/**
 * Loads wallet history from backend ledger + chain indexers + local pending rows.
 * Backend `in` rows make 收款明细 work without Insight indexing.
 */
export function useWalletTransactions() {
  const account = useActiveAccount();
  const address = account?.address?.toLowerCase();
  const localLedger = useA2AStore((s) => s.pendingTransfers);

  const query = useQuery({
    queryKey: ["wallet-txs", address],
    enabled: Boolean(address),
    queryFn: async () => {
      const [serverRows, chainRows] = await Promise.all([
        fetchServerTransfers(address!).catch((error) => {
          console.warn("[ledger] server transfers unavailable", error);
          return [] as ServerTransferRow[];
        }),
        fetchWalletLedger(address!),
      ]);

      return {
        server: serverRows.map(mapServerRow),
        chain: chainRows,
      };
    },
    refetchInterval: 20_000,
  });

  const serverRows = query.data?.server ?? [];
  const chainRows = query.data?.chain ?? [];
  const knownHashes = new Set<string>();

  for (const row of serverRows) {
    if (row.note.startsWith("0x")) knownHashes.add(row.note.toLowerCase());
    knownHashes.add(row.id.toLowerCase());
  }
  for (const row of chainRows) {
    if (row.note.startsWith("0x")) knownHashes.add(row.note.toLowerCase());
    knownHashes.add(row.id.toLowerCase());
  }

  // Prefer server rows; fill gaps from chain indexers.
  const chainOnly = chainRows.filter((row) => {
    const hash = row.note.startsWith("0x") ? row.note.toLowerCase() : row.id.toLowerCase();
    return !serverRows.some(
      (s) =>
        s.note.toLowerCase() === hash &&
        s.direction === row.direction,
    );
  });

  const pendingLocal = (localLedger ?? [])
    .flatMap((row) => localizeForWallet(row, address))
    .filter((row) => {
      const hashLike = row.note?.startsWith("0x") ? row.note.toLowerCase() : "";
      if (hashLike && knownHashes.has(hashLike)) return false;
      if (knownHashes.has(row.id.toLowerCase())) return false;
      return true;
    });

  const rows = [...pendingLocal, ...serverRows, ...chainOnly].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return {
    rows,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Maps a backend wallet_transactions row into the UI ledger shape.
 * @param row - Server transfer row
 */
function mapServerRow(row: ServerTransferRow): LedgerRecord {
  const outgoing = row.direction === "out";
  const counterparty = outgoing ? row.to_address : row.from_address;
  return {
    id: row.id,
    direction: row.direction,
    kind: outgoing ? "transfer" : "receive",
    title: outgoing ? "转账" : "收款",
    counterparty: short(counterparty),
    fromAddress: row.from_address,
    toAddress: row.to_address,
    agentId: null,
    amount: row.amount,
    asset: row.asset === "USDC" ? "USDC" : "ETH",
    status:
      row.status === "failed"
        ? "failed"
        : row.status === "pending"
          ? "pending"
          : "success",
    note: row.tx_hash,
    createdAt: row.created_at,
  };
}

/**
 * Keeps only rows that belong to the active wallet.
 * Outgoing local sends whose recipient is the active wallet are flipped to 收款.
 * @param row - Persisted ledger row
 * @param address - Active wallet (lowercase)
 */
function localizeForWallet(row: LedgerRecord, address: string | undefined): LedgerRecord[] {
  if (!address) return [];
  if (row.kind !== "transfer" && row.kind !== "receive") return [];

  const from = (row.fromAddress ?? "").toLowerCase();
  const to = (row.toAddress ?? "").toLowerCase();

  if (!from && !to) return [];

  if (from === address && to !== address) {
    return [row.direction === "out" ? row : { ...row, direction: "out", kind: "transfer", title: "转账" }];
  }

  if (to === address && from !== address) {
    return [
      {
        ...row,
        id: `in-${row.id}`,
        direction: "in",
        kind: "receive",
        title: "收款",
        counterparty: short(from) || row.counterparty,
      },
    ];
  }

  if (from === address && to === address) {
    return [{ ...row, direction: "out", kind: "transfer", title: "转账" }];
  }

  return [];
}

/**
 * @param address - Hex address
 */
function short(address: string): string {
  if (!address || address.length < 12) return address || "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
