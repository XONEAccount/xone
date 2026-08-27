import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  Copy,
  Edit,
  Eye,
  EyeOff,
  FlaskConical,
  KeyRound,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";
import type { ApiKeyRecord } from "@xonepay/sdk";
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
  Table,
  TableBody,
  TableEmpty,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccount } from "@/hooks/use-account";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { errorMessage, formatDateTime } from "@/utils/format";

const MASK = "xone_••••••••••••••••";
const PLAYGROUND_URL =
  (import.meta.env.VITE_PLAYGROUND_URL as string | undefined)?.trim() ||
  "https://xone-sdk-docs.pages.dev/?view=playground";

/**
 * API keys list and create flow.
 */
export function ApiKeysPage() {
  const {
    apiKeys,
    createApiKey,
    deleteApiKey,
    getAgentByApiKey,
    refresh,
    loading,
  } = useAccount();

  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [pauseKey, setPauseKey] = useState<ApiKeyRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteKey, setDeleteKey] = useState<ApiKeyRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apiKeys;
    return apiKeys.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.token.toLowerCase().includes(q) ||
        k.status.toLowerCase().includes(q),
    );
  }, [apiKeys, query]);

  const pager = useClientPagination(filtered);

  useEffect(() => {
    pager.setPage(1);
  }, [query]);

  /**
   * Commits the draft search string.
   */
  function commitSearch(): void {
    setQuery(draft);
  }

  /**
   * Creates a key and copies the token.
   */
  async function onCreate(): Promise<void> {
    setCreating(true);
    setError(null);
    try {
      const key = await createApiKey(name.trim());
      setShowCreate(false);
      setName("");
      if (key.token) {
        await navigator.clipboard.writeText(key.token);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  /**
   * Copies the spend API key when plaintext is still in this session.
   * @param key - Row whose token may still be available
   */
  async function onCopy(key: ApiKeyRecord): Promise<void> {
    if (!key.token) return;
    try {
      await navigator.clipboard.writeText(key.token);
      setCopiedId(key.id);
      window.setTimeout(() => {
        setCopiedId((id) => (id === key.id ? null : id));
      }, 1600);
    } catch (err) {
      setError(errorMessage(err) || "Could not copy the API key.");
    }
  }

  /**
   * Soft-deletes the key selected in the confirm dialog.
   */
  async function onConfirmDelete(): Promise<void> {
    if (!deleteKey) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteApiKey(deleteKey.id);
      setDeleteKey(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  /**
   * Pause / resume the agent bound to this key.
   * @param key - API key whose bound agent to toggle
   */
  async function onTogglePause(key: ApiKeyRecord): Promise<void> {
    const agent = getAgentByApiKey(key.id);
    if (!agent) {
      setError("No agent is bound to this API key yet.");
      setPauseKey(null);
      return;
    }
    setPausingId(key.id);
    setError(null);
    try {
      if (agent.getStatus() === "paused") await agent.resume();
      else await agent.pause();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPausingId(null);
      setPauseKey(null);
    }
  }

  /**
   * Opens pause confirm, or resumes immediately.
   * @param key - API key row
   */
  function onPauseClick(key: ApiKeyRecord): void {
    const agent = getAgentByApiKey(key.id);
    if (!agent) {
      setError("No agent is bound to this API key yet.");
      return;
    }
    if (agent.getStatus() === "paused") {
      void onTogglePause(key);
      return;
    }
    setError(null);
    setPauseKey(key);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in">
      <PageHeader
        icon={KeyRound}
        title="API Keys"
        description="Create uniquely named keys. Each key binds to one wallet. "
        actions={
          <>
            <SearchBar onSearch={commitSearch}>
              <Input
                className="w-48 sm:w-56"
                placeholder="Search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitSearch();
                }}
              />
            </SearchBar>
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
            <Button type="button" variant="outline" asChild>
              <a href={PLAYGROUND_URL} target="_blank" rel="noreferrer">
                <FlaskConical className="h-4 w-4" />
                Try online
              </a>
            </Button>
            <Button type="button" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </>
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

      {apiKeys.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="font-medium">Create your first API key</p>
            <p className="text-sm text-muted-foreground">
              1. Create a key and copy the token → 2. Create an agent → 3.{" "}
              <a
                href={PLAYGROUND_URL}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Try it online
              </a>{" "}
              or call <code className="font-mono text-xs">new XOne({"{ agentToken }"})</code>{" "}
              in your app.
            </p>
            <Button type="button" onClick={() => setShowCreate(true)}>
              Create API key
            </Button>
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
                  <TableHead>Bound</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pager.pageItems.map((key) => {
                  const agent = getAgentByApiKey(key.id);
                  const paused = agent?.getStatus() === "paused";
                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium whitespace-nowrap">{key.name}</TableCell>
                      <TableCell>
                        <StatusPill
                          value={key.status}
                          tone={key.status === "active" ? "ok" : "bad"}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="max-w-35 truncate font-mono text-xs">
                            {key.token && revealed[key.id] ? key.token : MASK}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setRevealed((r) => ({
                                ...r,
                                [key.id]: !r[key.id],
                              }))
                            }
                            aria-label={revealed[key.id] ? "Hide API key" : "Show API key"}
                          >
                            {revealed[key.id] ? (
                              <Eye className="h-3.5 w-3.5" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {agent
                          ? `${agent.name} (${agent.getStatus()})`
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(key.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-nowrap items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!key.token}
                            title={
                              key.token
                                ? "Copy API key"
                                : "Plaintext is only available right after create"
                            }
                            onClick={() => void onCopy(key)}
                          >
                            {copiedId === key.id ? (
                              <Check className="h-3.5 w-3.5" strokeWidth={1.75} aria-label="Copied" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                            )}
                            Copy
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pausingId === key.id}
                            onClick={() => onPauseClick(key)}
                          >
                            {pausingId === key.id ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : paused ? (
                              <Play className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                            ) : (
                              <Pause className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                            )}
                            {paused ? "Resume" : "Pause"}
                          </Button>
                          {agent ? (
                            <Button type="button" variant="ghost" size="sm" asChild>
                              <Link to={`/wallet/${agent.id}`}>
                                <Edit className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                                edit
                              </Link>
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            disabled={key.status === "deleted"}
                            onClick={() => {
                              setError(null);
                              setDeleteKey(key);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 ? (
                  <TableEmpty colSpan={6} title="No matches. Try clearing the search." />
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {apiKeys.length > 0 ? (
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

      <AlertDialog
        open={Boolean(pauseKey)}
        onOpenChange={(open) => {
          if (!open && !pausingId) setPauseKey(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause wallet?</AlertDialogTitle>
            <AlertDialogDescription>
              {pauseKey
                ? `The agent bound to ${pauseKey.name} will stop accepting spend until you resume it.`
                : "The bound agent will stop accepting spend until you resume it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(pausingId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pauseKey || Boolean(pausingId)}
              onClick={(e) => {
                e.preventDefault();
                if (pauseKey) void onTogglePause(pauseKey);
              }}
            >
              {pausingId ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Pause
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(deleteKey)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteKey(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API key</DialogTitle>
            <DialogDescription>
              {deleteKey
                ? `${deleteKey.name} will no longer be able to pay. Bound agents stay listed.`
                : "This key will no longer be able to pay."}
            </DialogDescription>
          </DialogHeader>
          {error && deleteKey ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={deleting}
              onClick={() => setDeleteKey(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void onConfirmDelete()}
            >
              {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Unique name, e.g. prod or staging.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="key-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Unique name"
            />
          </div>
          {error && showCreate ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!name.trim() || creating}
              onClick={() => void onCreate()}
            >
              {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Compact status label.
 */
function StatusPill({
  value,
  tone,
}: {
  value: string;
  tone: "ok" | "warn" | "bad";
}) {
  const variant = tone === "ok" ? "secondary" : tone === "bad" ? "destructive" : "outline";
  return <Badge variant={variant}>{value}</Badge>;
}
