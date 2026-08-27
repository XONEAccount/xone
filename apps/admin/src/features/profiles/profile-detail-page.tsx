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

type AgentRow = {
  id: string;
  name: string;
  wallet_address: string;
  status: string;
  asset: string;
  chain: string;
  max_amount: number;
  max_single_payment: number;
  spent_amount: number;
  allowance_eth: number;
  on_chain: OnChainBalance[];
};

type WalletTx = {
  id: string;
  asset: string;
  amount: string | number;
  direction: string;
  status: string;
  tx_hash: string | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  agent_id: string;
  agent_name: string | null;
  amount: string | number;
  asset: string;
  status: string;
  recipient: string | null;
  merchant: string | null;
  created_at: string;
};

type FundingRow = {
  id: string;
  agent_id: string;
  agent_name: string | null;
  amount: string | number;
  tx_hash: string | null;
  from_address: string | null;
  created_at: string;
};

type A2ALedgerRow = {
  id: string;
  kind: string;
  title: string | null;
  amount: string | number;
  asset: string;
  status: string;
  counterparty: string | null;
  created_at: string;
};

type DetailResponse = {
  ok: true;
  item: {
    wallet_address: string;
    display_name: string | null;
    created_at: string;
    updated_at: string | null;
    on_chain: OnChainBalance[];
    a2a: {
      balance: number | null;
      updated_at: string | null;
    };
    stats: {
      agents_total: number;
      agents_active: number;
    };
  };
  agents: AgentRow[];
  recent: {
    wallet_transactions: WalletTx[];
    a2a_ledger: A2ALedgerRow[];
    payments: PaymentRow[];
    fundings: FundingRow[];
  };
};

/**
 * Formats a balance for display.
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
 * Wallet user detail: balances, agent sub-wallets, and activity.
 */
export function ProfileDetailPage() {
  const { address = "" } = useParams();
  const { authFetch } = useAuth();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await authFetch<DetailResponse>(
          `/api/profiles/${encodeURIComponent(address)}`,
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, address]);

  if (loading) {
    return <PageLoading />;
  }

  const item = data?.item;
  const title = item?.display_name?.trim() || shorten(address, 10, 8);

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in">
      <PageHeader
        icon={Users}
        title={title}
        description="Main wallet assets, agent sub-wallets, and activity."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/profiles">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              Back
            </Link>
          </Button>
        }
      />
      {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}
      {!item ? null : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
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
                  View on explorer
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
                <p className="text-muted-foreground">
                  Created {new Date(item.created_at).toLocaleString()}
                  {item.updated_at
                    ? ` · Updated ${new Date(item.updated_at).toLocaleString()}`
                    : ""}
                </p>
                <p>
                  Agents {item.stats.agents_active}/{item.stats.agents_total}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Main wallet assets (Base Sepolia)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
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
                <div className="flex justify-between border-t pt-2 text-xs">
                  <span className="text-muted-foreground">A2A spendable</span>
                  <span className="font-mono">
                    {item.a2a.balance == null ? "—" : `${fmtAmount(item.a2a.balance)} USDC`}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Agent sub-wallets</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>On-chain</TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell>
                        <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                          {agent.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs" title={agent.wallet_address}>
                        {shorten(agent.wallet_address, 8, 6)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {agent.on_chain.length === 0
                          ? "—"
                          : agent.on_chain
                              .map((b) => `${fmtAmount(b.balance)} ${b.symbol}`)
                              .join(" · ")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        spent {fmtAmount(agent.spent_amount)} / {fmtAmount(agent.max_amount)}{" "}
                        {agent.asset}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/legacy-agents/${agent.id}`}>Open</Link>
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
              <CardTitle>Main wallet transfers</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent.wallet_transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{tx.direction}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {fmtAmount(tx.amount)} {tx.asset}
                      </TableCell>
                      <TableCell className="text-xs">{tx.status}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {tx.tx_hash ? (
                          <a
                            className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                            href={explorerTx(tx.tx_hash)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {shorten(tx.tx_hash, 8, 6)}
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.recent.wallet_transactions.length === 0 ? (
                    <TableEmpty colSpan={5} message="No wallet transfers" />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Agent payments</CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recent.payments.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Link
                            className="hover:underline"
                            to={`/legacy-agents/${row.agent_id}`}
                          >
                            {row.agent_name ?? shorten(row.agent_id, 6, 4)}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {fmtAmount(row.amount)} {row.asset}
                        </TableCell>
                        <TableCell className="text-xs">{row.status}</TableCell>
                      </TableRow>
                    ))}
                    {data.recent.payments.length === 0 ? (
                      <TableEmpty colSpan={4} message="No payments" />
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Agent fundings</CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Tx</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recent.fundings.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Link
                            className="hover:underline"
                            to={`/legacy-agents/${row.agent_id}`}
                          >
                            {row.agent_name ?? shorten(row.agent_id, 6, 4)}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {fmtAmount(row.amount)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.tx_hash ? (
                            <a
                              className="underline-offset-2 hover:underline"
                              href={explorerTx(row.tx_hash)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {shorten(row.tx_hash, 8, 6)}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.recent.fundings.length === 0 ? (
                      <TableEmpty colSpan={4} message="No fundings" />
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>A2A ledger</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent.a2a_ledger.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{row.kind}</TableCell>
                      <TableCell className="max-w-[14rem] truncate text-xs">
                        {row.title ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {fmtAmount(row.amount)} {row.asset}
                      </TableCell>
                      <TableCell className="text-xs">{row.status}</TableCell>
                    </TableRow>
                  ))}
                  {data.recent.a2a_ledger.length === 0 ? (
                    <TableEmpty colSpan={5} message="No A2A ledger rows" />
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
