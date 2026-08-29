import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  MessageSquare,
  QrCode,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SpendingChart } from "@/features/wallet/spending-chart";
import { RecentActivity } from "@/features/wallet/recent-activity";
import { useI18n } from "@/hooks/use-i18n";
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import type { MessageKey } from "@/lib/i18n/messages";
import { listDeveloperAgents } from "@/lib/developer-api";
import { cn } from "@/lib/utils";
import { useA2AStore } from "@/stores/a2a";

type ActionTone = "teal" | "sky" | "amber" | "emerald" | "slate";

/** Wallet-first shortcuts; AI chat sits just before ledger. */
const actions: {
  to: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  tone: ActionTone;
}[] = [
    { to: "/app/send", labelKey: "dashboard.actionSend", icon: ArrowLeftRight, tone: "teal" },
    { to: "/app/receive", labelKey: "dashboard.actionReceive", icon: QrCode, tone: "sky" },
    { to: "/app/pay", labelKey: "dashboard.actionPay", icon: CreditCard, tone: "amber" },
    { to: "/app/chat", labelKey: "dashboard.actionChat", icon: MessageSquare, tone: "emerald" },
    {
      to: "/app/ledger/payments",
      labelKey: "dashboard.actionLedger",
      icon: ArrowUpRight,
      tone: "slate",
    },
  ];

const toneWell: Record<ActionTone, string> = {
  teal: "icon-well-teal",
  sky: "icon-well-sky",
  amber: "icon-well-amber",
  emerald: "icon-well-emerald",
  slate: "icon-well-slate",
};

/**
 * Wallet home: balance overview, shortcuts, recent activity, and spending chart.
 */
export function DashboardPage() {
  const { t } = useI18n();
  const { address, usdc, isLoading } = useWalletBalances();
  const { address: ownerAddress } = useWalletAccount();
  const a2aBalance = useA2AStore((s) => s.a2aBalance);
  const owner = ownerAddress?.toLowerCase() ?? address?.toLowerCase() ?? "";

  const myAgents = useQuery({
    queryKey: ["developer-agents", owner],
    enabled: Boolean(owner),
    queryFn: () => listDeveloperAgents(owner),
  });

  const agentCount = myAgents.data?.length ?? 0;
  const activeCount =
    myAgents.data?.filter((agent) => agent.status === "active").length ?? 0;

  const agentsLabel =
    !owner || myAgents.isLoading
      ? t("dashboard.agentsLoading")
      : agentCount === 0
        ? t("dashboard.agentsNone")
        : t("dashboard.agentsActive", { active: activeCount, total: agentCount });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 animate-in">
      <section className="surface-card relative overflow-hidden rounded-xl p-6 fade-up">
        <p className="text-sm font-medium text-muted-foreground">
          {t("dashboard.available", { chain: "Base" })}
        </p>
        {isLoading ? (
          <Skeleton className="mt-2 h-12 w-56" />
        ) : (
          <h1 className="balance-tick mt-1 text-4xl font-semibold tracking-tight">
            {usdc.toFixed(2)}{" "}
            <span className="text-lg font-medium text-muted-foreground">USDC</span>
          </h1>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {t("dashboard.a2aAndAgents", {
            a2a: a2aBalance.toFixed(2),
            agents: agentsLabel,
          })}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.to}
              to={action.to}
              className={cn(
                "hover-lift surface-card flex flex-col items-center gap-3 rounded-xl p-4",
                cnDelay(index),
              )}
            >
              <span className={cn("icon-well icon-pop h-10 w-10", toneWell[action.tone])}>
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="text-sm font-medium">{t(action.labelKey)}</span>
            </Link>
          );
        })}
      </section>

      <RecentActivity />

      <SpendingChart />
    </div>
  );
}

/**
 * Staggered entrance class for action buttons.
 * @param index - Button index
 */
function cnDelay(index: number) {
  if (index === 0) return "fade-up";
  if (index === 1) return "fade-up delay-1";
  if (index === 2) return "fade-up delay-2";
  if (index === 3) return "fade-up delay-3";
  return "fade-up delay-4";
}
