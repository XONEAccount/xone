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
import { useI18n } from "@/hooks/use-i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

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
    icon: List,
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

const itemClass = (isActive: boolean) =>
  cn(
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-200",
    isActive
      ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
      : "text-muted-foreground hover:bg-muted hover:text-[var(--color-foreground)]",
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
  const { t } = useI18n();
  const tabIndex = enabled ? 0 : -1;
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

  /**
   * Toggles a nav group open or closed.
   * @param id - Group id
   */
  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-1" aria-label={t("nav.main")}>
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
              <span>{t(entry.labelKey)}</span>
            </NavLink>
          );
        }

        return (
          <NavGroup
            key={entry.id}
            entry={entry}
            label={t(entry.labelKey)}
            open={openGroups.has(entry.id)}
            pathname={pathname}
            tabIndex={tabIndex}
            onToggle={() => toggleGroup(entry.id)}
            t={t}
          />
        );
      })}
    </nav>
  );
}

type NavGroupProps = {
  entry: NavGroupEntry;
  label: string;
  open: boolean;
  pathname: string;
  tabIndex: number;
  onToggle: () => void;
  t: (key: MessageKey) => string;
};

/**
 * Expandable sidebar section with a toggle button and nested links.
 */
function NavGroup({
  entry,
  label,
  open,
  pathname,
  tabIndex,
  onToggle,
  t,
}: NavGroupProps) {
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
            : "text-muted-foreground hover:bg-muted hover:text-(--color-foreground)",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="flex-1 text-left">{label}</span>
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
                      : "text-muted-foreground hover:bg-muted hover:text-[var(--color-foreground)]",
                  )
                }
              >
                {t(child.labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
