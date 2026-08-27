import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { MarketingButton as Button } from "@/components/ui/marketing-button";

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
            <a
              href="/#pricing"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-[var(--color-foreground)]"
            >
              Pricing
            </a>
            <a
              href="/#faq"
              className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-[var(--color-foreground)] sm:inline"
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
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xl">X-ONE</p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <a href={links.wallet} className="hover:text-[var(--color-foreground)]">
              Wallet
            </a>
            <Link to="/developers" className="hover:text-[var(--color-foreground)]">
              Developers
            </Link>
            <a href="/#pricing" className="hover:text-[var(--color-foreground)]">
              Pricing
            </a>
            <a href="/#faq" className="hover:text-[var(--color-foreground)]">
              FAQ
            </a>
            <a href="/#waitlist" className="hover:text-[var(--color-foreground)]">
              App waitlist
            </a>
            <a href={links.docs} className="hover:text-[var(--color-foreground)]">
              Docs
            </a>
            <a
              href={links.docsApi}
              className="hover:text-[var(--color-foreground)]"
            >
              API
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Web3 wallet · A2A payments
          </p>
        </div>
      </footer>
    </div>
  );
}
