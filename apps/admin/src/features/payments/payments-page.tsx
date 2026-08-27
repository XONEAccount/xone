import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { ListPager } from "@/components/layout/list-pager";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableEmpty,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useServerPagination } from "@/hooks/use-server-pagination";
import type { ListResponse } from "@/lib/api";
import { errorMessage, shorten } from "@/lib/utils";

type Payment = {
  id: string;
  agent_id: string;
  amount: number;
  asset: string;
  status: string;
  merchant: string | null;
  failure_reason: string | null;
  created_at: string;
};

type AppliedFilters = {
  agentId: string;
  status: string;
};

/**
 * Web agent_payments ledger.
 */
export function PaymentsPage() {
  const { authFetch } = useAuth();
  const pager = useServerPagination(10);
  const [draftAgentId, setDraftAgentId] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [applied, setApplied] = useState<AppliedFilters>({ agentId: "", status: "" });
  const [items, setItems] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  /**
   * Commits draft filters and resets to page 1.
   */
  function commitSearch(): void {
    pager.resetPage();
    setApplied({ agentId: draftAgentId, status: draftStatus });
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          limit: String(pager.limit),
          offset: String(pager.offset),
        });
        if (applied.agentId.trim()) params.set("agent_id", applied.agentId.trim());
        if (applied.status) params.set("status", applied.status);
        const res = await authFetch<ListResponse<Payment>>(`/api/payments?${params}`);
        if (cancelled) return;
        setItems(res.items);
        pager.setTotal(res.total);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, pager.limit, pager.offset, applied]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in">
      <PageHeader
        icon={Receipt}
        title="Payments"
        description="Consumer wallet / developer agent payment rows."
      />
      <SearchBar searching={searching} onSearch={commitSearch}>
        <Input
          className="max-w-xs"
          placeholder="Filter agent_id"
          value={draftAgentId}
          onChange={(e) => setDraftAgentId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitSearch();
          }}
        />
        <Input
          className="max-w-xs"
          placeholder="Filter status"
          value={draftStatus}
          onChange={(e) => setDraftStatus(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitSearch();
          }}
        />
      </SearchBar>
      {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}
      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Merchant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{shorten(row.agent_id)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.amount} {row.asset}
                  </TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs">
                    {row.merchant || row.failure_reason || "—"}
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 ? (
                <TableEmpty
                  colSpan={5}
                  message="No payments"
                />
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ListPager
          page={pager.page}
          pageCount={pager.pageCount}
          total={pager.total}
          limit={pager.limit}
          pageSizes={pager.pageSizes}
          canPrev={pager.canPrev}
          canNext={pager.canNext}
          onPrev={pager.prev}
          onNext={pager.next}
          onLimitChange={pager.setLimit}
        />
    </div>
  );
}
