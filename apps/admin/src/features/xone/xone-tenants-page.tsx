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

type Tenant = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

/**
 * Console operator profiles (xone_profiles).
 */
export function XoneTenantsPage() {
  const { authFetch } = useAuth();
  const pager = useServerPagination(10);
  const [draftQ, setDraftQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [items, setItems] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(true);

  /**
   * Commits draft filter and resets to page 1.
   */
  function commitSearch(): void {
    pager.resetPage();
    setAppliedQ(draftQ);
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
        if (appliedQ.trim()) params.set("q", appliedQ.trim());
        const res = await authFetch<ListResponse<Tenant>>(`/api/xone/profiles?${params}`);
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
        title="Console users"
        description="Operators who own API keys and XOne agent wallets."
      />
      <SearchBar searching={searching} onSearch={commitSearch}>
        <Input
          className="max-w-sm"
          placeholder="Search email or name"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
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
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Id</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Operate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searching ? (
                <TableLoading colSpan={5} />
              ) : (
                <>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{shorten(row.id)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/xone/tenants/${encodeURIComponent(row.id)}`}>
                            <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                            Detail
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 ? (
                    <TableEmpty colSpan={5} message="No console users" />
                  ) : null}
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
