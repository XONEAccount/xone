import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bot, LoaderCircle } from "lucide-react";
import type { Agent, AgentHistoryEntry, AgentLimits, AgentStatus } from "@xone/sdk";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { errorMessage, formatDateTime, shortAddress } from "@/utils/format";

/**
 * Agent detail: limits, allowlists, pause/delete, history.
 */
export function AgentDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { getAgent, getApiKey } = useAccount();

  const [agent, setAgent] = useState<Agent | undefined>();
  const [currency, setCurrency] = useState("USDC");
  const [history, setHistory] = useState<AgentHistoryEntry[]>([]);
  const [limits, setLimits] = useState<AgentLimits | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [perTransaction, setPerTransaction] = useState(1);
  const [allowedHostsText, setAllowedHostsText] = useState("");
  const [allowedPayeesText, setAllowedPayeesText] = useState("");

  const status: AgentStatus = agent?.getStatus() ?? "deleted";

  const refresh = useCallback(async () => {
    const found = getAgent(id);
    setAgent(found);
    if (!found) return;

    const bal = await found.getBalance();
    setCurrency(bal.currency);

    const lim = await found.getLimits();
    setLimits(lim);
    setDailyLimit(lim.dailyLimit);
    setPerTransaction(lim.perTransaction);
    setAllowedHostsText((lim.allowedHosts ?? []).join("\n"));
    setAllowedPayeesText((lim.allowedPayees ?? []).join("\n"));

    setHistory(await found.getHistory({ limit: 50 }));
  }, [getAgent, id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Runs a mutation with toast-like feedback.
   */
  async function run(
    label: string,
    fn: () => Promise<unknown>,
  ): Promise<void> {
    if (!agent) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      setMessage(label);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 animate-in">
        <PageHeader icon={Bot} title="Agent not found" />
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-muted-foreground">
              It may have been removed, or mock data was cleared after a refresh.
            </p>
            <Button type="button" variant="outline" asChild>
              <Link to="/agents">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in">
      <PageHeader
        icon={Bot}
        title={agent.name}
        description={`${agent.id} · key: ${getApiKey(agent.apiKeyId)?.name ?? agent.apiKeyId}`}
        actions={
          <>
            <StatusPill status={status} />
            <Button type="button" variant="outline" asChild>
              <Link to="/agents">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
          </>
        }
      />

      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--color-destructive)]">{error}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Address" value={shortAddress(agent.getAddress())} mono />
        <StatCard label="Currency" value={currency} mono />
        <StatCard
          label="Daily / Per"
          value={`${limits?.dailyLimit ?? "—"} / ${limits?.perTransaction ?? "—"}`}
          mono
        />
        <StatCard
          label="Remaining today"
          value={String(limits?.remainingDaily ?? "—")}
          mono
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="break-all font-mono text-sm text-muted-foreground">
              {agent.getAddress()}
            </p>
            <p className="text-sm text-muted-foreground">
              Fund on-chain USDC at this address. There is no console deposit.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Limits & controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input
                type="number"
                min={0.01}
                step={0.1}
                className="w-28"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                placeholder="Daily"
              />
              <Input
                type="number"
                min={0.01}
                step={0.1}
                className="w-28"
                value={perTransaction}
                onChange={(e) => setPerTransaction(Number(e.target.value))}
                placeholder="Per tx"
              />
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run("Limits updated", () =>
                    agent.updateLimits({
                      dailyLimit,
                      perTransaction,
                      allowedHosts: allowedHostsText
                        .split(/[\n,]/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                      allowedPayees: allowedPayeesText
                        .split(/[\n,]/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }),
                  )
                }
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save limits
              </Button>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Allowed hosts</label>
              <Textarea
                value={allowedHostsText}
                onChange={(e) => setAllowedHostsText(e.target.value)}
                placeholder="One host per line. Empty = any public host."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Allowed payees</label>
              <Textarea
                value={allowedPayeesText}
                onChange={(e) => setAllowedPayeesText(e.target.value)}
                placeholder="One 0x address per line. Empty = any payee."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={
                  busy || (status !== "active" && status !== "exhausted")
                }
                onClick={() => void run("Paused", () => agent.pause())}
              >
                Pause
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || status !== "paused"}
                onClick={() => void run("Resumed", () => agent.resume())}
              >
                Resume
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy || status === "deleted"}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Soft delete blocks all spend. History is kept. Continue?",
                    )
                  ) {
                    return;
                  }
                  void run("Deleted", async () => {
                    await agent.delete();
                    navigate("/agents");
                  });
                }}
              >
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.type}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.amount != null
                      ? `${row.amount} ${row.currency ?? ""}`
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate font-mono text-xs">
                    {row.to || row.url || row.txHash || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No history yet
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-sm font-medium ${mono ? "font-mono" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

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
