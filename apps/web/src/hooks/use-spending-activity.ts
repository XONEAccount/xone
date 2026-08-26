import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AgentPayment, DeveloperAgent } from "@xone/types";
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { useWalletTransactions } from "@/hooks/use-wallet-transactions";
import {
  getDeveloperAgentDetail,
  listDeveloperAgents,
} from "@/lib/developer-api";
import type { SpendingEvent, WalletOption } from "@/lib/spending-activity";
import { useA2AStore, type LedgerRecord } from "@/stores/a2a";

const MAIN_WALLET_ID = "main";

/**
 * Loads spending activity across the main wallet, A2A ledger, and agent wallets.
 */
export function useSpendingActivity() {
  const { address } = useWalletAccount();
  const owner = address?.toLowerCase() ?? "";
  const { rows, isLoading: ledgerLoading } = useWalletTransactions();
  const a2aLedger = useA2AStore((s) => s.ledger);

  const agentsQuery = useQuery({
    queryKey: ["developer-agents", owner],
    enabled: Boolean(owner),
    queryFn: () => listDeveloperAgents(owner),
  });

  const agents = agentsQuery.data ?? [];

  const paymentsQuery = useQuery({
    queryKey: ["developer-agent-payments", owner, agents.map((a) => a.id).join("|")],
    enabled: Boolean(owner) && agents.length > 0,
    queryFn: async () => {
      const settled = await Promise.all(
        agents.map(async (agent) => {
          try {
            const detail = await getDeveloperAgentDetail(agent.id, owner);
            return { agent: detail.agent, payments: detail.payments };
          } catch (error) {
            console.warn("[spending] agent payments unavailable", agent.id, error);
            return { agent, payments: [] as AgentPayment[] };
          }
        }),
      );
      return settled;
    },
  });

  const events = useMemo(() => {
    const next: SpendingEvent[] = [];

    for (const row of rows) {
      const mapped = mapLedgerRow(row, MAIN_WALLET_ID, "主钱包");
      if (mapped) next.push(mapped);
    }

    for (const row of a2aLedger ?? []) {
      if (row.kind !== "a2a") continue;
      const mapped = mapLedgerRow(row, MAIN_WALLET_ID, "主钱包");
      if (mapped) next.push(mapped);
    }

    for (const bundle of paymentsQuery.data ?? []) {
      for (const pay of bundle.payments) {
        const mapped = mapAgentPayment(pay, bundle.agent);
        if (mapped) next.push(mapped);
      }
    }

    return dedupeEvents(next);
  }, [rows, a2aLedger, paymentsQuery.data]);

  const wallets = useMemo((): WalletOption[] => {
    const options: WalletOption[] = [{ id: MAIN_WALLET_ID, label: "主钱包" }];
    for (const agent of agents) {
      options.push({ id: agent.id, label: agent.name });
    }
    return options;
  }, [agents]);

  return {
    events,
    wallets,
    isLoading:
      ledgerLoading ||
      agentsQuery.isLoading ||
      (agents.length > 0 && paymentsQuery.isLoading),
  };
}

/**
 * Maps a wallet / A2A ledger row into a chart event (USDC only).
 * @param row - Ledger row
 * @param walletId - Chart wallet id
 * @param walletLabel - Display label
 */
function mapLedgerRow(
  row: LedgerRecord,
  walletId: string,
  walletLabel: string,
): SpendingEvent | null {
  if (row.asset !== "USDC") return null;
  const amount = Number(row.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (row.status === "failed" || row.status === "blocked") return null;

  const service =
    row.kind === "a2a"
      ? row.title || row.counterparty || "A2A"
      : row.kind === "receive"
        ? "收款"
        : row.title || row.counterparty || "转账";

  return {
    id: `ledger:${row.id}`,
    createdAt: row.createdAt,
    amount,
    direction: row.direction,
    walletId,
    walletLabel,
    service,
  };
}

/**
 * Maps a developer-agent machine payment into a chart event.
 * @param pay - Agent payment row
 * @param agent - Owning agent
 */
function mapAgentPayment(
  pay: AgentPayment,
  agent: DeveloperAgent,
): SpendingEvent | null {
  if ((pay.asset || "USDC").toUpperCase() !== "USDC") return null;
  if (pay.status === "failed" || pay.status === "rejected" || pay.status === "cancelled") {
    return null;
  }
  const amount = Number(pay.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    id: `agent-pay:${pay.id}`,
    createdAt: pay.createdAt,
    amount,
    direction: "out",
    walletId: agent.id,
    walletLabel: agent.name,
    service: pay.merchant || pay.resource || shortAddress(pay.recipient) || "机器支付",
  };
}

/**
 * Deduplicates events that share the same id.
 * @param events - Raw event list
 */
function dedupeEvents(events: SpendingEvent[]): SpendingEvent[] {
  const seen = new Set<string>();
  const out: SpendingEvent[] = [];
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    out.push(event);
  }
  return out;
}

/**
 * Shortens a hex address for service labels.
 * @param address - Full address
 */
function shortAddress(address: string): string {
  if (!address || address.length < 12) return address || "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
