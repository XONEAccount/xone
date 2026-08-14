import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, KeyRound, LoaderCircle, Plus, RefreshCw, Search } from "lucide-react";
import type { ApiKeyRecord } from "@xone/sdk";
import { PageHeader } from "@/components/layout/page-header";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccount } from "@/hooks/use-account";
import { errorMessage, formatDateTime } from "@/utils/format";

const MASK = "xone_••••••••••••••••";

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
  const [message, setMessage] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [pausingId, setPausingId] = useState<string | null>(null);

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
        setMessage("API key created — token copied. Click the eye to reveal.");
      } else {
        setMessage("API key created.");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  /**
   * Soft-deletes a key after confirm.
   */
  async function onDelete(key: ApiKeyRecord): Promise<void> {
    if (
      !window.confirm(
        "Deleted keys can no longer pay. Existing agents stay listed. Continue?",
      )
    ) {
      return;
    }
    try {
      await deleteApiKey(key.id);
      setMessage("API key deleted");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  /**
   * Pause / resume the agent bound to this key.
   */
  async function onTogglePause(key: ApiKeyRecord): Promise<void> {
    const agent = getAgentByApiKey(key.id);
    if (!agent) return;
    setPausingId(key.id);
    setError(null);
    try {
      if (agent.getStatus() === "paused") await agent.resume();
      else await agent.pause();
      setMessage(
        agent.getStatus() === "paused"
          ? `Paused ${agent.name}`
          : `Resumed ${agent.name}`,
      );
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
        description="Create uniquely named keys. Each key binds to one agent. The token can only pay and read — it cannot change limits."
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
            <Button type="button" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </>
        }
      />

      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {apiKeys.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="font-medium">Create your first API key</p>
            <p className="text-sm text-muted-foreground">
              1. Create a key and copy the token → 2. Create an agent → 3. In your
              app, call <code className="font-mono text-xs">new XOne({"{ agentToken }"})</code> then{" "}
              <code className="font-mono text-xs">agent.get()</code> /{" "}
              <code className="font-mono text-xs">pay()</code>.
            </p>
            <Button type="button" onClick={() => setShowCreate(true)}>
              Create API key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Bound</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((key) => {
                  const agent = getAgentByApiKey(key.id);
                  const canPause =
                    agent &&
                    ["active", "paused", "exhausted"].includes(agent.getStatus());
                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <StatusPill
                          value={key.status}
                          tone={key.status === "active" ? "ok" : "bad"}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="max-w-[140px] truncate font-mono text-xs">
                            {key.token && revealed[key.id] ? key.token : MASK}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={!key.token}
                            onClick={() =>
                              setRevealed((r) => ({
                                ...r,
                                [key.id]: !r[key.id],
                              }))
                            }
                            aria-label={revealed[key.id] ? "Hide token" : "Show token"}
                          >
                            {revealed[key.id] ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {agent
                          ? `${agent.name} (${agent.getStatus()})`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(key.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!key.token}
                            onClick={() =>
                              void navigator.clipboard.writeText(key.token)
                            }
                          >
                            Copy
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!canPause}
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
                              <Link to={`/agents/${agent.id}`}>Agent</Link>
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            disabled={key.status === "deleted"}
                            onClick={() => void onDelete(key)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No matches. Try clearing the search.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
  return (
    <span
      className={
        tone === "ok"
          ? "rounded-md border border-border bg-muted px-2 py-0.5 text-xs"
          : tone === "warn"
            ? "rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground"
            : "rounded-md border border-destructive/30 px-2 py-0.5 text-xs text-destructive"
      }
    >
      {value}
    </span>
  );
}
