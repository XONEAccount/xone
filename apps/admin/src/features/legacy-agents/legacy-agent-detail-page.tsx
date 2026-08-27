import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Shield } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage, shorten } from "@/lib/utils";
import type { LegacyAgent } from "./legacy-agents-page";

/**
 * Legacy agent detail + emergency disable / revoke key / limit edit.
 */
export function LegacyAgentDetailPage() {
  const { id = "" } = useParams();
  const { authFetch } = useAuth();
  const [item, setItem] = useState<LegacyAgent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [maxAmount, setMaxAmount] = useState("");
  const [maxSingle, setMaxSingle] = useState("");

  /**
   * Reloads agent.
   */
  async function load(): Promise<void> {
    const res = await authFetch<{ ok: true; item: LegacyAgent }>(`/api/agents/${id}`);
    setItem(res.item);
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
   * Patches status or limits.
   */
  async function patch(body: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch<{ ok: true; item: LegacyAgent }>(`/api/agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setItem(res.item);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Revokes API key and disables agent.
   */
  async function revoke(): Promise<void> {
    if (!confirm("Revoke API key and disable this agent?")) return;
    setBusy(true);
    try {
      const res = await authFetch<{ ok: true; item: LegacyAgent }>(
        `/api/agents/${id}/revoke-key`,
        { method: "POST" },
      );
      setItem(res.item);
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
        icon={Shield}
        title={item?.name ?? "Agent"}
        description="Emergency controls — private keys are never shown."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/legacy-agents">Back</Link>
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
              <p>wallet: {shorten(item.wallet_address, 12, 8)}</p>
              <p>owner: {shorten(item.owner_wallet, 12, 8)}</p>
              <p>key prefix: {item.api_key_prefix}</p>
              <p>
                limits: {item.max_amount} / single {item.max_single_payment} · spent{" "}
                {item.spent_amount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || item.status === "disabled"}
                onClick={() => void patch({ status: "disabled" })}
              >
                Disable
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || item.status === "active"}
                onClick={() => void patch({ status: "active" })}
              >
                Enable
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => void revoke()}
              >
                Revoke key
              </Button>
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
                Save
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
