import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  KeyRound,
  PanelLeft,
  PanelLeftClose,
  Receipt,
  User,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/api-keys", label: "API Keys", icon: KeyRound },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/ledger", label: "Ledger", icon: Receipt },
  { to: "/account", label: "Account", icon: User },
];

/**
 * Console shell: sidebar + top bar matching the wallet web app.
 */
export function AppLayout() {
  const { user } = useAuth();
  const { apiKeys, agents, refresh, remote, loading } = useAccount();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (remote) void refresh();
  }, [remote, refresh]);

  return (
    <div className="min-h-screen text-[var(--color-foreground)]">
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
            <div className="mb-6 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted">
                <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">XOne Console</p>
              </div>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    tabIndex={sidebarOpen ? 0 : -1}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-200",
                        isActive
                          ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
                          : "text-muted-foreground hover:bg-muted hover:text-[var(--color-foreground)]",
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
          <header className="flex items-center justify-between gap-3 border-b border-border bg-white/70 px-4 py-4 backdrop-blur-sm md:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden h-9 w-9 shrink-0 md:inline-flex"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
                )}
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium md:hidden">XOne Console</p>
                <p className="text-xs text-muted-foreground">
                  {remote ? "Live" : "Local mock"}
                  {loading ? " · refreshing…" : ""}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <div className="rounded-md border border-border px-2.5 py-1.5 text-right">
                <p className="text-[10px] leading-none text-muted-foreground">Keys</p>
                <p className="mt-1 font-mono text-xs font-medium">{apiKeys.length}</p>
              </div>
              <div className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-right">
                <p className="text-[10px] leading-none text-muted-foreground">Wallets</p>
                <p className="mt-1 font-mono text-xs font-medium">{agents.length}</p>
              </div>
              <div className="hidden rounded-md border border-border px-2.5 py-1.5 text-right sm:block">
                <p className="text-[10px] leading-none text-muted-foreground">Signed in</p>
                <p className="mt-1 max-w-[160px] truncate font-mono text-xs font-medium">
                  {user?.email}
                </p>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8">
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white/95 backdrop-blur-sm md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
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
