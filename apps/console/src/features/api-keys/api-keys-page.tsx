import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Eye, EyeOff, FlaskConical, KeyRound, LoaderCircle, Plus, RefreshCw, Search } from "lucide-react";
import type { ApiKeyRecord } from "@xone/sdk";
import { PageHeader } from "@/components/layout/page-header";
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

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteKey, setDeleteKey] = useState<ApiKeyRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return apiKeys;
    return apiKeys.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.token.toLowerCase().includes(q) ||
        k.status.toLowerCase().includes(q),
    );
  }, [apiKeys, search]);

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
   */
  async function onTogglePause(key: ApiKeyRecord): Promise<void> {
    const agent = getAgentByApiKey(key.id);
    if (!agent) {
      setError("No agent is bound to this API key yet.");
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
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in">
      <PageHeader
        icon={KeyRound}
        title="API Keys"
        description="Create uniquely named keys. Each key binds to one wallet. "
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-48 pl-9 sm:w-56"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
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
                {filtered.map((key) => {
                  const agent = getAgentByApiKey(key.id);
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
                              <Check className="h-3.5 w-3.5" aria-label="Copied" />
                            ) : (
                              "Copy"
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pausingId === key.id}
                            onClick={() => void onTogglePause(key)}
                          >
                            {pausingId === key.id ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : agent?.getStatus() === "paused" ? (
                              "Resume"
                            ) : (
                              "Pause"
                            )}
                          </Button>
                          {agent ? (
                            <Button type="button" variant="ghost" size="sm" asChild>
                              <Link to={`/wallet/${agent.id}`}>Wallet</Link>
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
