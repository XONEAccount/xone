import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  ChevronRight,
  ClipboardList,
  Home,
  LayoutList,
  MessageSquare,
  Settings,
  Wallet,
  Zap,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useI18n } from "@/hooks/use-i18n";
import type { MessageKey } from "@/lib/i18n/messages";

type NavLinkItem = {
  to: string;
  labelKey: MessageKey;
  end?: boolean;
};

type NavGroupEntry = {
  kind: "group";
  id: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  children: NavLinkItem[];
};

type NavEntry =
  | {
      kind: "link";
      to: string;
      labelKey: MessageKey;
      end?: boolean;
      icon: LucideIcon;
    }
  | NavGroupEntry;

const navEntries: NavEntry[] = [
  { kind: "link", to: "/app", labelKey: "nav.home", end: true, icon: Home },
  {
    kind: "group",
    id: "wallet",
    labelKey: "nav.wallet",
    icon: Wallet,
    children: [
      { to: "/app/assets", labelKey: "nav.assets" },
      { to: "/app/pay", labelKey: "nav.pay" },
      { to: "/app/send", labelKey: "nav.send" },
      { to: "/app/receive", labelKey: "nav.receive" },
    ],
  },
  {
    kind: "group",
    id: "lists",
    labelKey: "nav.serviceList",
    icon: LayoutList,
    children: [
      { to: "/app/agents/x402", labelKey: "nav.x402List" },
      { to: "/app/agents/list", labelKey: "nav.agentList" },
    ],
  },
  {
    kind: "group",
    id: "developer-wallet",
    labelKey: "nav.developerWallet",
    icon: Bot,
    children: [
      { to: "/app/developers/wallet", labelKey: "nav.myWallet" },
      { to: "/app/developers", labelKey: "nav.createWallet", end: true },
    ],
  },
  {
    kind: "group",
    id: "a2a",
    labelKey: "nav.a2a",
    icon: Zap,
    children: [
      { to: "/app/a2a/fund", labelKey: "nav.a2aFund" },
      { to: "/app/merchants", labelKey: "nav.a2aPay" },
      { to: "/app/ledger/a2a", labelKey: "nav.a2aLedger" },
    ],
  },
  { kind: "link", to: "/app/chat", labelKey: "nav.chat", icon: MessageSquare },
  {
    kind: "group",
    id: "ledger",
    labelKey: "nav.ledger",
    icon: ClipboardList,
    children: [
      { to: "/app/ledger/payments", labelKey: "nav.ledgerTransfer" },
      { to: "/app/ledger/receive", labelKey: "nav.ledgerReceive" },
      { to: "/app/ledger/pay", labelKey: "nav.ledgerPay" },
    ],
  },
  { kind: "link", to: "/app/settings", labelKey: "nav.settings", icon: Settings },
];

/**
 * Whether a destination matches the current pathname.
 * @param pathname - Current location
 * @param to - Nav target
 * @param end - Exact match only
 */
function isPathActive(pathname: string, to: string, end?: boolean): boolean {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * Group id that contains the current route, if any.
 * @param pathname - Current location
 */
function findActiveGroupId(pathname: string): string | null {
  for (const entry of navEntries) {
    if (entry.kind !== "group") continue;
    if (entry.children.some((child) => isPathActive(pathname, child.to, child.end))) {
      return entry.id;
    }
  }
  return null;
}

/**
 * Wallet sidebar nav built on shadcn Sidebar menu primitives.
 */
export function AppSidebarNav() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = findActiveGroupId(pathname);
    return new Set(active ? [active] : []);
  });

  useEffect(() => {
    const active = findActiveGroupId(pathname);
    if (!active) return;
    setOpenGroups((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev);
      next.add(active);
      return next;
    });
  }, [pathname]);

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {navEntries.map((entry) => {
            if (entry.kind === "link") {
              const Icon = entry.icon;
              const active = isPathActive(pathname, entry.to, entry.end);
              return (
                <SidebarMenuItem key={entry.to}>
                  <SidebarMenuButton asChild isActive={active} tooltip={t(entry.labelKey)}>
                    <NavLink to={entry.to} end={entry.end}>
                      <Icon strokeWidth={1.75} aria-hidden />
                      <span>{t(entry.labelKey)}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            const Icon = entry.icon;
            const open = openGroups.has(entry.id);
            const groupActive = entry.children.some((child) =>
              isPathActive(pathname, child.to, child.end),
            );

            return (
              <Collapsible
                key={entry.id}
                open={open}
                onOpenChange={(next) => {
                  setOpenGroups((prev) => {
                    const copy = new Set(prev);
                    if (next) copy.add(entry.id);
                    else copy.delete(entry.id);
                    return copy;
                  });
                }}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={groupActive} tooltip={t(entry.labelKey)}>
                      <Icon strokeWidth={1.75} aria-hidden />
                      <span>{t(entry.labelKey)}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {entry.children.map((child) => {
                        const childActive = isPathActive(pathname, child.to, child.end);
                        return (
                          <SidebarMenuSubItem key={child.to}>
                            <SidebarMenuSubButton asChild isActive={childActive}>
                              <NavLink to={child.to} end={child.end}>
                                <span>{t(child.labelKey)}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
