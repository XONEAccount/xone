import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/layout/page-loading";
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
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn, errorMessage, shorten } from "@/lib/utils";

type OnChainBalance = { symbol: string; balance: string; chain: string };

type HistoryRow = {
  id: string;
  type: string;
  amount: string | number | null;
  currency: string | null;
  to_address: string | null;
  url: string | null;
  tx_hash: string | null;
  created_at: string;
};

type PayIntentRow = {
  id: string;
  idempotency_key: string;
  url: string;
  status: string;
  max_amount: string | null;
  error_message: string | null;
  created_at: string;
};

type ApiKeyDetail = {
  id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  status: string;
  created_at: string;
  owner_profile: {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    created_at: string;
  } | null;
  agent: {
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
  } | null;
  stats: {
    history: number;
    pay_intents: number;
  };
};

type DetailResponse = {
  ok: true;
  item: ApiKeyDetail;
  recent: {
    history: HistoryRow[];
    pay_intents: PayIntentRow[];
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
 * Base Sepolia explorer address URL.
 * @param address - EVM address
 */
function explorerAddress(address: string): string {
  return `https://sepolia.basescan.org/address/${address}`;
}

/**
 * Base Sepolia explorer tx URL.
 * @param hash - Transaction hash
 */
function explorerTx(hash: string): string {
  return `https://sepolia.basescan.org/tx/${hash}`;
}

/**
 * API key detail: owner, linked agent wallet, ledger, and revoke.
 */
export function XoneKeyDetailPage() {
  const { id = "" } = useParams();
  const { authFetch } = useAuth();
  const [item, setItem] = useState<ApiKeyDetail | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [payIntents, setPayIntents] = useState<PayIntentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  /**
   * Reloads key detail.
   */
  async function load(): Promise<void> {
    const res = await authFetch<DetailResponse>(`/api/xone/api-keys/${encodeURIComponent(id)}`);
    setItem(res.item);
    setHistory(res.recent.history);
    setPayIntents(res.recent.pay_intents);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, id]);

  /**
   * Soft-deletes the key then reloads.
   */
  async function confirmRevoke(): Promise<void> {
    setRevokeOpen(false);
    setBusy(true);
    setError(null);
    try {
      await authFetch(`/api/xone/api-keys/${encodeURIComponent(id)}/revoke`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!item && !error) {
    return <PageLoading />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in">
      <PageHeader
        icon={KeyRound}
        title={item?.name ?? "API key"}
        description="Spend token metadata only — full secrets are never shown."
        actions={
          <>
            {item && item.status !== "deleted" ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => setRevokeOpen(true)}
              >
                <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Revoke
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link to="/xone/keys">
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Back
              </Link>
            </Button>
          </>
        }
      />
      {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}
      {item ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Key</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.status === "active" ? "default" : "secondary"}>
                    {item.status}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                </div>
                <p className="font-mono text-xs">{item.token_prefix}…</p>
                <p className="text-muted-foreground">
                  Created {new Date(item.created_at).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  History {item.stats.history} · pay intents {item.stats.pay_intents}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Owner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {item.owner_profile ? (
                  <>
                    <p>{item.owner_profile.email}</p>
                    {item.owner_profile.name ? (
                      <p className="text-muted-foreground">{item.owner_profile.name}</p>
                    ) : null}
                    <p className="font-mono text-xs text-muted-foreground">
                      {item.owner_profile.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(item.owner_profile.created_at).toLocaleString()}
                    </p>
                  </>
                ) : (
                  <p className="font-mono text-xs">{item.user_id}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Linked agent wallet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {item.agent ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.agent.name}</p>
                        <Badge
                          variant={
                            item.agent.status === "active"
                              ? "default"
                              : item.agent.status === "deleted"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {item.agent.status}
                        </Badge>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">{item.agent.id}</p>
                      <p>
                        {item.agent.currency} · {item.agent.chain} · remaining{" "}
                        {fmtAmount(item.agent.remaining_daily)} /{" "}
                        {fmtAmount(item.agent.daily_limit)}
                      </p>
                      <p className="break-all font-mono text-xs" title={item.agent.wallet_address}>
                        {item.agent.wallet_address}
                      </p>
                      <a
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                        href={explorerAddress(item.agent.wallet_address)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Explorer
                        <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/xone/wallets/${item.agent.id}`}>Open wallet</Link>
                    </Button>
                  </div>
                  {item.agent.on_chain.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Could not load on-chain balances.
                    </p>
                  ) : (
                    <div className="space-y-1 border-t pt-2">
                      {item.agent.on_chain.map((b) => (
                        <div key={b.symbol} className="flex justify-between font-mono text-xs">
                          <span>{b.symbol}</span>
                          <span>{fmtAmount(b.balance)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">No agent wallet bound to this key.</p>
              )}
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
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{row.type}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {fmtAmount(row.amount)}
                        {row.currency ? ` ${row.currency}` : ""}
                      </TableCell>
                      <TableCell className="font-mono text-xs" title={row.to_address ?? undefined}>
                        {row.to_address ? shorten(row.to_address, 8, 6) : "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-[12rem] truncate text-xs"
                        title={row.url ?? undefined}
                      >
                        {row.url ?? "—"}
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
                  {history.length === 0 ? (
                    <TableEmpty colSpan={6} message="No ledger rows" />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pay intents</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Max</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Idempotency</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payIntents.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{row.status}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.max_amount ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate text-xs" title={row.url}>
                        {row.url}
                      </TableCell>
                      <TableCell className="font-mono text-xs" title={row.idempotency_key}>
                        {shorten(row.idempotency_key, 8, 6)}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate text-xs text-muted-foreground">
                        {row.error_message ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {payIntents.length === 0 ? (
                    <TableEmpty colSpan={6} message="No pay intents" />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              {item
                ? `${item.name} (${item.token_prefix}…) spend tokens will stop working immediately.`
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
