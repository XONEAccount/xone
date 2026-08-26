import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  MessageSquare,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SpendingChart } from "@/features/wallet/spending-chart";
import { useI18n } from "@/hooks/use-i18n";
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import type { MessageKey } from "@/lib/i18n/messages";
import { listDeveloperAgents } from "@/lib/developer-api";
import { useA2AStore } from "@/stores/a2a";
import { appChainLabel } from "@/web3";

/** Wallet-first shortcuts; AI chat sits just before ledger. */
const actions: {
  to: string;
  labelKey: MessageKey;
  icon: typeof ArrowLeftRight;
  primary: boolean;
}[] = [
    { to: "/app/send", labelKey: "dashboard.actionSend", icon: ArrowLeftRight, primary: true },
    { to: "/app/receive", labelKey: "dashboard.actionReceive", icon: QrCode, primary: false },
    { to: "/app/pay", labelKey: "dashboard.actionPay", icon: CreditCard, primary: false },
    { to: "/app/chat", labelKey: "dashboard.actionChat", icon: MessageSquare, primary: false },
    {
      to: "/app/ledger/payments",
      labelKey: "dashboard.actionLedger",
      icon: ArrowUpRight,
      primary: false,
    },
  ];

/**
 * Wallet home: balance overview, shortcuts, and spending chart.
 */
export function DashboardPage() {
  const { t } = useI18n();
  const { address, usdc, balances, isLoading } = useWalletBalances();
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

  const agentsLabel = !owner || myAgents.isLoading
    ? t("dashboard.agentsLoading")
    : agentCount === 0
      ? t("dashboard.agentsNone")
      : t("dashboard.agentsActive", { active: activeCount, total: agentCount });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 animate-in">
      <section className="space-y-2 fade-up">
        {isLoading ? (
          <Skeleton className="h-12 w-56" />
        ) : (
          <h1 className="balance-tick text-4xl font-semibold tracking-tight">
            {usdc.toFixed(2)} <span className="text-lg font-medium">USDC</span>
          </h1>
        )}
        <p className="text-md text-muted-foreground">
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
            <Button
              key={action.to}
              asChild
              variant={action.primary ? "default" : "outline"}
              className={cnDelay(index)}
            >
              <Link to={action.to} className="hover-lift">
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                {t(action.labelKey)}
              </Link>
            </Button>
          );
        })}
      </section>

      <SpendingChart />

      <section className="space-y-3 fade-up delay-3">
        <h2 className="text-sm font-medium">{t("dashboard.assets")}</h2>
        <div className="divide-y divide-border rounded-md border border-border bg-white">
          {(balances.length
            ? [...balances].sort((a, b) =>
              a.symbol === "USDC" ? -1 : b.symbol === "USDC" ? 1 : 0,
            )
            : [
              { symbol: "USDC", name: "USD Coin", displayValue: "0" },
              { symbol: "ETH", name: "Ether", displayValue: "0" },
            ]
          ).map((asset) => (
            <div
              key={asset.symbol}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{asset.symbol}</p>
                <p className="text-xs text-muted-foreground">{asset.name}</p>
              </div>
              <p className="font-mono">
                {isLoading
                  ? "…"
                  : Number(asset.displayValue).toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}
              </p>
            </div>
          ))}
        </div>
      </section>
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
  return "fade-up delay-3";
}
