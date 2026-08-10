import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  MessageSquare,
  QrCode,
} from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { useA2AStore } from "@/stores/a2a";
import { appChainLabel } from "@/web3";

/** Wallet-first shortcuts; AI chat sits just before ledger. */
const actions = [
  { to: "/app/send", label: "转账", icon: ArrowLeftRight, primary: true },
  { to: "/app/receive", label: "收款", icon: QrCode, primary: false },
  { to: "/app/pay", label: "充值", icon: CreditCard, primary: false },
  { to: "/app/chat", label: "对话", icon: MessageSquare, primary: false },
  { to: "/app/ledger/payments", label: "明细", icon: ArrowUpRight, primary: false },
] as const;

/**
 * 钱包首页：链上余额总览与快捷入口。
 */
export function DashboardPage() {
  const account = useActiveAccount();
  const { usdc, eth, balances, isLoading } = useWalletBalances();
  const a2aBalance = useA2AStore((s) => s.a2aBalance);
  const agents = useA2AStore((s) => s.agents);
  const enabledAgents = agents.filter((agent) => agent.enabled).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 animate-in">
      <section className="space-y-2 fade-up">
        <p className="text-sm text-muted-foreground">
          钱包可用 · {appChainLabel}
        </p>
        {isLoading ? (
          <Skeleton className="h-12 w-56" />
        ) : (
          <h1 className="balance-tick text-4xl font-semibold tracking-tight">
            {eth.toFixed(6)} <span className="text-lg font-medium">ETH</span>
          </h1>
        )}
        <p className="text-sm text-muted-foreground">
          USDC {isLoading ? "…" : usdc.toFixed(2)} · A2A 可支付 {a2aBalance.toFixed(4)} ETH · 已启用{" "}
          {enabledAgents}/{agents.length} 个 Agent
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
                {action.label}
              </Link>
            </Button>
          );
        })}
      </section>

      <section className="space-y-3 fade-up delay-2">
        <h2 className="text-sm font-medium">资产</h2>
        <div className="divide-y divide-[var(--color-border)] rounded-md border border-border bg-white">
          {(balances.length
            ? [...balances].sort((a, b) => (a.symbol === "ETH" ? -1 : b.symbol === "ETH" ? 1 : 0))
            : [
              { symbol: "ETH", name: "Ether", displayValue: "0" },
              { symbol: "USDC", name: "USD Coin", displayValue: "0" },
            ]
          ).map((asset) => (
            <div key={asset.symbol} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{asset.symbol}</p>
                <p className="text-xs text-muted-foreground">{asset.name}</p>
              </div>
              <p className="font-mono">
                {isLoading ? "…" : Number(asset.displayValue).toLocaleString(undefined, { maximumFractionDigits: 6 })}
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
