import { NavLink, Outlet } from "react-router-dom";
import type { CSSProperties } from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  Home,
  QrCode,
  Sparkles,
  Wallet,
  WalletCards,
} from "lucide-react";
import { AccountMenu } from "@/components/auth/account-menu";
import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useI18n } from "@/hooks/use-i18n";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import type { MessageKey } from "@/lib/i18n/messages";
import { useA2AStore } from "@/stores/a2a";
import { useUiStore } from "@/stores/ui";
import { appChainLabel } from "@/web3";

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
 * App shell using shadcn Sidebar + mobile quick actions.
 * @see https://ui.shadcn.com/docs/components/sidebar
 */
export function AppLayout() {
  const { usdc } = useWalletBalances();
  const a2aBalance = useA2AStore((s) => s.a2aBalance);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const { t } = useI18n();

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      style={{ "--sidebar-width": "13rem" } as CSSProperties}
    >
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0">
            <div className="brand-mark flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold tracking-tight">
                {t("brand.name")}
              </p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <AppSidebarNav />
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="h-svh overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-white/80 px-4 backdrop-blur-md md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <div className="min-w-0 md:hidden">
              <div className="flex items-center gap-2">
                <div className="brand-mark flex h-6 w-6 items-center justify-center rounded-md">
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                </div>
                <p className="text-sm font-medium">{t("brand.name")}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{appChainLabel}</p>
            </div>
            <p className="hidden text-xs text-muted-foreground md:block">{appChainLabel}</p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <div className="balance-tick rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 text-right">
              <p className="flex items-center justify-end gap-1 text-[10px] leading-none text-muted-foreground">
                <Wallet className="h-3 w-3" aria-hidden />
                {t("layout.wallet")}
              </p>
              <p className="mt-1 font-mono text-xs font-semibold">
                {usdc.toFixed(2)} USDC
              </p>
            </div>
            <div className="balance-tick rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 text-right">
              <p className="flex items-center justify-end gap-1 text-[10px] leading-none text-muted-foreground">
                <WalletCards className="h-3 w-3" aria-hidden />
                {t("layout.a2aSpendable")}
              </p>
              <p className="mt-1 font-mono text-xs font-semibold">
                {a2aBalance.toFixed(2)} USDC
              </p>
            </div>
            <AccountMenu />
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 pb-24 md:px-6 md:pb-8">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white/90 backdrop-blur-md md:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      "flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-center text-[11px] transition-all duration-200",
                      isActive
                        ? "bg-foreground font-medium text-background shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    ].join(" ")
                  }
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      </SidebarInset>
    </SidebarProvider>
  );
}
