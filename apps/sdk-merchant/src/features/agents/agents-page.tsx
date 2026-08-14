import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, LoaderCircle, Plus, RefreshCw, Search } from "lucide-react";
import type { Agent, AgentStatus, XOneChain } from "@xone/sdk";
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
import { Textarea } from "@/components/ui/textarea";
import { useAccount } from "@/hooks/use-account";
import { errorMessage, shortAddress } from "@/utils/format";

const CHAINS: { label: string; value: XOneChain }[] = [
  { label: "Base Sepolia", value: "base-sepolia" },
  { label: "Base", value: "base" },
  { label: "Polygon", value: "polygon" },
  { label: "Arbitrum", value: "arbitrum" },
];

/**
 * @param text - Newline or comma separated
 * @returns Trimmed unique entries
 */
function parseList(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Agents list + create dialog (console operator).
 */
export function AgentsPage() {
  const {
    agents,
    apiKeys,
    getApiKey,
    agentCount,
    createAgent,
    refresh,
    loading,
  } = useAccount();

  const [search, setSearch] = useState("");
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    apiKeyId: "",
    name: "",
    chain: "base-sepolia" as XOneChain,
    dailyLimit: 10,
    perTransaction: 1,
    allowedHosts: "",
    allowedPayees: "",
  });

  const unboundKeys = useMemo(
    () => apiKeys.filter((k) => k.status === "active" && agentCount(k.id) === 0),
    [apiKeys, agentCount],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => {
      const key = getApiKey(a.apiKeyId)?.name ?? "";
      return (
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.chain.toLowerCase().includes(q) ||
        key.toLowerCase().includes(q) ||
        a.getAddress().toLowerCase().includes(q)
      );
    });
  }, [agents, search, getApiKey]);

  /**
   * Opens create dialog with first unbound key selected.
   */
  function openCreate(): void {
    setForm((f) => ({
      ...f,
      apiKeyId: unboundKeys[0]?.id ?? "",
      name: "",
      allowedHosts: "",
      allowedPayees: "",
    }));
    setError(null);
    setShowCreate(true);
  }

  /**
   * Creates an agent from the console.
   */
  async function onCreate(): Promise<void> {
    setCreating(true);
    setError(null);
    try {
      await createAgent({
        apiKeyId: form.apiKeyId,
        name: form.name.trim(),
        chain: form.chain,
        dailyLimit: form.dailyLimit,
        perTransaction: form.perTransaction,
        allowedHosts: parseList(form.allowedHosts),
        allowedPayees: parseList(form.allowedPayees),
      });
      setShowCreate(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  /**
   * Pause / resume an agent.
   */
  async function onTogglePause(agent: Agent): Promise<void> {
    setPausingId(agent.id);
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
        icon={Bot}
        title="Agents"
        description="Create agents here and bind each to an API key. Runtime tokens can only pay and read — limits and allowlists stay in this console."
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
            <Button
              type="button"
              disabled={unboundKeys.length === 0}
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </>
        }
      />

      {error ? (
        <p className="text-sm text-[var(--color-destructive)]">{error}</p>
      ) : null}

      {agents.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="font-medium">No agents yet</p>
            <p className="text-sm text-muted-foreground">
              Create an API key first, then create an agent here. The SDK token
              can only pay — it cannot raise limits.
            </p>
            <Button
              type="button"
              disabled={unboundKeys.length === 0}
              onClick={openCreate}
            >
              Create agent
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
                  <TableHead>API Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((agent) => {
                  const status = agent.getStatus();
                  const canPause = ["active", "paused", "exhausted"].includes(status);
                  return (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {getApiKey(agent.apiKeyId)?.name ?? agent.apiKeyId.slice(0, 10)}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={status} />
                      </TableCell>
                      <TableCell>{agent.chain}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {shortAddress(agent.getAddress())}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button type="button" variant="ghost" size="sm" asChild>
                            <Link to={`/agents/${agent.id}`}>Open</Link>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!canPause}
                            onClick={() => void onTogglePause(agent)}
                          >
                            {pausingId === agent.id ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : status === "paused" ? (
                              "Resume"
                            ) : (
                              "Pause"
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No matching agents.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create agent</DialogTitle>
            <DialogDescription>
              Bind one unused API key. Fund on-chain USDC at the agent address
              after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="agent-key">
                API key
              </label>
              <select
                id="agent-key"
                className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                value={form.apiKeyId}
                onChange={(e) => setForm((f) => ({ ...f, apiKeyId: e.target.value }))}
              >
                <option value="">Select an unused key</option>
                {unboundKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="agent-name">
                Name
              </label>
              <Input
                id="agent-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="research-bot"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="agent-chain">
                Chain
              </label>
              <select
                id="agent-chain"
                className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                value={form.chain}
                onChange={(e) =>
                  setForm((f) => ({ ...f, chain: e.target.value as XOneChain }))
                }
              >
                {CHAINS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Daily limit</label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.1}
                  value={form.dailyLimit}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      dailyLimit: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Per transaction</label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.1}
                  value={form.perTransaction}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      perTransaction: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Allowed hosts (optional)</label>
              <Textarea
                value={form.allowedHosts}
                onChange={(e) =>
                  setForm((f) => ({ ...f, allowedHosts: e.target.value }))
                }
                placeholder="One host per line, e.g. seller.example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Allowed payees (optional)</label>
              <Textarea
                value={form.allowedPayees}
                onChange={(e) =>
                  setForm((f) => ({ ...f, allowedPayees: e.target.value }))
                }
                placeholder="One 0x address per line"
              />
            </div>
          </div>
          {error && showCreate ? (
            <p className="text-sm text-[var(--color-destructive)]">{error}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !form.apiKeyId ||
                !form.name.trim() ||
                form.dailyLimit <= 0 ||
                form.perTransaction <= 0 ||
                creating
              }
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
 * @param status - Agent status
 */
function StatusPill({ status }: { status: AgentStatus }) {
  const tone =
    status === "active" ? "ok" : status === "deleted" ? "bad" : "warn";
  return (
    <span
      className={
        tone === "ok"
          ? "rounded-md border border-border bg-muted px-2 py-0.5 text-xs"
          : tone === "warn"
            ? "rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground"
            : "rounded-md border border-[var(--color-destructive)]/30 px-2 py-0.5 text-xs text-[var(--color-destructive)]"
      }
    >
      {status}
    </span>
  );
}
