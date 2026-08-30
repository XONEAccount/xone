import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, Eye, RefreshCw, Wallet } from "lucide-react";
import type { Agent, AgentStatus } from "@xonepay/sdk";
import { ListPager } from "@/components/layout/list-pager";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
} from "@/components/ui/table";
import { useAccount } from "@/hooks/use-account";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { cn } from "@/lib/utils";
import { errorMessage, shortAddress } from "@/utils/format";

type StatusFilter = AgentStatus | "all";

type WalletSpendMeta = {
  remainingDaily: number;
  dailyLimit: number;
  perTransaction: number;
  currency: string;
};

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "exhausted", label: "Exhausted" },
  { value: "deleted", label: "Deleted" },
];

const SEARCH_SPIN_MS = 280;

/**
 * Wallet list — funds & policy headroom (pause/delete live on API Keys).
 */
export function AgentsPage() {
  const { agents, getApiKey, refresh, loading } = useAccount();

  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spendById, setSpendById] = useState<Record<string, WalletSpendMeta>>({});
  const [spendLoading, setSpendLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      if (statusFilter !== "all" && a.getStatus() !== statusFilter) return false;
      if (!q) return true;
      const key = getApiKey(a.apiKeyId)?.name ?? "";
      return (
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.chain.toLowerCase().includes(q) ||
        key.toLowerCase().includes(q) ||
        a.getAddress().toLowerCase().includes(q)
      );
    });
  }, [agents, query, statusFilter, getApiKey]);

  const pager = useClientPagination(filtered);

  const summary = useMemo(() => {
    let active = 0;
    let paused = 0;
    let remaining = 0;
    for (const a of agents) {
      const status = a.getStatus();
      if (status === "active") active += 1;
      if (status === "paused") paused += 1;
      if (status === "deleted") continue;
      remaining += spendById[a.id]?.remainingDaily ?? 0;
    }
    return { active, paused, remaining, total: agents.length };
  }, [agents, spendById]);

  useEffect(() => {
    pager.setPage(1);
  }, [query, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    if (agents.length === 0) {
      setSpendById({});
      return;
    }

    void (async () => {
      setSpendLoading(true);
      try {
        const entries = await Promise.all(
          agents.map(async (agent) => {
            const lim = await Promise.resolve(agent.getLimits());
            return [
              agent.id,
              {
                remainingDaily: lim.remainingDaily,
                dailyLimit: lim.dailyLimit,
                perTransaction: lim.perTransaction,
                currency: lim.currency,
              } satisfies WalletSpendMeta,
            ] as const;
          }),
        );
        if (!cancelled) setSpendById(Object.fromEntries(entries));
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setSpendLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agents]);

  /**
   * Commits the draft search string with a brief table spinner.
   */
  function commitSearch(): void {
    if (searching) return;
    setSearching(true);
    window.setTimeout(() => {
      setQuery(draft);
      setSearching(false);
    }, SEARCH_SPIN_MS);
  }

  /**
   * Copies a wallet address to the clipboard.
   * @param agentId - Row id for brief copied feedback
   * @param address - Full address
   */
  async function onCopyAddress(agentId: string, address: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedId(agentId);
      window.setTimeout(() => {
        setCopiedId((id) => (id === agentId ? null : id));
      }, 1600);
    } catch (err) {
      setError(errorMessage(err) || "Could not copy address.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in">
      <PageHeader
        icon={Wallet}
        title="Wallet"
        description="Spend headroom and funding addresses. Pause and delete stay on API Keys."
        actions={
          <SearchBar onSearch={commitSearch} searching={searching}>
            <Input
              className="w-48 sm:w-56"
              placeholder="Search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitSearch();
              }}
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void refresh()}
              disabled={loading}
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </SearchBar>
        }
      />

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {copiedId ? (
        <div
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-foreground px-3 py-1.5 text-xs text-background shadow-sm"
          role="status"
        >
          Copied
        </div>
      ) : null}

      {agents.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Wallets" value={String(summary.total)} />
          <SummaryCard label="Active" value={String(summary.active)} />
          <SummaryCard label="Paused" value={String(summary.paused)} />
          <SummaryCard
            label="Remaining today"
            value={spendLoading ? "…" : formatMoney(summary.remaining)}
            mono
          />
        </div>
      ) : null}

      {agents.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <Empty className="border-0 py-6 md:py-8">
              <EmptyHeader>
                <EmptyTitle>No wallets yet</EmptyTitle>
                <EmptyDescription>
                  Create an API key, then bind a wallet. Fund USDC at the address to spend.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Daily / Per</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searching ? (
                  <TableLoading colSpan={7} />
                ) : (
                  <>
                    {pager.pageItems.map((agent) => (
                      <WalletRow
                        key={agent.id}
                        agent={agent}
                        keyName={
                          getApiKey(agent.apiKeyId)?.name ??
                          agent.apiKeyId.slice(0, 10)
                        }
                        spend={spendById[agent.id]}
                        spendLoading={spendLoading}
                        copied={copiedId === agent.id}
                        onCopy={() =>
                          void onCopyAddress(agent.id, agent.getAddress())
                        }
                      />
                    ))}
                    {filtered.length === 0 ? (
                      <TableEmpty colSpan={7} title="No matching wallets." />
                    ) : null}
                  </>
                )}
              </TableBody>
            </Table>
            <p className="mt-4 text-xs text-muted-foreground">
              Remaining is policy headroom for today, not an on-chain USDC balance. Fund the
              address separately.
            </p>
          </CardContent>
        </Card>
      )}

      {agents.length > 0 ? (
        <ListPager
          page={pager.page}
          pageCount={pager.pageCount}
          total={pager.total}
          limit={pager.pageSize}
          pageSizes={pager.pageSizes}
          canPrev={pager.canPrev}
          canNext={pager.canNext}
          onPrev={pager.onPrev}
          onNext={pager.onNext}
          onLimitChange={(n) => pager.setPageSize(n as typeof pager.pageSize)}
        />
      ) : null}
    </div>
  );
}

/**
 * Formats a USDC-like amount for compact display.
 * @param value - Numeric amount
 */
function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Top summary metric card.
 */
function SummaryCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-lg font-semibold tracking-tight", mono && "font-mono")}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * One wallet table row.
 */
function WalletRow({
  agent,
  keyName,
  spend,
  spendLoading,
  copied,
  onCopy,
}: {
  agent: Agent;
  keyName: string;
  spend?: WalletSpendMeta;
  spendLoading: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const status = agent.getStatus();
  const address = agent.getAddress();
  return (
    <TableRow>
      <TableCell className="font-medium">{agent.name}</TableCell>
      <TableCell>
        <StatusPill status={status} />
      </TableCell>
      <TableCell className="text-muted-foreground">{keyName}</TableCell>
      <TableCell className="font-mono text-xs">
        {spendLoading && !spend
          ? "…"
          : spend
            ? `${formatMoney(spend.remainingDaily)} ${spend.currency}`
            : "—"}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {spendLoading && !spend
          ? "…"
          : spend
            ? `${formatMoney(spend.dailyLimit)} / ${formatMoney(spend.perTransaction)}`
            : "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs">{shortAddress(address)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Copy address"
            onClick={onCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
          </Button>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to={`/wallet/${agent.id}`}>
            <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            View
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

/**
 * Agent status badge with distinct tones.
 * @param status - Agent status
 */
function StatusPill({ status }: { status: AgentStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize border",
        status === "active" &&
          "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "paused" &&
          "border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        status === "deleted" &&
          "border-destructive/40 bg-destructive/10 text-destructive",
        status === "exhausted" &&
          "border-border bg-muted text-muted-foreground",
      )}
    >
      {status}
    </Badge>
  );
}
