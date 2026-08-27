import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { ListPager } from "@/components/layout/list-pager";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableEmpty,
  TableLoading,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useServerPagination } from "@/hooks/use-server-pagination";
import type { ListResponse } from "@/lib/api";
import { errorMessage, shorten } from "@/lib/utils";

type HistoryRow = {
  id: string;
  agent_id: string;
  user_id: string;
  type: string;
  amount: number | null;
  currency: string | null;
  url: string | null;
  tx_hash: string | null;
  created_at: string;
};

/**
 * Cross-tenant XOne agent history.
 */
export function XoneLedgerPage() {
  const { authFetch } = useAuth();
  const pager = useServerPagination(10);
  const [draftAgentId, setDraftAgentId] = useState("");
  const [appliedAgentId, setAppliedAgentId] = useState("");
  const [items, setItems] = useState<HistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(true);

  /**
   * Commits draft filter and resets to page 1.
   */
  function commitSearch(): void {
    pager.resetPage();
    setAppliedAgentId(draftAgentId);
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
        if (appliedAgentId.trim()) params.set("agent_id", appliedAgentId.trim());
        const res = await authFetch<ListResponse<HistoryRow>>(`/api/xone/history?${params}`);
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
  }, [authFetch, pager.limit, pager.offset, appliedAgentId]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in">
      <PageHeader
        icon={ScrollText}
        title="XOne ledger"
        description="Spend and lifecycle events across all console agents."
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
      </SearchBar>
      {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}
      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searching ? (
                <TableLoading colSpan={5} />
              ) : (
                <>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell className="font-mono text-xs">{shorten(row.agent_id)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.amount != null ? `${row.amount} ${row.currency ?? ""}` : "—"}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate font-mono text-xs">
                        {row.tx_hash || row.url || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 ? <TableEmpty colSpan={5} message="No events" /> : null}
                </>
              )}
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
