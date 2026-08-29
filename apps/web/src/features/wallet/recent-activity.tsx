import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/hooks/use-i18n";
import { useSpendingActivity } from "@/hooks/use-spending-activity";
import { cn } from "@/lib/utils";

const RECENT_LIMIT = 5;

/**
 * Dashboard strip of the latest income / spend events across wallets.
 */
export function RecentActivity() {
  const { t, locale } = useI18n();
  const { events, isLoading } = useSpendingActivity();

  const recent = [...events]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, RECENT_LIMIT);

  return (
    <section className="space-y-3 fade-up delay-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">{t("activity.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("activity.subtitle")}
          </p>
        </div>
        <Link
          to="/app/ledger/payments"
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("activity.viewAll")}
        </Link>
      </div>

      <div className="surface-card overflow-hidden rounded-xl">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="space-y-3 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">{t("activity.empty")}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                to="/app/pay"
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                {t("activity.ctaPay")}
              </Link>
              <Link
                to="/app/chat"
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                {t("activity.ctaChat")}
              </Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((event) => {
              const isIn = event.direction === "in";
              const walletLabel =
                event.walletId === "main"
                  ? t("spending.mainWallet")
                  : event.walletLabel;
              return (
                <li
                  key={event.id}
                  className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full border",
                      isIn
                        ? "border-border bg-muted text-foreground"
                        : "border-border bg-background text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {isIn ? (
                      <ArrowDownLeft className="size-4" strokeWidth={1.75} />
                    ) : (
                      <ArrowUpRight className="size-4" strokeWidth={1.75} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{event.service}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {walletLabel}
                      <span className="mx-1.5 text-border">·</span>
                      {formatActivityTime(event.createdAt, locale)}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 font-mono text-sm font-medium tabular-nums",
                      isIn ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {isIn ? "+" : "−"}
                    {event.amount.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}{" "}
                    USDC
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * Formats an activity timestamp for the active UI locale.
 * @param iso - ISO timestamp
 * @param locale - App locale
 */
function formatActivityTime(iso: string, locale: "en" | "zh"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
