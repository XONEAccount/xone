import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/layout/page-loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage, shorten } from "@/lib/utils";

type OnChainBalance = { symbol: string; balance: string; chain: string };

type ApiKeyRow = {
  id: string;
  name: string;
  token_prefix: string;
  status: string;
  created_at: string;
};

type AgentRow = {
  id: string;
  name: string;
  chain: string;
  currency: string;
  daily_limit: number;
  per_transaction: number;
  remaining_daily: number;
  wallet_address: string;
  status: string;
  created_at: string;
  on_chain: OnChainBalance[];
};

type HistoryRow = {
  id: string;
  agent_id: string;
  type: string;
  amount: string | number | null;
  currency: string | null;
  to_address: string | null;
  url: string | null;
  tx_hash: string | null;
  created_at: string;
};

type DetailResponse = {
  ok: true;
  item: {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    created_at: string;
    stats: {
      keys: number;
      keys_active: number;
      agents: number;
      agents_active: number;
      history: number;
    };
  };
  keys: ApiKeyRow[];
  agents: AgentRow[];
  recent: {
    history: HistoryRow[];
  };
};

/**
 * Formats amount for display.
 * @param value - Amount
 */
function fmtAmount(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/**
 * Base Sepolia explorer tx URL.
 * @param hash - Transaction hash
 */
function explorerTx(hash: string): string {
  return `https://sepolia.basescan.org/tx/${hash}`;
}

/**
 * Console user detail: keys, agent wallets, and ledger.
 */
export function XoneTenantDetailPage() {
  const { id = "" } = useParams();
  const { authFetch } = useAuth();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch<DetailResponse>(
          `/api/xone/profiles/${encodeURIComponent(id)}`,
        );
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(errorMessage(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, id]);

  if (!data && !error) {
    return <PageLoading />;
  }

  const item = data?.item;

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in">
      <PageHeader
        icon={Users}
        title={item?.email ?? "Console user"}
        description="Operator profile with API keys, agent wallets, and spend history."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/xone/tenants">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              Back
            </Link>
          </Button>
        }
      />
      {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}
      {item ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{item.email}</p>
                <p className="text-muted-foreground">{item.name?.trim() ? item.name : "—"}</p>
                <p className="font-mono text-xs text-muted-foreground">{item.id}</p>
                <p className="text-muted-foreground">
                  Created {new Date(item.created_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span>API keys</span>
                  <span>
                    {item.stats.keys_active}/{item.stats.keys} active
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Agent wallets</span>
                  <span>
                    {item.stats.agents_active}/{item.stats.agents} active
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Recent ledger</span>
                  <span>{item.stats.history}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>API keys</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Operate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.keys.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="font-mono text-xs">{row.token_prefix}…</TableCell>
                      <TableCell>
                        <Badge variant={row.status === "active" ? "default" : "secondary"}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/xone/keys/${encodeURIComponent(row.id)}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.keys.length === 0 ? (
                    <TableEmpty colSpan={5} message="No API keys" />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agent wallets</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>On-chain</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead className="text-right">Operate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.agents.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "active"
                              ? "default"
                              : row.status === "deleted"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs" title={row.wallet_address}>
                        {shorten(row.wallet_address, 8, 6)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.on_chain.length === 0
                          ? "—"
                          : row.on_chain
                              .map((b) => `${fmtAmount(b.balance)} ${b.symbol}`)
                              .join(" · ")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {fmtAmount(row.remaining_daily)}/{fmtAmount(row.daily_limit)}{" "}
                        {row.currency}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/xone/wallets/${row.id}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.agents.length === 0 ? (
                    <TableEmpty colSpan={6} message="No agent wallets" />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ledger</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent.history.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <Link className="hover:underline" to={`/xone/wallets/${row.agent_id}`}>
                          {shorten(row.agent_id, 8, 6)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{row.type}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {fmtAmount(row.amount)}
                        {row.currency ? ` ${row.currency}` : ""}
                      </TableCell>
                      <TableCell className="font-mono text-xs" title={row.to_address ?? undefined}>
                        {row.to_address ? shorten(row.to_address, 8, 6) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.tx_hash ? (
                          <a
                            className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                            href={explorerTx(row.tx_hash)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {shorten(row.tx_hash, 8, 6)}
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.recent.history.length === 0 ? (
                    <TableEmpty colSpan={6} message="No ledger rows" />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
