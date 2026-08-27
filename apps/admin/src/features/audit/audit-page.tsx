import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
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

type AuditRow = {
  id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
};

/**
 * Admin audit log (explicit Search).
 */
export function AuditPage() {
  const { authFetch } = useAuth();
  const pager = useServerPagination(10);
  const [draftQ, setDraftQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [items, setItems] = useState<AuditRow[]>([]);
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
        const res = await authFetch<ListResponse<AuditRow>>(`/api/audit?${params}`);
        if (cancelled) return;
        setItems(res.items);
        pager.setTotal(res.total);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err));
          setItems([]);
          pager.setTotal(0);
        }
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
        icon={ClipboardList}
        title="Audit"
        description="Who paused, revoked, or changed limits."
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
          placeholder="Actor, action, or target"
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
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searching ? (
                <TableLoading colSpan={4} />
              ) : (
                <>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.actor}</TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.target_type}
                        {row.target_id ? ` · ${shorten(row.target_id)}` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 ? <TableEmpty colSpan={4} message="No audit rows" /> : null}
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
