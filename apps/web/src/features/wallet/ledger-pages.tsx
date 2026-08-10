import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, Bot } from "lucide-react";
import { LedgerTablePage } from "@/features/wallet/ledger-table-page";
import { useWalletTransactions } from "@/hooks/use-wallet-transactions";
import { useA2AStore } from "@/stores/a2a";

/**
 * 收款明细：链上收入 + 本地记录。
 */
export function ReceiveLedgerPage() {
  const { rows, isLoading } = useWalletTransactions();
  const filtered = useMemo(
    () => rows.filter((item) => item.direction === "in"),
    [rows],
  );

  return (
    <LedgerTablePage
      icon={ArrowDownLeft}
      title="收款明细"
      emptyText={isLoading ? "加载中…" : "暂无收款记录"}
      rows={filtered}
      showTitleColumn={false}
    />
  );
}

/**
 * 转账明细：链上转出 + 本地刚提交的转账。
 */
export function PaymentLedgerPage() {
  const { rows, isLoading } = useWalletTransactions();
  const filtered = useMemo(
    () => rows.filter((item) => item.direction === "out" && item.kind !== "a2a"),
    [rows],
  );

  return (
    <LedgerTablePage
      icon={ArrowUpRight}
      title="转账明细"
      emptyText={isLoading ? "加载中…" : "暂无转账记录"}
      rows={filtered}
      showTitleColumn={false}
    />
  );
}

/**
 * A2A 明细：Agent 动态报价结算记录。
 */
export function A2ALedgerPage() {
  const ledger = useA2AStore((s) => s.ledger);
  const rows = useMemo(
    () => (ledger ?? []).filter((item) => item.kind === "a2a"),
    [ledger],
  );

  return (
    <LedgerTablePage
      icon={Bot}
      title="A2A 明细"
      emptyText="暂无 A2A 支付记录"
      rows={rows}
    />
  );
}
