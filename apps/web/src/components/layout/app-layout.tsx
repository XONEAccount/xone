import { NavLink, Outlet } from "react-router-dom";
import {
  ArrowLeftRight,
  ArrowUpRight,
  Home,
  PanelLeft,
  PanelLeftClose,
  QrCode,
  Wallet,
  WalletCards,
} from "lucide-react";
import { AccountMenu } from "@/components/auth/account-menu";
import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/use-i18n";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import type { MessageKey } from "@/lib/i18n/messages";
import { useA2AStore } from "@/stores/a2a";
import { useUiStore } from "@/stores/ui";
import { cn } from "@/lib/utils";
import { appChainLabel } from "@/web3";

/** Fixed content inset from sidebar edge on desktop (via main/header padding). */
const CONTENT_INSET_X = "md:px-8";

const mobileNavItems: {
  to: string;
  labelKey: MessageKey;
  end?: boolean;
  icon: typeof Home;
}[] = [
    { to: "/app", labelKey: "nav.home", end: true, icon: Home },
    { to: "/app/send", labelKey: "nav.send", icon: ArrowLeftRight },
    { to: "/app/receive", labelKey: "nav.receive", icon: QrCode },
    { to: "/app/ledger/payments", labelKey: "nav.mobileLedger", icon: ArrowUpRight },
  ];

/**
 * App shell: desktop sidebar, balance header, account menu, mobile bottom nav.
 */
export function AppLayout() {
  const { usdc } = useWalletBalances();
  const a2aBalance = useA2AStore((s) => s.a2aBalance);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const { t } = useI18n();

  return (
    <div className="min-h-screen text-[var(--color-foreground)]">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "hidden shrink-0 border-r border-border bg-white/70 backdrop-blur-sm transition-[width,padding,opacity] duration-300 ease-out md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto",
            sidebarOpen ? "w-60 p-6 opacity-100" : "w-0 overflow-hidden border-r-0 p-0 opacity-0",
          )}
          aria-hidden={!sidebarOpen}
        >
          <div
            className={cn(
              "w-48 transition-opacity duration-200",
              sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <div className="mb-6 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted">
                <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{t("brand.name")}</p>
              </div>
            </div>
            <AppSidebarNav enabled={sidebarOpen} />
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
                aria-label={
                  sidebarOpen
                    ? t("layout.collapseSidebar")
                    : t("layout.expandSidebar")
                }
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
                  <p className="text-sm font-medium">{t("brand.name")}</p>
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
                  {t("layout.wallet")}
                </p>
                <p className="mt-1 font-mono text-xs font-medium">{usdc.toFixed(2)} USDC</p>
              </div>
              <div className="balance-tick rounded-md border border-border bg-muted px-2.5 py-1.5 text-right">
                <p className="flex items-center justify-end gap-1 text-[10px] leading-none text-muted-foreground">
                  <WalletCards className="h-3 w-3" aria-hidden />
                  {t("layout.a2aSpendable")}
                </p>
                <p className="mt-1 font-mono text-xs font-medium">{a2aBalance.toFixed(2)} USDC</p>
              </div>
              <AccountMenu />
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
                <span>{t(item.labelKey)}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
