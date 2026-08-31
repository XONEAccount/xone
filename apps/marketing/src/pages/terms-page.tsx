import { DocumentMeta } from "@/components/document-meta";
import { Reveal } from "@/components/reveal";
import { links } from "@/lib/links";

/**
 * Short terms of use for the beta product.
 */
export function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <DocumentMeta
        title="X-ONE Terms"
        description="Terms of use for the X-ONE wallet, console, and developer APIs during beta."
      />

      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Terms
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Terms of use
        </h1>
        <p className="mt-4 text-muted-foreground">Last updated 31 August 2026.</p>
        <p className="mt-4 text-muted-foreground">
          X-ONE is in beta. Software may change, break, or be unavailable. This
          is not financial, legal, or investment advice.
        </p>
      </Reveal>

      <div className="mt-10 space-y-8 text-muted-foreground">
        <section>
          <h2 className="text-lg font-medium text-foreground">The product</h2>
          <p className="mt-2">
            We provide a web wallet, operator console, and developer APIs (HTTP,
            SDK, MCP) for policy-gated payments. Access during beta is free and
            may be rate-limited or withdrawn.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-medium text-foreground">Networks</h2>
          <p className="mt-2">
            Beta currently settles on Base Sepolia with USDC. Testnet assets are
            not real money. Do not send mainnet funds to a testnet address. Check
            Docs for the live network list before you transfer.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-medium text-foreground">Your responsibility</h2>
          <p className="mt-2">
            You are responsible for API keys, agent limits, and confirming
            payments when policy requires it. Keep spend keys out of prompts,
            logs, and public repos. We are not liable for losses from keys you
            leak, policy you set too wide, or chain conditions outside our
            control.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-medium text-foreground">Acceptable use</h2>
          <p className="mt-2">
            Do not use X-ONE to evade sanctions, commit fraud, or harm others.
            We may pause accounts that abuse the service.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-medium text-foreground">Contact</h2>
          <p className="mt-2">
            Issues:{" "}
            <a
              href={links.github}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              GitHub
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
