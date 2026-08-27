import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Users } from "lucide-react";
import { ListPager } from "@/components/layout/list-pager";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { Button } from "@/components/ui/button";
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

type Profile = {
  wallet_address: string;
  created_at: string;
  updated_at: string | null;
  agents_total: number;
  agents_active: number;
  payments: number;
  fundings: number;
  a2a_balance: number | null;
};

/**
 * Consumer wallet profiles list with activity stats.
 */
export function ProfilesPage() {
  const { authFetch } = useAuth();
  const pager = useServerPagination(10);
  const [draftQ, setDraftQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [items, setItems] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          limit: String(pager.limit),
          offset: String(pager.offset),
        });
        if (appliedQ.trim()) params.set("q", appliedQ.trim());
        const res = await authFetch<ListResponse<Profile>>(`/api/profiles?${params}`);
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
  }, [authFetch, pager.limit, pager.offset, appliedQ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in">
      <PageHeader
        icon={Users}
        title="Wallet users"
        description="Consumer wallet profiles with agent and activity stats."
      />
      <SearchBar
        searching={searching}
        onSearch={() => {
          pager.resetPage();
          setAppliedQ(draftQ);
        }}
      >
        <Input
          className="max-w-sm"
          placeholder="Search address or name"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              pager.resetPage();
              setAppliedQ(draftQ);
            }
          }}
        />
      </SearchBar>
      {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}
      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Agents</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead>Fundings</TableHead>
                <TableHead>A2A</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Operate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searching ? (
                <TableLoading colSpan={8} />
              ) : (
                <>
                  {items.map((row) => (
                    <TableRow key={row.wallet_address}>
                      <TableCell
                        className="max-w-[12rem] truncate font-mono text-xs"
                        title={row.wallet_address}
                      >
                        {shorten(row.wallet_address, 10, 8)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.agents_active}/{row.agents_total}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.payments}</TableCell>
                      <TableCell className="font-mono text-xs">{row.fundings}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.a2a_balance == null ? "—" : row.a2a_balance.toFixed(2)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {row.updated_at ? new Date(row.updated_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/profiles/${encodeURIComponent(row.wallet_address)}`}>
                            <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                            Detail
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 ? <TableEmpty colSpan={8} message="No profiles" /> : null}
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
