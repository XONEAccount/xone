import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { DocumentMeta } from "@/components/document-meta";
import { Reveal } from "@/components/reveal";
import { MarketingButton as Button } from "@/components/ui/marketing-button";
import { links } from "@/lib/links";

const steps = [
  {
    title: "Top up testnet USDC",
    body: "Copy your receive address, use a Base Sepolia faucet, then wait for the balance to appear.",
  },
  {
    title: "Confirm the signature",
    body: "When the wallet asks you to sign, review amount and payee, then confirm. The model never sees the key.",
  },
  {
    title: "Try Chat",
    body: "Ask for balances, wallets, or a payment. Financial actions show as cards — confirm when policy requires it.",
  },
] as const;

/**
 * One-minute product walkthrough for wallet users.
 */
export function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <DocumentMeta
        title="X-ONE Getting started — 1-minute wallet tour"
        description="Silent walkthrough: top up testnet USDC on Base Sepolia, confirm a signature, then try Chat."
      />

      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Getting started
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          A one-minute tour of the wallet.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Silent screen recording. Top up, sign, then Chat — the same path you
          take after you open the web wallet.
        </p>
      </Reveal>

      <Reveal delay={80} className="mt-10">
        <video
          className="w-full rounded-lg border border-border bg-card"
          controls
          playsInline
          poster="/guide/poster.jpg"
          preload="metadata"
        >
          <source src="/guide/getting-started.mp4" type="video/mp4" />
        </video>
        <p className="mt-3 text-xs text-muted-foreground">
          Beta on Base Sepolia. Do not send mainnet funds to a testnet address.
        </p>
      </Reveal>

      <ol className="mt-14 space-y-6">
        {steps.map((step, i) => (
          <Reveal key={step.title} delay={i * 50} variant="left">
            <li className="border-t border-border pt-5">
              <p className="font-mono text-xs text-muted-foreground">
                0{i + 1}
              </p>
              <h2 className="mt-1 text-xl font-medium">{step.title}</h2>
              <p className="mt-2 text-muted-foreground">{step.body}</p>
            </li>
          </Reveal>
        ))}
      </ol>

      <Reveal className="mt-12 flex flex-wrap gap-3">
        <Button asChild>
          <a href={links.wallet} target="_blank" rel="noreferrer">
            Open wallet
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </a>
        </Button>
        <Button asChild variant="outline">
          <Link to="/developers">Developers</Link>
        </Button>
      </Reveal>
    </div>
  );
}
