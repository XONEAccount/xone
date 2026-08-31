import { Link } from "react-router-dom";
import { DocumentMeta } from "@/components/document-meta";
import { Reveal } from "@/components/reveal";
import { MarketingButton as Button } from "@/components/ui/marketing-button";
import { links } from "@/lib/links";

const path = [
  {
    title: "Intent",
    body: "A person, assistant, or runtime proposes a payment: amount, asset, payee, and resource.",
  },
  {
    title: "Validation",
    body: "Server checks shape, chain, expiration, and that the agent still exists.",
  },
  {
    title: "Policy",
    body: "Daily cap, per-transaction cap, status (active / paused / exhausted), optional host and payee allowlists.",
  },
  {
    title: "Authorization",
    body: "Wallet users confirm when the rule requires it. Agent runtimes may auto-pay only inside those caps.",
  },
  {
    title: "Execution",
    body: "A sealed key signs. The client and the model never receive private key material.",
  },
  {
    title: "Audit",
    body: "History and ledger record the attempt, idempotency key, and settlement when it exists.",
  },
] as const;

const guarantees = [
  {
    title: "Two tokens, two jobs",
    body: "The spend key (xone_…) can create, read, and pay. Pause, resume, limits, and soft-delete require a Console operator JWT.",
  },
  {
    title: "Idempotent pay",
    body: "Retries must reuse the same Idempotency-Key until the prior attempt is known. Do not mint a new key on a timeout.",
  },
  {
    title: "Snapshot is not a chain balance",
    body: "getSpendSnapshot() (and the MCP balance tool) returns address plus policy headroom. Fund USDC at the address separately.",
  },
  {
    title: "Prompts cannot override policy",
    body: "The assistant can propose a PaymentRequest. It cannot construct an arbitrary transfer or skip confirmation when policy forbids it.",
  },
] as const;

/**
 * Product security model for wallet users and builders.
 */
export function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <DocumentMeta
        title="X-ONE Security — policy-gated agent payments"
        description="How X-ONE keeps keys out of prompts: intent, policy, authorization, execution, and audit. Spend tokens cannot change limits."
      />

      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Security
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Models propose. Policy decides.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          X-ONE is built so an LLM or agent runtime never gets unrestricted
          signing power. Every financially relevant mutation goes through the
          same path.
        </p>
      </Reveal>

      <ol className="mt-12 space-y-6">
        {path.map((step, i) => (
          <Reveal key={step.title} delay={i * 40} variant="left">
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

      <ul className="mt-14 grid gap-8">
        {guarantees.map((item) => (
          <Reveal key={item.title}>
            <li className="border-t border-border pt-5">
              <h2 className="text-lg font-medium">{item.title}</h2>
              <p className="mt-2 text-muted-foreground">{item.body}</p>
            </li>
          </Reveal>
        ))}
      </ul>

      <Reveal className="mt-12 flex flex-wrap gap-3">
        <Button asChild>
          <a href={links.wallet} target="_blank" rel="noreferrer">
            Open wallet
          </a>
        </Button>
        <Button asChild variant="outline">
          <Link to="/developers">Developers</Link>
        </Button>
        <Button asChild variant="outline">
          <a href={links.docs} target="_blank" rel="noreferrer">
            Docs
          </a>
        </Button>
      </Reveal>
    </div>
  );
}
