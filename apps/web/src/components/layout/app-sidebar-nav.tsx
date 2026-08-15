import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  ChevronRight,
  ClipboardList,
  Home,
  List,
  MessageSquare,
  Settings,
  Wallet,
  Zap,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

type NavLinkItem = {
  to: string;
  label: string;
  end?: boolean;
};

type NavGroupEntry = {
  kind: "group";
  id: string;
  label: string;
  icon: LucideIcon;
  children: NavLinkItem[];
};

type NavEntry =
  | { kind: "link"; to: string; label: string; end?: boolean; icon: LucideIcon }
  | NavGroupEntry;

const navEntries: NavEntry[] = [
  { kind: "link", to: "/app", label: "首页", end: true, icon: Home },
  {
    kind: "group",
    id: "wallet",
    label: "钱包",
    icon: Wallet,
    children: [
      { to: "/app/assets", label: "资产" },
      { to: "/app/pay", label: "充值" },
      { to: "/app/send", label: "转账" },
      { to: "/app/receive", label: "收款" },
    ],
  },
  { kind: "link", to: "/app/agents", label: "X402 List", icon: List },
  {
    kind: "group",
    id: "agents",
    label: "Agents",
    icon: Bot,
    children: [
      { to: "/app/developers/agents", label: "我的 Agents" },
      { to: "/app/developers", label: "创建 Agent", end: true },
    ],
  },
  {
    kind: "group",
    id: "a2a",
    label: "A2A",
    icon: Zap,
    children: [
      { to: "/app/a2a/fund", label: "A2A 转入" },
      { to: "/app/merchants", label: "A2A 支付" },
      { to: "/app/ledger/a2a", label: "A2A 明细" },
    ],
  },
  { kind: "link", to: "/app/chat", label: "对话", icon: MessageSquare },
  {
    kind: "group",
    id: "ledger",
    label: "交易",
    icon: ClipboardList,
    children: [
      { to: "/app/ledger/payments", label: "转账" },
      { to: "/app/ledger/receive", label: "收款" },
      { to: "/app/ledger/pay", label: "支付" },
    ],
  },
  { kind: "link", to: "/app/settings", label: "设置", icon: Settings },
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
 * Group label that contains the current route, if any.
 * @param pathname - Current location
 */
function findActiveGroup(pathname: string): string | null {
  for (const entry of navEntries) {
    if (entry.kind !== "group") continue;
    if (entry.children.some((child) => isPathActive(pathname, child.to, child.end))) {
      return entry.label;
    }
  }
  return null;
}

const itemClass = (isActive: boolean) =>
  cn(
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-200",
    isActive
      ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
      : "text-muted-foreground hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
  );

type AppSidebarNavProps = {
  /** When false, links are removed from the tab order (sidebar collapsed). */
  enabled: boolean;
};

/**
 * Grouped desktop sidebar navigation with click-to-expand sections.
 * @param enabled - Whether nav links are keyboard-accessible
 */
export function AppSidebarNav({ enabled }: AppSidebarNavProps) {
  const { pathname } = useLocation();
  const tabIndex = enabled ? 0 : -1;
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = findActiveGroup(pathname);
    return new Set(active ? [active] : []);
  });

  useEffect(() => {
    const active = findActiveGroup(pathname);
    if (!active) return;
    setOpenGroups((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev);
      next.add(active);
      return next;
    });
  }, [pathname]);

  /**
   * Toggles a nav group open or closed.
   * @param label - Group label
   */
  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-1" aria-label="主导航">
      {navEntries.map((entry) => {
        if (entry.kind === "link") {
          const Icon = entry.icon;
          return (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.end}
              tabIndex={tabIndex}
              className={({ isActive }) => itemClass(isActive)}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              <span>{entry.label}</span>
            </NavLink>
          );
        }

        return (
          <NavGroup
            key={entry.label}
            entry={entry}
            open={openGroups.has(entry.label)}
            pathname={pathname}
            tabIndex={tabIndex}
            onToggle={() => toggleGroup(entry.label)}
          />
        );
      })}
    </nav>
  );
}

type NavGroupProps = {
  entry: NavGroupEntry;
  open: boolean;
  pathname: string;
  tabIndex: number;
  onToggle: () => void;
};

/**
 * Expandable sidebar section with a toggle button and nested links.
 * @param entry - Group definition
 * @param open - Whether children are visible
 * @param pathname - Current location (for active styling)
 * @param tabIndex - Tab index inherited from sidebar open state
 * @param onToggle - Click handler for the group header
 */
function NavGroup({ entry, open, pathname, tabIndex, onToggle }: NavGroupProps) {
  const Icon = entry.icon;
  const groupActive = entry.children.some((child) =>
    isPathActive(pathname, child.to, child.end),
  );

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`nav-group-${entry.id}`}
        tabIndex={tabIndex}
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-200",
          groupActive
            ? "font-medium text-foreground"
            : "text-muted-foreground hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="flex-1 text-left">{entry.label}</span>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
            open && "rotate-90",
          )}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>
      <div
        id={`nav-group-${entry.id}`}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <ul className="overflow-hidden">
          {entry.children.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                end={child.end}
                tabIndex={open ? tabIndex : -1}
                className={({ isActive }) =>
                  cn(
                    "mt-0.5 flex items-center rounded-md py-2 pl-9 pr-3 text-sm transition-all duration-200",
                    isActive
                      ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
                      : "text-muted-foreground hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
                  )
                }
              >
                {child.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
