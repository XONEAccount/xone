import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/utils";

type Stats = {
  profiles: number;
  agents: number;
  activeAgents: number;
  payments: number;
  fundings: number;
  failedPayments: number;
  xoneProfiles: number;
  xoneAgents: number;
  xoneActiveAgents: number;
  xoneApiKeys: number;
  xoneHistory: number;
};

/**
 * Ops overview with wallet + XOne counts.
 */
export function DashboardPage() {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch<{ ok: true; stats: Stats }>("/api/dashboard/stats");
        if (!cancelled) setStats(res.stats);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const walletCards = [
    { label: "Wallet users", value: stats?.profiles, to: "/profiles" },
    { label: "Legacy agents", value: stats?.agents, to: "/legacy-agents" },
    { label: "Active legacy", value: stats?.activeAgents, to: "/legacy-agents" },
    { label: "Payments", value: stats?.payments, to: "/payments" },
    { label: "Failed payments", value: stats?.failedPayments, to: "/payments" },
    { label: "Fundings", value: stats?.fundings, to: "/fundings" },
  ];

  const xoneCards = [
    { label: "Console users", value: stats?.xoneProfiles, to: "/xone/tenants" },
    { label: "API keys", value: stats?.xoneApiKeys, to: "/xone/keys" },
    { label: "XOne wallets", value: stats?.xoneAgents, to: "/xone/wallets" },
    { label: "Active wallets", value: stats?.xoneActiveAgents, to: "/xone/wallets" },
    { label: "Ledger events", value: stats?.xoneHistory, to: "/xone/ledger" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-in">
      <PageHeader
        icon={LayoutDashboard}
        title="Overview"
        description="Cross-product health for web wallet, console, and SDK spend."
      />
      {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Consumer wallet</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {walletCards.map((card) => (
            <StatCard key={card.label} {...card} loading={!stats && !error} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Console / SDK</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {xoneCards.map((card) => (
            <StatCard key={card.label} {...card} loading={!stats && !error} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  to,
  loading,
}: {
  label: string;
  value?: number;
  to: string;
  loading: boolean;
}) {
  return (
    <Link to={to} className="block hover-lift">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-3xl font-semibold tracking-tight">
            {loading ? "—" : (value ?? 0)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
