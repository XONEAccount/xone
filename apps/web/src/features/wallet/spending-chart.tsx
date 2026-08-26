import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/hooks/use-i18n";
import { useSpendingActivity } from "@/hooks/use-spending-activity";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  aggregateByPeriod,
  aggregateByService,
  type PeriodBucket,
  type ServiceBucket,
  type TimeGrain,
} from "@/lib/spending-activity";
import { cn } from "@/lib/utils";

const GRAINS: { value: TimeGrain; labelKey: MessageKey }[] = [
  { value: "day", labelKey: "spending.day" },
  { value: "month", labelKey: "spending.month" },
  { value: "year", labelKey: "spending.year" },
];

/**
 * Dashboard spending chart: income/spend by period, breakdown by wallet and service.
 */
export function SpendingChart() {
  const { t } = useI18n();
  const { events, wallets, isLoading } = useSpendingActivity();
  const [grain, setGrain] = useState<TimeGrain>("day");
  const [walletId, setWalletId] = useState("all");

  const periods = useMemo(
    () => aggregateByPeriod(events, grain, walletId),
    [events, grain, walletId],
  );
  const services = useMemo(
    () => aggregateByService(events, grain, walletId),
    [events, grain, walletId],
  );

  const totals = useMemo(() => {
    let income = 0;
    let spend = 0;
    for (const period of periods) {
      income += period.income;
      spend += period.spend;
    }
    return { income, spend };
  }, [periods]);

  const hasData = events.length > 0;
  const rangeKey =
    grain === "day"
      ? "spending.rangeDay"
      : grain === "month"
        ? "spending.rangeMonth"
        : "spending.rangeYear";

  return (
    <section className="space-y-3 fade-up delay-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">{t("spending.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("spending.subtitle")}</p>
        </div>
        <div className="flex rounded-md border border-border p-0.5">
          {GRAINS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setGrain(item.value)}
              className={cn(
                "rounded px-2.5 py-1 text-xs transition-colors",
                grain === item.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{t("spending.trend")}</CardTitle>
              <CardDescription>
                {t(rangeKey)}
                {" · "}
                {t("spending.totals", {
                  spend: totals.spend.toFixed(2),
                  income: totals.income.toFixed(2),
                })}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={walletId === "all"}
              label={t("spending.allWallets")}
              onClick={() => setWalletId("all")}
            />
            {wallets.map((wallet) => (
              <FilterChip
                key={wallet.id}
                active={walletId === wallet.id}
                label={
                  wallet.id === "main" ? t("spending.mainWallet") : wallet.label
                }
                onClick={() => setWalletId(wallet.id)}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !hasData ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("spending.empty")}
            </p>
          ) : (
            <>
              <PeriodBars periods={periods} />
              <ServiceBars services={services} />
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

type FilterChipProps = {
  active: boolean;
  label: string;
  onClick: () => void;
};

/**
 * Compact toggle chip for wallet filtering.
 */
function FilterChip({ active, label, onClick }: FilterChipProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className="h-7 px-2.5 text-xs"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

type PeriodBarsProps = {
  periods: PeriodBucket[];
};

/**
 * Dual-series bar chart for income vs spend across periods.
 * Width tracks the container so the plot fills the card.
 * @param periods - Aggregated period buckets
 */
function PeriodBars({ periods }: PeriodBarsProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(640);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sync = () => setPlotWidth(Math.max(320, Math.floor(el.clientWidth)));
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(
    0.001,
    ...periods.flatMap((period) => [period.income, period.spend]),
  );
  const chartH = 160;
  const padX = 12;
  const padTop = 12;
  const padBottom = 28;
  const gap = 8;
  const groupW =
    periods.length === 0
      ? 40
      : (plotWidth - padX * 2 - gap * (periods.length - 1)) / periods.length;
  const barW = Math.max(4, groupW * 0.35);
  const outLabel = t("spending.out");
  const inLabel = t("spending.in");
  const svgH = chartH + padTop + padBottom;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-foreground" aria-hidden />
          {outLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-muted-foreground/50" aria-hidden />
          {inLabel}
        </span>
      </div>
      <div ref={containerRef} className="w-full">
        <svg
          viewBox={`0 0 ${plotWidth} ${svgH}`}
          width={plotWidth}
          height={svgH}
          className="block h-auto w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={t("spending.chartAria")}
        >
          <line
            x1={padX}
            y1={padTop + chartH}
            x2={plotWidth - padX}
            y2={padTop + chartH}
            stroke="currentColor"
            strokeOpacity={0.12}
          />
          {periods.map((period, index) => {
            const x = padX + index * (groupW + gap);
            const spendH = (period.spend / max) * chartH;
            const incomeH = (period.income / max) * chartH;
            const spendX = x + groupW * 0.12;
            const incomeX = x + groupW * 0.53;
            return (
              <g key={period.key}>
                <title>
                  {period.label} · {outLabel} {period.spend} · {inLabel}{" "}
                  {period.income}
                </title>
                <rect
                  x={spendX}
                  y={padTop + chartH - spendH}
                  width={barW}
                  height={Math.max(period.spend > 0 ? 2 : 0, spendH)}
                  className="fill-foreground"
                  rx={2}
                />
                <rect
                  x={incomeX}
                  y={padTop + chartH - incomeH}
                  width={barW}
                  height={Math.max(period.income > 0 ? 2 : 0, incomeH)}
                  className="fill-muted-foreground/45"
                  rx={2}
                />
                <text
                  x={x + groupW / 2}
                  y={padTop + chartH + 18}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {period.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

type ServiceBarsProps = {
  services: ServiceBucket[];
};

/**
 * Horizontal bars for spend by service / merchant.
 * @param services - Top service buckets
 */
function ServiceBars({ services }: ServiceBarsProps) {
  const { t } = useI18n();

  if (services.length === 0) {
    return (
      <div className="border-t border-border pt-4">
        <p className="text-sm font-medium">{t("spending.byService")}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("spending.byServiceEmpty")}
        </p>
      </div>
    );
  }

  const max = Math.max(...services.map((item) => item.spend), 0.001);

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-sm font-medium">{t("spending.byService")}</p>
      <ul className="space-y-2.5">
        {services.map((item) => {
          const width = `${Math.max(4, (item.spend / max) * 100)}%`;
          return (
            <li key={item.service} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-muted-foreground">{item.service}</span>
                <span className="shrink-0 font-mono">
                  {item.spend.toFixed(3)} USDC
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground transition-all"
                  style={{ width }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
