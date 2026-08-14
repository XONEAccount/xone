import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Search } from "lucide-react";
import type { AgentHistoryEntry, AgentHistoryType } from "@xone/sdk";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
import { formatDateTime } from "@/utils/format";

const FUND_TYPES: AgentHistoryType[] = ["x402", "transfer"];

/**
 * Cross-agent activity feed.
 */
export function HistoryPage() {
  const { agents } = useAccount();
  const [agentFilter, setAgentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<AgentHistoryType | "all">("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<
    Array<AgentHistoryEntry & { agentId: string; agentName: string }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const all: Array<AgentHistoryEntry & { agentId: string; agentName: string }> =
        [];
      for (const agent of agents) {
        const items = await agent.getHistory({ limit: 100 });
        for (const e of items) {
          if (!FUND_TYPES.includes(e.type) && e.type !== "limits_update" && e.type !== "pause" && e.type !== "resume" && e.type !== "delete") {
            continue;
          }
          all.push({ ...e, agentId: agent.id, agentName: agent.name });
        }
      }
      all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      if (!cancelled) setRows(all);
    })();
    return () => {
      cancelled = true;
    };
  }, [agents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (agentFilter !== "all" && r.agentId !== agentFilter) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (!q) return true;
      return (
        r.agentName.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        (r.url ?? "").toLowerCase().includes(q) ||
        (r.txHash ?? "").toLowerCase().includes(q) ||
        (r.to ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, agentFilter, typeFilter, search]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in">
      <PageHeader
        icon={Activity}
        title="Activity"
        description="x402 activity across your agents. Fund wallets on-chain; there is no console deposit ledger."
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
              className="flex h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
            >
              <option value="all">All agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              className="flex h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as AgentHistoryType | "all")
              }
            >
              <option value="all">All types</option>
              <option value="x402">x402</option>
              <option value="limits_update">limits_update</option>
              <option value="pause">pause</option>
              <option value="resume">resume</option>
              <option value="delete">delete</option>
            </select>
          </>
        }
      />

      {agents.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="font-medium">No agents yet</p>
            <p className="text-sm text-muted-foreground">
              Create an API key and an agent in the console. x402 activity will
              show up here.
            </p>
            <Button type="button" asChild>
              <Link to="/api-keys">Go to API Keys</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={`${row.agentId}-${row.id}`}>
                    <TableCell>
                      <Link
                        to={`/agents/${row.agentId}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {row.agentName}
                      </Link>
                    </TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.amount != null
                        ? `${row.amount} ${row.currency ?? ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate font-mono text-xs">
                      {row.to || row.url || row.txHash || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      No matching activity.
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
