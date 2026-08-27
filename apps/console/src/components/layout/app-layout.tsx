import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { KeyRound, Receipt, User, Wallet, type LucideIcon } from "lucide-react";
import { useAccount } from "@/hooks/use-account";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navItems: Array<{
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}> = [
  { to: "/api-keys", label: "API Keys", icon: KeyRound },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/ledger", label: "Ledger", icon: Receipt, end: true },
  { to: "/account", label: "Account", icon: User, end: true },
];

/**
 * Whether a nav target matches the current path.
 * @param pathname - Current location
 * @param to - Nav target
 * @param end - Exact match only
 */
function isActivePath(pathname: string, to: string, end?: boolean): boolean {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * Console shell using shadcn Sidebar.
 * @see https://ui.shadcn.com/docs/components/sidebar
 */
export function AppLayout() {
  const { user } = useAuth();
  const { apiKeys, agents, refresh, remote, loading } = useAccount();
  const { pathname } = useLocation();

  useEffect(() => {
    if (remote) void refresh();
  }, [remote, refresh]);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent">
              <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold tracking-tight">XOne Console</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.to, item.end);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <NavLink to={item.to} end={item.end}>
                          <Icon strokeWidth={1.75} aria-hidden />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center justify-between gap-3 border-b border-border px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="-ml-1" />
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

        <main className="flex-1 px-4 py-6 md:px-6 md:pb-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
