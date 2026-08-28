import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Banknote,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  ListTree,
  LogOut,
  Receipt,
  ScrollText,
  Search,
  Shield,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/hooks/use-auth";

const navItems: Array<{
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}> = [
    { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/search", label: "Search", icon: Search },
    { to: "/profiles", label: "Wallet users", icon: Users },
    { to: "/legacy-agents", label: "Legacy agents", icon: Shield },
    { to: "/xone/wallets", label: "XOne wallets", icon: Wallet },
    { to: "/xone/keys", label: "API keys", icon: KeyRound },
    { to: "/xone/tenants", label: "Console users", icon: Users },
    { to: "/payments", label: "Payments", icon: Receipt },
    { to: "/fundings", label: "Fundings", icon: Banknote },
    { to: "/service-catalog", label: "Service catalog", icon: ListTree },
    { to: "/xone/ledger", label: "XOne ledger", icon: ScrollText },
    { to: "/audit", label: "Audit", icon: ClipboardList },
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
 * Ops shell using shadcn Sidebar.
 * @see https://ui.shadcn.com/docs/components/sidebar
 */
export function AppLayout() {
  const { admin, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent">
              <Shield className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold tracking-tight">XOne Admin</p>
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
              <p className="truncate text-sm font-medium md:hidden">XOne Admin</p>
              <p className="text-xs text-muted-foreground">Ops control plane</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 rounded-md border border-border px-2.5 py-1.5 sm:flex">
              <Wallet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
              <p className="max-w-35 truncate font-mono text-xs font-medium">
                {admin?.sub ? `${admin.sub.slice(0, 6)}…${admin.sub.slice(-4)}` : "—"}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              Sign out
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-6 md:pb-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
