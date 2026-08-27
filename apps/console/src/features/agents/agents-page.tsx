import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LoaderCircle,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Wallet,
} from "lucide-react";
import type { Agent, AgentStatus } from "@xonepay/sdk";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccount } from "@/hooks/use-account";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { errorMessage, shortAddress } from "@/utils/format";

/**
 * Wallet list (console operator). Creation is not offered on this page.
 */
export function AgentsPage() {
  const { agents, getApiKey, refresh, loading } = useAccount();

  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [pauseTarget, setPauseTarget] = useState<Agent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
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
  }, [agents, query, getApiKey]);

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
   * Pause / resume a wallet agent.
   * @param agent - Target agent
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
      setPauseTarget(null);
    }
  }

  /**
   * Opens pause confirm, or resumes immediately.
   * @param agent - Target agent
   */
  function onPauseClick(agent: Agent): void {
    if (agent.getStatus() === "paused") {
      void onTogglePause(agent);
      return;
    }
    setError(null);
    setPauseTarget(agent);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in">
      <PageHeader
        icon={Wallet}
        title="Wallet"
        description="Generated agent wallets and spend policy. Runtime tokens can only pay and read — limits stay in this console."
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
          </>
        }
      />

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {agents.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <Empty className="border-0 py-6 md:py-8">
              <EmptyHeader>
                <EmptyTitle>No wallets yet</EmptyTitle>
                <EmptyDescription>
                  Wallets bound to your API keys will appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
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
                {pager.pageItems.map((agent) => {
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
                            <Link to={`/wallet/${agent.id}`}>
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                              Edit
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!canPause || pausingId === agent.id}
                            onClick={() => onPauseClick(agent)}
                          >
                            {pausingId === agent.id ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : status === "paused" ? (
                              <Play className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                            ) : (
                              <Pause className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                            )}
                            {status === "paused" ? "Resume" : "Pause"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 ? (
                  <TableEmpty colSpan={6} title="No matching agents." />
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {agents.length > 0 ? (
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
        open={Boolean(pauseTarget)}
        onOpenChange={(open) => {
          if (!open && !pausingId) setPauseTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause wallet?</AlertDialogTitle>
            <AlertDialogDescription>
              {pauseTarget
                ? `${pauseTarget.name} will stop accepting spend until you resume it.`
                : "This wallet will stop accepting spend until you resume it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(pausingId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pauseTarget || Boolean(pausingId)}
              onClick={(e) => {
                e.preventDefault();
                if (pauseTarget) void onTogglePause(pauseTarget);
              }}
            >
              {pausingId ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Pause
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Agent status badge (shadcn Badge).
 * @param status - Agent status
 */
function StatusPill({ status }: { status: AgentStatus }) {
  const variant =
    status === "active"
      ? "secondary"
      : status === "deleted"
        ? "destructive"
        : status === "paused"
          ? "outline"
          : "secondary";
  return (
    <Badge
      variant={variant}
      className={
        status === "paused"
          ? "border-border bg-muted text-muted-foreground capitalize"
          : "capitalize"
      }
    >
      {status}
    </Badge>
  );
}
