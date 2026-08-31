import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { MarketingButton as Button } from "@/components/ui/marketing-button";

const footerLinks = [
  { href: links.wallet, label: "Wallet", external: true },
  { href: "/guide", label: "Getting started" },
  { href: "/developers", label: "Developers" },
  { href: "/security", label: "Security" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#waitlist", label: "App waitlist" },
  { href: links.docs, label: "Docs", external: true },
  { href: links.docsApi, label: "API", external: true },
  { href: links.docsMcp, label: "MCP", external: true },
  { href: links.github, label: "GitHub", external: true },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

/**
 * Shared marketing chrome: top nav + footer.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-[var(--color-foreground)]">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-[var(--color-background)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="text-2xl tracking-tight font-semibold">
            X-ONE
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-muted font-medium"
                    : "text-muted-foreground hover:text-[var(--color-foreground)]",
                )
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/guide"
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-muted font-medium"
                    : "text-muted-foreground hover:text-[var(--color-foreground)]",
                )
              }
            >
              Guide
            </NavLink>
            <NavLink
              to="/developers"
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-muted font-medium"
                    : "text-muted-foreground hover:text-[var(--color-foreground)]",
                )
              }
            >
              Developers
            </NavLink>
            <NavLink
              to="/security"
              className={({ isActive }) =>
                cn(
                  "hidden rounded-md px-3 py-1.5 text-sm transition-colors sm:inline",
                  isActive
                    ? "bg-muted font-medium"
                    : "text-muted-foreground hover:text-[var(--color-foreground)]",
                )
              }
            >
              Security
            </NavLink>
            <a
              href="/#pricing"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-[var(--color-foreground)]"
            >
              Pricing
            </a>
            <a
              href="/#faq"
              className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-[var(--color-foreground)] md:inline"
            >
              FAQ
            </a>
            <Button asChild size="sm" className="ml-1 hidden sm:inline-flex">
              <a href={links.wallet} target="_blank" rel="noreferrer">
                Open wallet
              </a>
            </Button>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-xl font-semibold">X-ONE</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {footerLinks.map((item) =>
                "external" in item && item.external ? (
                  <a
                    key={item.label}
                    href={item.href}
                    className="hover:text-[var(--color-foreground)]"
                    {...(item.href.startsWith("http")
                      ? { target: "_blank", rel: "noreferrer" }
                      : {})}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="hover:text-[var(--color-foreground)]"
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Web3 wallet · A2A payments · beta
          </p>
        </div>
      </footer>
    </div>
  );
}
