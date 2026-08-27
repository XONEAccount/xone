import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage, shorten } from "@/lib/utils";
import type { XoneAgent } from "./xone-wallets-page";

/**
 * XOne wallet emergency controls: pause / resume / soft-delete / limits.
 */
export function XoneWalletDetailPage() {
  const { id = "" } = useParams();
  const { authFetch } = useAuth();
  const [item, setItem] = useState<XoneAgent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dailyLimit, setDailyLimit] = useState("");
  const [perTx, setPerTx] = useState("");

  /**
   * Reloads agent.
   */
  async function load(): Promise<void> {
    const res = await authFetch<{ ok: true; item: XoneAgent }>(`/api/xone/agents/${id}`);
    setItem(res.item);
    setDailyLimit(String(res.item.daily_limit));
    setPerTx(String(res.item.per_transaction));
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
   * Runs a mutating action then reloads.
   */
  async function run(path: string, init?: RequestInit): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch<{ ok: true; item: XoneAgent }>(path, init);
      setItem(res.item);
      setDailyLimit(String(res.item.daily_limit));
      setPerTx(String(res.item.per_transaction));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!item && !error) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-in">
      <PageHeader
        icon={Wallet}
        title={item?.name ?? "Wallet"}
        description="Ops emergency controls. Private keys are never exposed."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/xone/wallets">Back</Link>
          </Button>
        }
      />
      {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}
      {item ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 font-mono text-sm">
              <p>id: {item.id}</p>
              <p>status: {item.status}</p>
              <p>address: {item.wallet_address}</p>
              <p>chain: {item.chain} · {item.currency}</p>
              <p>
                daily {item.daily_limit} · per-tx {item.per_transaction} · remaining{" "}
                {item.remaining_daily}
              </p>
              <p>user: {shorten(item.user_id)} · key: {shorten(item.api_key_id)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Lifecycle</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || item.status === "paused" || item.status === "deleted"}
                onClick={() => void run(`/api/xone/agents/${id}/pause`, { method: "POST" })}
              >
                Pause
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || item.status === "active" || item.status === "deleted"}
                onClick={() => void run(`/api/xone/agents/${id}/resume`, { method: "POST" })}
              >
                Resume
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy || item.status === "deleted"}
                onClick={() => {
                  if (!confirm("Soft-delete this agent wallet?")) return;
                  void run(`/api/xone/agents/${id}`, { method: "DELETE" });
                }}
              >
                Soft-delete
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Limits</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-2">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Daily</span>
                <Input
                  className="w-32"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Per tx</span>
                <Input className="w-32" value={perTx} onChange={(e) => setPerTx(e.target.value)} />
              </label>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run(`/api/xone/agents/${id}/limits`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      dailyLimit: Number(dailyLimit),
                      perTransaction: Number(perTx),
                    }),
                  })
                }
              >
                Save
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
