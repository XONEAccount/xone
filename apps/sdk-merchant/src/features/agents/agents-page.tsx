import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, LoaderCircle, RefreshCw, Search } from "lucide-react";
import type { Agent, AgentStatus } from "@xone/sdk";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { errorMessage, shortAddress } from "@/utils/format";

/**
 * Agents list (console operator). Creation is not offered on this page.
 */
export function AgentsPage() {
  const { agents, getApiKey, refresh, loading } = useAccount();

  const [search, setSearch] = useState("");
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        description="Bound wallets and spend policy. Runtime tokens can only pay and read — limits stay in this console."
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
              Agents bound to your API keys will appear here.
            </p>
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
