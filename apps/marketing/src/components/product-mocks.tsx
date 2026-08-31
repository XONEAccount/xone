import {
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  MessageSquare,
  QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Window chrome used by product mocks.
 */
function MockChrome({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
      <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
      <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
      <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
      <span className="ml-2 font-mono text-[11px] text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

const heroActions = [
  { label: "Send", Icon: ArrowLeftRight },
  { label: "Receive", Icon: QrCode },
  { label: "Pay", Icon: CreditCard },
  { label: "Chat", Icon: MessageSquare },
  { label: "Ledger", Icon: ArrowUpRight },
] as const;

/**
 * Decorative wallet dashboard for the marketing hero.
 * @param props.className - Optional layout classes
 */
export function WalletHeroMock({ className }: { className?: string }) {
  return (
    <div className={cn("relative pb-16 sm:pb-12", className)} aria-hidden>
      <div className="mock-panel overflow-hidden rounded-xl border border-border bg-card shadow-[0_28px_80px_rgba(17,17,17,0.08)]">
        <MockChrome title="Wallet" />
        <div className="p-5 sm:p-6">
          <p className="text-xs font-medium text-muted-foreground">
            Available on Base
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            1,240.00{" "}
            <span className="text-base font-medium text-muted-foreground">
              USDC
            </span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            A2A 80.00 · 2 agents active
          </p>
          <div className="mt-5 grid grid-cols-5 gap-2">
            {heroActions.map(({ label, Icon }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-1 py-2.5"
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="text-[10px] font-medium">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2.5 border-t border-border pt-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Recent
            </p>
            <div className="flex items-center justify-between text-sm">
              <span>Hotel agent</span>
              <span className="font-mono text-xs">−48.00</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Received</span>
              <span className="font-mono text-xs">+200.00</span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute right-3 bottom-0 w-[min(100%,17rem)] sm:right-0">
        <ConfirmCardMock />
      </div>
    </div>
  );
}

/**
 * Decorative A2A confirmation card.
 * @param props.className - Optional layout classes
 */
export function ConfirmCardMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-[0_16px_48px_rgba(17,17,17,0.12)]",
        className,
      )}
      aria-hidden
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Confirm payment
      </p>
      <p className="mt-2 text-sm font-medium">Hotel agent · tonight</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">
        48.00{" "}
        <span className="text-sm font-medium text-muted-foreground">USDC</span>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Policy: above auto-pay · your confirmation required
      </p>
      <div className="mt-3 flex gap-2">
        <span className="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-primary text-xs font-medium text-primary-foreground">
          Confirm
        </span>
        <span className="inline-flex h-8 flex-1 items-center justify-center rounded-md border border-border text-xs font-medium">
          Decline
        </span>
      </div>
    </div>
  );
}

/**
 * Decorative assistant thread with a structured pay card.
 * @param props.className - Optional layout classes
 */
export function AssistantMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mock-panel overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
      aria-hidden
    >
      <MockChrome title="Assistant" />
      <div className="space-y-3 p-4">
        <p className="ml-8 rounded-lg bg-muted px-3 py-2 text-xs">
          Book a hotel tonight under 50 USDC.
        </p>
        <div className="mr-4 rounded-lg border border-border p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Payment request
          </p>
          <p className="mt-1 text-sm font-medium">Harbor Inn · 48.00 USDC</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Confirm to pay. Keys stay out of the prompt.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Decorative console policy snapshot for builders.
 * @param props.className - Optional layout classes
 */
export function ConsolePolicyMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mock-panel overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
      aria-hidden
    >
      <MockChrome title="Console · travel-bot" />
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">travel-bot</p>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px]">
            Active
          </span>
        </div>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          0x7a…c4e2 · Base Sepolia
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Daily remaining</dt>
            <dd className="mt-0.5 font-medium">6.40 / 10 USDC</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Per transaction</dt>
            <dd className="mt-0.5 font-medium">1.00 USDC</dd>
          </div>
        </dl>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[64%] bg-foreground" />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Pause, limits, and delete stay on operator JWT — never the spend key.
        </p>
      </div>
    </div>
  );
}
