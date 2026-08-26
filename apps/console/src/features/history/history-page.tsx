import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Receipt, Search } from "lucide-react";
import type { AgentHistoryEntry, AgentHistoryType } from "@xone/sdk";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccount } from "@/hooks/use-account";
import { api } from "@/lib/api";
import type { HistoryDto } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/format";

/** On-chain / payment cash-flow event types for generated wallets. */
const LEDGER_TYPES: AgentHistoryType[] = [
  "deposit",
  "withdraw",
  "x402",
  "transfer",
];

type FlowDirection = "income" | "spend";

type LedgerRow = AgentHistoryEntry & {
  agentId: string;
  walletName: string;
  flow: FlowDirection;
};

/**
 * Maps a history type to income vs spend for the wallet ledger.
 * @param type - Agent history event type
 * @returns Flow direction
 */
function flowForType(type: AgentHistoryType): FlowDirection {
  return type === "deposit" ? "income" : "spend";
}

/**
 * Human label for ledger event types.
 * @param type - History type
 * @returns Display label
 */
function typeLabel(type: AgentHistoryType): string {
  switch (type) {
    case "deposit":
      return "Deposit";
    case "withdraw":
      return "Withdraw";
    case "x402":
      return "x402 spend";
    case "transfer":
      return "Transfer";
    default:
      return type;
  }
}

/**
 * Wallet spend / income ledger across generated agent wallets.
 */
export function HistoryPage() {
  const { agents, remote } = useAccount();
  const [walletFilter, setWalletFilter] = useState("all");
  const [flowFilter, setFlowFilter] = useState<FlowDirection | "all">("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);

  const walletNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const agent of agents) map.set(agent.id, agent.name);
    return map;
  }, [agents]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        let items: Array<AgentHistoryEntry & { agentId?: string }> = [];

        if (remote) {
          const remoteItems: HistoryDto[] = await api.accountHistory(200);
          items = remoteItems;
        } else {
          const all: Array<AgentHistoryEntry & { agentId: string }> = [];
          for (const agent of agents) {
            const history = await agent.getHistory({ limit: 100 });
            for (const e of history) {
              all.push({ ...e, agentId: agent.id });
            }
          }
          items = all;
        }

        const ledger: LedgerRow[] = [];
        for (const e of items) {
          if (!LEDGER_TYPES.includes(e.type)) continue;
          const agentId = e.agentId ?? "";
          if (!agentId) continue;
          ledger.push({
            ...e,
            agentId,
            walletName: walletNameById.get(agentId) ?? agentId.slice(0, 8),
            flow: flowForType(e.type),
          });
        }
        ledger.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        if (!cancelled) setRows(ledger);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agents, remote, walletNameById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (walletFilter !== "all" && r.agentId !== walletFilter) return false;
      if (flowFilter !== "all" && r.flow !== flowFilter) return false;
      if (!q) return true;
      return (
        r.walletName.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        (r.url ?? "").toLowerCase().includes(q) ||
        (r.txHash ?? "").toLowerCase().includes(q) ||
        (r.to ?? "").toLowerCase().includes(q) ||
        String(r.amount ?? "").includes(q)
      );
    });
  }, [rows, walletFilter, flowFilter, search]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in">
      <PageHeader
        icon={Receipt}
        title="Ledger"
        description="Spend and income for wallets you generated. Deposits count as income; x402 payments, transfers, and withdrawals count as spend."
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-44 pl-9"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="flex h-10 rounded-md border border-border bg-white py-2 pl-3 pr-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--color-ring)"
              value={walletFilter}
              onChange={(e) => setWalletFilter(e.target.value)}
            >
              <option value="all">All wallets</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              className="flex h-10 rounded-md border border-border bg-white py-2 pl-3 pr-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--color-ring)"
              value={flowFilter}
              onChange={(e) =>
                setFlowFilter(e.target.value as FlowDirection | "all")
              }
            >
              <option value="all">All flows</option>
              <option value="income">Income</option>
              <option value="spend">Spend</option>
            </select>
          </>
        }
      />

      {agents.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="font-medium">No wallets yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Flow</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const isIncome = row.flow === "income";
                  return (
                    <TableRow key={`${row.agentId}-${row.id}`}>
                      <TableCell>
                        <Link
                          to={`/wallet/${row.agentId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {row.walletName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs font-medium",
                            isIncome
                              ? "text-emerald-700"
                              : "text-muted-foreground",
                          )}
                        >
                          {isIncome ? (
                            <ArrowDownLeft
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                              aria-hidden
                            />
                          ) : (
                            <ArrowUpRight
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                              aria-hidden
                            />
                          )}
                          {isIncome ? "Income" : "Spend"}
                        </span>
                      </TableCell>
                      <TableCell>{typeLabel(row.type)}</TableCell>
                      <TableCell
                        className={cn(
                          "font-mono text-xs",
                          isIncome ? "text-emerald-700" : undefined,
                        )}
                      >
                        {row.amount != null
                          ? `${isIncome ? "+" : "−"}${row.amount} ${row.currency ?? ""}`
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate font-mono text-xs">
                        {row.to || row.url || row.txHash || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(row.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      {loading
                        ? "Loading ledger…"
                        : "No spend or income records yet."}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
