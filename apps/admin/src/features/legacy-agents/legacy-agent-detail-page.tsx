import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, CircleCheck, ExternalLink, KeyRound, Save, Shield } from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";
import { cn, errorMessage, shorten } from "@/lib/utils";
import type { LegacyAgent } from "./legacy-agents-page";

type OnChainBalance = { symbol: string; balance: string; chain: string };

type PaymentRow = {
  id: string;
  amount: string | number;
  asset: string;
  chain: string;
  recipient: string | null;
  merchant: string | null;
  resource: string | null;
  status: string;
  provider: string | null;
  failure_reason: string | null;
  idempotency_key: string | null;
  created_at: string;
};

type FundingRow = {
  id: string;
  amount: string | number;
  tx_hash: string | null;
  from_address: string | null;
  created_at: string;
};

type AgentDetail = LegacyAgent & {
  on_chain: OnChainBalance[];
  owner_profile: {
    wallet_address: string;
    display_name: string | null;
    created_at: string;
    updated_at: string | null;
  } | null;
  a2a_settings: {
    agent_id: string;
    wallet_address: string;
    enabled: boolean;
    max_amount: number | null;
    max_single_payment: number | null;
    spent_amount: number | null;
  } | null;
  stats: {
    payments: number;
    fundings: number;
  };
};

type DetailResponse = {
  ok: true;
  item: AgentDetail;
  recent: {
    payments: PaymentRow[];
    fundings: FundingRow[];
  };
};

/**
 * Formats a balance/amount for display.
 * @param value - Numeric or string amount
 */
function fmtAmount(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/**
 * Base Sepolia explorer link for an address.
 * @param address - EVM address
 */
function explorerAddress(address: string): string {
  return `https://sepolia.basescan.org/address/${address}`;
}

/**
 * Base Sepolia explorer link for a tx hash.
 * @param hash - Transaction hash
 */
function explorerTx(hash: string): string {
  return `https://sepolia.basescan.org/tx/${hash}`;
}

/**
 * Legacy agent detail: assets, activity, and emergency controls.
 */
export function LegacyAgentDetailPage() {
  const { id = "" } = useParams();
  const { authFetch } = useAuth();
  const [item, setItem] = useState<AgentDetail | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [fundings, setFundings] = useState<FundingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [maxAmount, setMaxAmount] = useState("");
  const [maxSingle, setMaxSingle] = useState("");
  const [revokeOpen, setRevokeOpen] = useState(false);

  /**
   * Reloads agent detail with activity.
   */
  async function load(): Promise<void> {
    const res = await authFetch<DetailResponse>(`/api/agents/${id}`);
    setItem(res.item);
    setPayments(res.recent.payments);
    setFundings(res.recent.fundings);
    setMaxAmount(String(res.item.max_amount));
    setMaxSingle(String(res.item.max_single_payment));
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
   * Patches status or limits, then reloads enriched detail.
   * @param body - Patch payload
   */
  async function patch(body: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await authFetch<{ ok: true; item: LegacyAgent }>(`/api/agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Revokes API key and disables agent.
   */
  async function confirmRevoke(): Promise<void> {
    setRevokeOpen(false);
    setBusy(true);
    try {
      await authFetch<{ ok: true; item: LegacyAgent }>(`/api/agents/${id}/revoke-key`, {
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
        icon={Shield}
        title={item?.name ?? "Agent"}
        description="Agent wallet assets, payments, fundings, and emergency controls."
        actions={
          <>
            {item ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || item.status === "disabled"}
                  onClick={() => void patch({ status: "disabled" })}
                >
                  <Ban className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  Disable
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || item.status === "active"}
                  onClick={() => void patch({ status: "active" })}
                >
                  <CircleCheck className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  Enable
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => setRevokeOpen(true)}
                >
                  <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  Revoke key
                </Button>
              </>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link to="/legacy-agents">
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
                <CardTitle>Agent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.status === "active" ? "default" : "secondary"}>
                    {item.status}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                </div>
                {item.description?.trim() ? (
                  <p className="text-muted-foreground">{item.description}</p>
                ) : null}
                <p>
                  Asset {item.asset} · Chain {item.chain}
                </p>
                <p className="font-mono text-xs">Key prefix: {item.api_key_prefix}</p>
                <p className="text-muted-foreground">
                  Created {new Date(item.created_at).toLocaleString()}
                  {item.updated_at
                    ? ` · Updated ${new Date(item.updated_at).toLocaleString()}`
                    : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Recent payments {item.stats.payments} · fundings {item.stats.fundings}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>On-chain (Base Sepolia)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="break-all font-mono text-xs" title={item.wallet_address}>
                  {item.wallet_address}
                </p>
                <a
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                  href={explorerAddress(item.wallet_address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View wallet on explorer
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
                {item.on_chain.length === 0 ? (
                  <p className="text-muted-foreground">Could not load on-chain balances.</p>
                ) : (
                  item.on_chain.map((b) => (
                    <div key={b.symbol} className="flex justify-between font-mono text-xs">
                      <span>{b.symbol}</span>
                      <span>{fmtAmount(b.balance)}</span>
                    </div>
                  ))
                )}
                <div className="border-t pt-2 text-xs text-muted-foreground">
                  Allowance ETH {fmtAmount(item.allowance_eth)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Owner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="break-all font-mono text-xs" title={item.owner_wallet}>
                  {item.owner_wallet}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/profiles/${encodeURIComponent(item.owner_wallet)}`}>
                      Open owner profile
                    </Link>
                  </Button>
                  <a
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                    href={explorerAddress(item.owner_wallet)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Explorer
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </div>
                {item.owner_profile?.display_name ? (
                  <p>Name: {item.owner_profile.display_name}</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Spend policy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between font-mono text-xs">
                  <span>Spent</span>
                  <span>
                    {fmtAmount(item.spent_amount)} / {fmtAmount(item.max_amount)} {item.asset}
                  </span>
                </div>
                <div className="flex justify-between font-mono text-xs">
                  <span>Max single</span>
                  <span>
                    {fmtAmount(item.max_single_payment)} {item.asset}
                  </span>
                </div>
                {item.a2a_settings ? (
                  <div className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
                    <p>
                      A2A {item.a2a_settings.enabled ? "enabled" : "disabled"} · spent{" "}
                      {fmtAmount(item.a2a_settings.spent_amount)} /{" "}
                      {fmtAmount(item.a2a_settings.max_amount)}
                    </p>
                    <p>A2A max single {fmtAmount(item.a2a_settings.max_single_payment)}</p>
                  </div>
                ) : (
                  <p className="border-t pt-2 text-xs text-muted-foreground">No A2A settings</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {fmtAmount(row.amount)} {row.asset}
                      </TableCell>
                      <TableCell className="text-xs">{row.status}</TableCell>
                      <TableCell className="font-mono text-xs" title={row.recipient ?? undefined}>
                        {row.recipient ? shorten(row.recipient, 8, 6) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate text-xs">
                        {row.merchant ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate text-xs text-muted-foreground">
                        {row.failure_reason || row.resource || row.provider || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 ? (
                    <TableEmpty colSpan={6} message="No payments" />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fundings</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fundings.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{fmtAmount(row.amount)}</TableCell>
                      <TableCell className="font-mono text-xs" title={row.from_address ?? undefined}>
                        {row.from_address ? shorten(row.from_address, 8, 6) : "—"}
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
                  {fundings.length === 0 ? (
                    <TableEmpty colSpan={4} message="No fundings" />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Update limits</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-2">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Max amount</span>
                <Input
                  className="w-32"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Max single</span>
                <Input
                  className="w-32"
                  value={maxSingle}
                  onChange={(e) => setMaxSingle(e.target.value)}
                />
              </label>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void patch({
                    maxAmount: Number(maxAmount),
                    maxSinglePayment: Number(maxSingle),
                  })
                }
              >
                <Save className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Save
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke the API key and disable the agent. Spend will stop immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={() => void confirmRevoke()}
            >
              Revoke key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
