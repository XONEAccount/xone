import { NavLink, Outlet } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bot,
  Code2,
  CreditCard,
  Home,
  List,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  QrCode,
  Settings,
  Store,
  Wallet,
  WalletCards,
} from "lucide-react";
import { ConnectButton } from "thirdweb/react";
import { APP_NAME } from "@wallet/config";
import { Button } from "@/components/ui/button";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { useA2AStore } from "@/stores/a2a";
import { useUiStore } from "@/stores/ui";
import { cn } from "@/lib/utils";
import {
  appChain,
  appChainLabel,
  appWallets,
  connectTheme,
  thirdwebClient,
} from "@/web3";

/** Fixed content inset from sidebar edge on desktop (via main/header padding). */
const CONTENT_INSET_X = "md:px-8";

/** Wallet core first, then ledger, then AI / A2A, then settings. */
const navItems = [
  { to: "/app", label: "首页", end: true, icon: Home },
  { to: "/app/send", label: "转账", icon: ArrowLeftRight },
  { to: "/app/receive", label: "收款", icon: QrCode },
  { to: "/app/developers", label: "创建 Agent", end: true, icon: Code2 },
  { to: "/app/developers/agents", label: "我的 Agents", icon: Bot },
  { to: "/app/merchants", label: "Agent list", icon: Store },
  { to: "/app/ledger/a2a", label: "A2A 明细", icon: List },
  { to: "/app/pay", label: "充值", icon: CreditCard },
  { to: "/app/ledger/payments", label: "转账明细", icon: ArrowUpRight },
  { to: "/app/ledger/receive", label: "收款明细", icon: ArrowDownLeft },
  { to: "/app/chat", label: "对话", icon: MessageSquare },

  { to: "/app/settings", label: "设置", icon: Settings },
];

const mobileNavItems = [
  { to: "/app", label: "首页", end: true, icon: Home },
  { to: "/app/send", label: "转账", icon: ArrowLeftRight },
  { to: "/app/receive", label: "收款", icon: QrCode },
  { to: "/app/ledger/payments", label: "明细", icon: ArrowUpRight },
];

/**
 * 应用壳层：桌面侧边栏、顶栏余额、thirdweb 账户菜单、移动端底部导航。
 */
export function AppLayout() {
  const { eth } = useWalletBalances();
  const a2aBalance = useA2AStore((s) => s.a2aBalance);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <div className="min-h-screen text-(--color-foreground)">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "hidden shrink-0 overflow-hidden border-r border-border bg-white/70 backdrop-blur-sm transition-[width,padding,opacity] duration-300 ease-out md:block",
            sidebarOpen ? "w-56 p-6 opacity-100" : "w-0 border-r-0 p-0 opacity-0",
          )}
          aria-hidden={!sidebarOpen}
        >
          <div
            className={cn(
              "w-44 transition-opacity duration-200",
              sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <div className="mb-10 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted">
                <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{APP_NAME}</p>
                <p className="text-xs text-muted-foreground">Web3 · A2A</p>
              </div>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    tabIndex={sidebarOpen ? 0 : -1}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-200",
                        isActive
                          ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
                          : "text-muted-foreground hover:bg-muted hover:text-(--color-foreground)",
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={cn(
              "flex items-center justify-between gap-3 border-b border-border bg-white/70 px-4 py-4 backdrop-blur-sm",
              CONTENT_INSET_X,
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden h-9 w-9 shrink-0 md:inline-flex"
                onClick={toggleSidebar}
                aria-label={sidebarOpen ? "折叠侧边栏" : "展开侧边栏"}
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                ) : (
                  <PanelLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                )}
              </Button>

              <div className="min-w-0 md:hidden">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  <p className="text-sm font-medium">{APP_NAME}</p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {appChainLabel}
                </p>
              </div>
              <p className="hidden text-xs text-muted-foreground md:block">
                {appChainLabel}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <div className="balance-tick rounded-md border border-border px-2.5 py-1.5 text-right">
                <p className="flex items-center justify-end gap-1 text-[10px] leading-none text-muted-foreground">
                  <Wallet className="h-3 w-3" aria-hidden />
                  钱包
                </p>
                <p className="mt-1 font-mono text-xs font-medium">{eth.toFixed(4)} ETH</p>
              </div>
              <div className="balance-tick rounded-md border border-border bg-muted px-2.5 py-1.5 text-right">
                <p className="flex items-center justify-end gap-1 text-[10px] leading-none text-muted-foreground">
                  <WalletCards className="h-3 w-3" aria-hidden />
                  A2A 可支付
                </p>
                <p className="mt-1 font-mono text-xs font-medium">{a2aBalance.toFixed(4)} ETH</p>
              </div>
              <ConnectButton
                client={thirdwebClient}
                chain={appChain}
                chains={[appChain]}
                wallets={appWallets}
                theme={connectTheme}
                connectButton={{ label: "连接" }}
                switchButton={{ label: "切换到 Sepolia" }}
              />
            </div>
          </header>

          <main className={cn("flex-1 px-4 py-6 pb-24 md:pb-8", CONTENT_INSET_X)}>
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white/95 backdrop-blur-sm md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 rounded-md px-2 py-2 text-center text-[11px] transition-colors",
                    isActive
                      ? "bg-muted font-medium"
                      : "text-muted-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
