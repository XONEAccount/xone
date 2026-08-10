import { Insight, toEther } from "thirdweb";
import type { LedgerRecord } from "@/stores/a2a";
import { thirdwebClient } from "@/web3/client";
import { appChain } from "@/web3/chains";

type RawTx = {
  hash: string;
  from: string;
  to: string;
  value: string;
  status: "success" | "failed";
  timestampMs: number;
};

/**
 * Fetches recent ETH transfers for a wallet.
 * Prefers thirdweb Insight; falls back to Etherscan on Sepolia when Insight is empty
 * (common on testnets where indexing lags or returns no rows).
 * @param walletAddress - Connected wallet address
 * @returns Ledger rows for UI tables
 */
export async function fetchWalletLedger(walletAddress: string): Promise<LedgerRecord[]> {
  const address = walletAddress.toLowerCase();

  const insightRows = await fetchFromInsight(walletAddress);
  if (insightRows.length > 0) {
    return insightRows.map((tx) => mapRawTx(tx, address)).filter((row): row is LedgerRecord => row != null);
  }

  const explorerRows = await fetchFromEtherscan(walletAddress);
  return explorerRows
    .map((tx) => mapRawTx(tx, address))
    .filter((row): row is LedgerRecord => row != null);
}

/**
 * Loads txs via thirdweb Insight. Returns [] when unavailable or unindexed.
 * @param walletAddress - Wallet address
 */
async function fetchFromInsight(walletAddress: string): Promise<RawTx[]> {
  try {
    const txs = await Insight.getTransactions({
      client: thirdwebClient,
      walletAddress,
      chains: [appChain],
      queryOptions: {
        limit: 50,
        sort_order: "desc",
        decode: true,
      },
    });

    return (txs ?? []).map((tx) => {
      const row = tx as {
        hash: string;
        from_address?: string;
        to_address?: string;
        value?: string | number | null;
        status?: number | null;
        block_timestamp?: number | null;
      };
      return {
        hash: row.hash,
        from: (row.from_address ?? "").toLowerCase(),
        to: (row.to_address ?? "").toLowerCase(),
        value: String(row.value ?? "0"),
        status: row.status === 0 ? "failed" : "success",
        timestampMs: (row.block_timestamp ?? 0) * 1000,
      } satisfies RawTx;
    });
  } catch (error) {
    console.warn("[web3] Insight history unavailable", error);
    return [];
  }
}

type EtherscanTx = {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  txreceipt_status?: string;
  isError?: string;
};

/**
 * Loads native txs from Etherscan Sepolia account API.
 * @param walletAddress - Wallet address
 */
async function fetchFromEtherscan(walletAddress: string): Promise<RawTx[]> {
  const apiKey = import.meta.env.VITE_ETHERSCAN_API_KEY as string | undefined;
  const params = new URLSearchParams({
    module: "account",
    action: "txlist",
    address: walletAddress,
    startblock: "0",
    endblock: "99999999",
    page: "1",
    offset: "50",
    sort: "desc",
  });
  if (apiKey) params.set("apikey", apiKey);

  // Unified V2 endpoint (chainid) + legacy Sepolia host as fallback.
  const urls = [
    `https://api.etherscan.io/v2/api?chainid=${appChain.id}&${params.toString()}`,
    `https://api-sepolia.etherscan.io/api?${params.toString()}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const body = (await response.json()) as {
        status?: string;
        message?: string;
        result?: EtherscanTx[] | string;
      };
      if (!Array.isArray(body.result)) continue;

      return body.result.map((tx) => ({
        hash: tx.hash,
        from: (tx.from ?? "").toLowerCase(),
        to: (tx.to ?? "").toLowerCase(),
        value: tx.value ?? "0",
        status: tx.isError === "1" || tx.txreceipt_status === "0" ? "failed" : "success",
        timestampMs: Number(tx.timeStamp || 0) * 1000,
      }));
    } catch (error) {
      console.warn("[web3] Etherscan history unavailable", error);
    }
  }

  return [];
}

/**
 * Maps a raw transfer into a ledger row with correct in/out direction.
 * @param tx - Normalized transfer
 * @param address - Current wallet (lowercase)
 */
function mapRawTx(tx: RawTx, address: string): LedgerRecord | null {
  const from = tx.from;
  const to = tx.to;
  const isSender = from === address;
  const isReceiver = to === address;

  let direction: "in" | "out" | null = null;
  if (isReceiver && !isSender) direction = "in";
  else if (isSender && !isReceiver) direction = "out";
  else if (isReceiver && isSender) direction = "out";
  else return null;

  let valueWei = 0n;
  try {
    valueWei = BigInt(tx.value || "0");
  } catch {
    return null;
  }
  if (valueWei === 0n) return null;

  const amount = Number(toEther(valueWei));
  const outgoing = direction === "out";

  return {
    id: tx.hash,
    direction,
    kind: outgoing ? "transfer" : "receive",
    title: outgoing ? "转账" : "收款",
    counterparty: outgoing ? short(to) : short(from),
    fromAddress: from || undefined,
    toAddress: to || undefined,
    agentId: null,
    amount: formatEth(amount),
    asset: "ETH",
    status: tx.status,
    note: tx.hash,
    createdAt: new Date(tx.timestampMs || Date.now()).toISOString(),
  };
}

/**
 * @param address - Hex address
 */
function short(address: string): string {
  if (!address || address.length < 12) return address || "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * @param value - ETH amount
 */
function formatEth(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  return value.toLocaleString("en-US", {
    useGrouping: false,
    maximumFractionDigits: 6,
  });
}
