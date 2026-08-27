import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { ListPager } from "@/components/layout/list-pager";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { Card, CardContent } from "@/components/ui/card";
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

export type LegacyAgent = {
  id: string;
  owner_wallet: string;
  name: string;
  description: string | null;
  api_key_prefix: string;
  wallet_address: string;
  max_amount: number;
  max_single_payment: number;
  spent_amount: number;
  status: string;
  created_at: string;
};

type AppliedFilters = {
  q: string;
  status: string;
};

/**
 * Web developer_agents list (legacy surface).
 */
export function LegacyAgentsPage() {
  const { authFetch } = useAuth();
  const pager = useServerPagination(10);
  const [draftQ, setDraftQ] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [applied, setApplied] = useState<AppliedFilters>({ q: "", status: "" });
  const [items, setItems] = useState<LegacyAgent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  /**
   * Commits draft filters and resets to page 1.
   */
  function commitSearch(): void {
    pager.resetPage();
    setApplied({ q: draftQ, status: draftStatus });
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
        if (applied.q.trim()) params.set("q", applied.q.trim());
        if (applied.status) params.set("status", applied.status);
        const res = await authFetch<ListResponse<LegacyAgent>>(`/api/agents?${params}`);
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
        icon={Shield}
        title="Legacy agents"
        description="Web developer agents (separate from Console XOne wallets)."
      />
      <SearchBar searching={searching} onSearch={commitSearch}>
        <Input
          className="max-w-sm"
          placeholder="Search name / address / prefix"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitSearch();
          }}
        />
        <Select
          value={draftStatus || "__all__"}
          onValueChange={(v) => setDraftStatus(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-auto min-w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="active">active</SelectItem>
            <SelectItem value="disabled">disabled</SelectItem>
          </SelectContent>
        </Select>
      </SearchBar>
      {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}
      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Spent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" to={`/legacy-agents/${row.id}`}>
                      {row.name}
                    </Link>
                    <p className="font-mono text-[11px] text-muted-foreground">{row.api_key_prefix}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {shorten(row.wallet_address, 8, 6)}
                  </TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell className="font-mono text-xs">{row.spent_amount}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 ? (
                <TableEmpty
                  colSpan={4}
                  message="No agents"
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
