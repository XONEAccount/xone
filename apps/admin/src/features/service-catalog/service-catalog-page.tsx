import { useEffect, useState, type FormEvent } from "react";
import { Ban, CircleCheck, ListTree, Pencil, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  TableLoading,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useServerPagination } from "@/hooks/use-server-pagination";
import type { ListResponse } from "@/lib/api";
import { errorMessage } from "@/lib/utils";

export type ServiceCatalogRow = {
  id: string;
  list_kind: "x402" | "agent";
  name: string;
  description: string;
  url: string;
  status: "active" | "disabled";
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type AppliedFilters = {
  q: string;
  kind: string;
  status: string;
};

type EditorState = {
  mode: "create" | "edit";
  id: string;
  listKind: "x402" | "agent";
  name: string;
  description: string;
  url: string;
  status: "active" | "disabled";
  sortOrder: string;
};

/**
 * Empty editor form defaults.
 */
function emptyEditor(): EditorState {
  return {
    mode: "create",
    id: "",
    listKind: "agent",
    name: "",
    description: "",
    url: "",
    status: "active",
    sortOrder: "0",
  };
}

/**
 * Admin CRUD for wallet Service List (X402 List + Agent List).
 */
export function ServiceCatalogPage() {
  const { authFetch } = useAuth();
  const pager = useServerPagination(10);
  const [draftQ, setDraftQ] = useState("");
  const [draftKind, setDraftKind] = useState("all");
  const [draftStatus, setDraftStatus] = useState("all");
  const [applied, setApplied] = useState<AppliedFilters>({
    q: "",
    kind: "all",
    status: "all",
  });
  const [items, setItems] = useState<ServiceCatalogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [statusTarget, setStatusTarget] = useState<ServiceCatalogRow | null>(
    null,
  );
  const [statusBusy, setStatusBusy] = useState(false);

  /**
   * Commits draft filters and resets to page 1.
   */
  function commitSearch(): void {
    pager.resetPage();
    setApplied({ q: draftQ, kind: draftKind, status: draftStatus });
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
        if (applied.kind === "x402" || applied.kind === "agent") {
          params.set("kind", applied.kind);
        }
        if (applied.status === "active" || applied.status === "disabled") {
          params.set("status", applied.status);
        }
        const res = await authFetch<ListResponse<ServiceCatalogRow>>(
          `/api/service-catalog?${params}`,
        );
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
  }, [authFetch, pager.limit, pager.offset, applied, reloadKey]);

  /**
   * Opens create dialog.
   */
  function openCreate(): void {
    setEditor(emptyEditor());
    setFormError(null);
    setEditorOpen(true);
  }

  /**
   * Opens edit dialog for a row.
   * @param row - Catalog row
   */
  function openEdit(row: ServiceCatalogRow): void {
    setEditor({
      mode: "edit",
      id: row.id,
      listKind: row.list_kind,
      name: row.name,
      description: row.description,
      url: row.url,
      status: row.status,
      sortOrder: String(row.sort_order),
    });
    setFormError(null);
    setEditorOpen(true);
  }

  /**
   * Saves create or patch.
   * @param event - Form submit
   */
  async function onSave(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const sortOrder = Number(editor.sortOrder);
      if (!Number.isFinite(sortOrder) || sortOrder < 0) {
        throw new Error("sortOrder must be a non-negative number");
      }

      if (editor.mode === "create") {
        await authFetch("/api/service-catalog", {
          method: "POST",
          body: JSON.stringify({
            id: editor.id.trim(),
            listKind: editor.listKind,
            name: editor.name.trim(),
            description: editor.description.trim(),
            url: editor.url.trim(),
            status: editor.status,
            sortOrder,
          }),
        });
      } else {
        await authFetch(`/api/service-catalog/${encodeURIComponent(editor.id)}`, {
          method: "PATCH",
          body: JSON.stringify({
            listKind: editor.listKind,
            name: editor.name.trim(),
            description: editor.description.trim(),
            url: editor.url.trim(),
            status: editor.status,
            sortOrder,
          }),
        });
      }
      setEditorOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  /**
   * Enables a disabled catalog entry.
   * @param row - Catalog row
   */
  async function onEnable(row: ServiceCatalogRow): Promise<void> {
    if (row.status === "active") return;
    setStatusBusy(true);
    try {
      await authFetch(`/api/service-catalog/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "active" }),
      });
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStatusBusy(false);
    }
  }

  /**
   * Soft-disables a catalog entry (confirmed via AlertDialog).
   */
  async function confirmDisable(): Promise<void> {
    if (!statusTarget || statusTarget.status === "disabled") return;
    setStatusBusy(true);
    try {
      await authFetch(
        `/api/service-catalog/${encodeURIComponent(statusTarget.id)}`,
        { method: "DELETE" },
      );
      setStatusTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          icon={ListTree}
          title="Service catalog"
          description="Platform X402 List + Agent List entries used by wallet Chat."
        />
        <Button type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          Add service
        </Button>
      </div>

      <SearchBar searching={searching} onSearch={commitSearch}>
        <Input
          className="max-w-xs"
          placeholder="Search id / name / url"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitSearch();
          }}
        />
        <Select value={draftKind} onValueChange={setDraftKind}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All lists</SelectItem>
            <SelectItem value="x402">X402 List</SelectItem>
            <SelectItem value="agent">Agent List</SelectItem>
          </SelectContent>
        </Select>
        <Select value={draftStatus} onValueChange={setDraftStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">active</SelectItem>
            <SelectItem value="disabled">disabled</SelectItem>
          </SelectContent>
        </Select>
      </SearchBar>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>List</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-56">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searching ? (
                <TableLoading colSpan={5} />
              ) : (
                <>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {row.id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.list_kind}</Badge>
                      </TableCell>
                      <TableCell className="max-w-70 truncate font-mono text-xs">
                        {row.url}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "active" ? "secondary" : "outline"
                          }
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(row)}
                            aria-label="Edit"
                          >
                            <Pencil
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                              aria-hidden
                            />
                            Edit
                          </Button>
                          {row.status === "active" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={statusBusy}
                              onClick={() => setStatusTarget(row)}
                            >
                              <Ban
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                                aria-hidden
                              />
                              Disable
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={statusBusy}
                              onClick={() => void onEnable(row)}
                            >
                              <CircleCheck
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                                aria-hidden
                              />
                              Enable
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 ? <TableEmpty colSpan={5} /> : null}
                </>
              )}
            </TableBody>
          </Table>
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
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg sm:max-w-lg">
          <form onSubmit={(e) => void onSave(e)}>
            <DialogHeader>
              <DialogTitle>
                {editor.mode === "create" ? "Add service" : "Edit service"}
              </DialogTitle>
              <DialogDescription>
                Changes appear on wallet Service List after refresh.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <p className="text-sm font-medium">ID</p>
                <Input
                  required
                  disabled={editor.mode === "edit"}
                  value={editor.id}
                  onChange={(e) =>
                    setEditor((s) => ({ ...s, id: e.target.value }))
                  }
                  placeholder="agent-bocha-search"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">List</p>
                <Select
                  value={editor.listKind}
                  onValueChange={(v) =>
                    setEditor((s) => ({
                      ...s,
                      listKind: v as "x402" | "agent",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="x402">X402 List</SelectItem>
                    <SelectItem value="agent">Agent List</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Name</p>
                <Input
                  required
                  value={editor.name}
                  onChange={(e) =>
                    setEditor((s) => ({ ...s, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">URL</p>
                <Input
                  required
                  type="url"
                  value={editor.url}
                  onChange={(e) =>
                    setEditor((s) => ({ ...s, url: e.target.value }))
                  }
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Description</p>
                <Textarea
                  value={editor.description}
                  onChange={(e) =>
                    setEditor((s) => ({ ...s, description: e.target.value }))
                  }
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Status</p>
                  <Select
                    value={editor.status}
                    onValueChange={(v) =>
                      setEditor((s) => ({
                        ...s,
                        status: v as "active" | "disabled",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="disabled">disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Sort order</p>
                  <Input
                    value={editor.sortOrder}
                    onChange={(e) => {
                      setEditor((s) => ({
                        ...s,
                        sortOrder: e.target.value,
                      }));
                    }}
                  />
                </div>
              </div>
              {formError ? (
                <p className="text-sm text-[var(--color-destructive)]">
                  {formError}
                </p>
              ) : null}
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditorOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable service?</AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget
                ? `“${statusTarget.name}” will leave consumer X402 / Agent lists until re-enabled.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={statusBusy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDisable();
              }}
            >
              {statusBusy ? "Disabling…" : "Disable"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
