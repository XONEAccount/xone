import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { ListPager } from "@/components/layout/list-pager";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn, errorMessage, shorten } from "@/lib/utils";

type ApiKey = {
  id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  status: string;
  created_at: string;
};

type AppliedFilters = {
  q: string;
  status: string;
};

/**
 * XOne API keys (prefix only — never full secret).
 */
export function XoneKeysPage() {
  const { authFetch } = useAuth();
  const pager = useServerPagination(10);
  const [draftQ, setDraftQ] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [applied, setApplied] = useState<AppliedFilters>({ q: "", status: "" });
  const [items, setItems] = useState<ApiKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  /**
   * Commits draft filters and resets to page 1.
   */
  function commitSearch(): void {
    pager.resetPage();
    setApplied({ q: draftQ, status: draftStatus });
  }

  /**
   * Reloads list using applied filters.
   */
  async function load(filters: AppliedFilters): Promise<void> {
    const params = new URLSearchParams({
      limit: String(pager.limit),
      offset: String(pager.offset),
    });
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.status) params.set("status", filters.status);
    const res = await authFetch<ListResponse<ApiKey>>(`/api/xone/api-keys?${params}`);
    setItems(res.items);
    pager.setTotal(res.total);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setSearching(true);
      try {
        await load(applied);
        if (!cancelled) setError(null);
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

  /**
   * Soft-deletes the selected key, then reloads with applied filters.
   */
  async function confirmRevoke(): Promise<void> {
    if (!revokeTarget) return;
    const id = revokeTarget.id;
    setRevokeTarget(null);
    setBusyId(id);
    try {
      await authFetch(`/api/xone/api-keys/${id}/revoke`, { method: "POST" });
      await load(applied);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in">
      <PageHeader
        icon={KeyRound}
        title="API keys"
        description="Spend tokens for SDK / MCP / HTTP. Full secrets are never shown."
      />
      <SearchBar searching={searching} onSearch={commitSearch}>
        <Input
          className="max-w-sm"
          placeholder="Search name or prefix"
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
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            <SelectItem value="active">active</SelectItem>
            <SelectItem value="deleted">deleted</SelectItem>
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
                <TableHead>Prefix</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>User</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="font-mono text-xs">{row.token_prefix}…</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell className="font-mono text-xs">{shorten(row.user_id)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={row.status === "deleted" || busyId === row.id}
                      onClick={() => setRevokeTarget(row)}
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 ? <TableEmpty colSpan={5} message="No keys" /> : null}
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

      <AlertDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget
                ? `${revokeTarget.name} (${revokeTarget.token_prefix}…) spend tokens will stop working immediately.`
                : "Spend tokens will stop working immediately."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={() => void confirmRevoke()}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
