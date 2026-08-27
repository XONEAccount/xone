import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/layout/page-loading";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/utils";

type DayPoint = {
  date: string;
  value: number;
};

type ChartBlock = {
  total: number;
  series: DayPoint[];
};

type ChartsResponse = {
  ok: true;
  windowDays: number;
  charts: {
    walletUsers: ChartBlock;
    consoleUsers: ChartBlock;
    paymentAmount: ChartBlock;
    apiKeys: ChartBlock;
  };
};

const countConfig = {
  value: {
    label: "Count",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig;

const amountConfig = {
  value: {
    label: "Amount",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig;

/**
 * Formats a short date label for chart axes.
 * @param date - YYYY-MM-DD
 */
function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/**
 * Formats a total number for the card header.
 * @param value - Total
 * @param money - Whether to treat as currency-like amount
 */
function formatTotal(value: number, money = false): string {
  if (money) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
  }
  return value.toLocaleString();
}

/**
 * Ops overview charts for the four primary metrics.
 */
export function DashboardPage() {
  const { authFetch } = useAuth();
  const [data, setData] = useState<ChartsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch<ChartsResponse>("/api/dashboard/stats");
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  if (!data && !error) {
    return <PageLoading />;
  }

  const charts = data?.charts;

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-in">
      <PageHeader
        icon={LayoutDashboard}
        title="Overview"
        description="Last 30 days trends — wallet users, console users, payment amount, and API keys."
      />
      {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}

      {charts ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <MetricChartCard
            title="Wallet users"
            description="All-time total · daily new profiles"
            total={formatTotal(charts.walletUsers.total)}
            to="/profiles"
            series={charts.walletUsers.series}
            config={countConfig}
          />
          <MetricChartCard
            title="Console users"
            description="All-time total · daily new operators"
            total={formatTotal(charts.consoleUsers.total)}
            to="/xone/tenants"
            series={charts.consoleUsers.series}
            config={countConfig}
          />
          <MetricChartCard
            title="Payment amount"
            description="Last 30 days · non-failed agent payments"
            total={formatTotal(charts.paymentAmount.total, true)}
            to="/payments"
            series={charts.paymentAmount.series}
            config={amountConfig}
            allowDecimals
          />
          <MetricChartCard
            title="API keys"
            description="All-time total · daily new keys"
            total={formatTotal(charts.apiKeys.total)}
            to="/xone/keys"
            series={charts.apiKeys.series}
            config={countConfig}
          />
        </div>
      ) : null}
    </div>
  );
}

type MetricChartCardProps = {
  title: string;
  description: string;
  total: string;
  to: string;
  series: DayPoint[];
  config: ChartConfig;
  allowDecimals?: boolean;
};

/**
 * Linked card with total + area chart.
 */
function MetricChartCard({
  title,
  description,
  total,
  to,
  series,
  config,
  allowDecimals = false,
}: MetricChartCardProps) {
  return (
    <Link to={to} className="block hover-lift">
      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
            <p className="shrink-0 font-mono text-2xl font-semibold tracking-tight">{total}</p>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={config} className="aspect-[2/1] w-full">
            <AreaChart data={series} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={28}
                tickFormatter={shortDate}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={40}
                tickMargin={4}
                allowDecimals={allowDecimals}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => String(value)}
                    indicator="line"
                  />
                }
              />
              <Area
                dataKey="value"
                type="monotone"
                fill="var(--color-value)"
                fillOpacity={0.12}
                stroke="var(--color-value)"
                strokeWidth={1.75}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </Link>
  );
}
