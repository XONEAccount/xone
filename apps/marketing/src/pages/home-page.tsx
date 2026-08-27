import { ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand-mark";
import { DocumentMeta } from "@/components/document-meta";
import { FaqList } from "@/components/faq-list";
import { HeroBackdrop } from "@/components/hero-backdrop";
import { Marquee } from "@/components/marquee";
import { Reveal } from "@/components/reveal";
import { MarketingButton as Button } from "@/components/ui/marketing-button";
import { WaitlistForm } from "@/components/waitlist-form";
import { links } from "@/lib/links";

const advantages = [
  {
    title: "Secure",
    body: "Keys stay protected. Payments go through explicit authorization and policy — never unrestricted model access.",
  },
  {
    title: "Fast",
    body: "A2A payments settle in seconds. Send, receive, and confirm without crypto ceremony.",
  },
  {
    title: "Simple",
    body: "A calm fintech experience: balances, pay, history — built for people, not dashboards of jargon.",
  },
  {
    title: "Global-ready",
    body: "Designed for worldwide users and multi-chain assets, with agent-to-agent rails that travel with you.",
  },
] as const;

const channels = [
  {
    title: "Web",
    audience: "Everyone",
    body: "Full wallet in the browser — balances, send, receive, and A2A pay.",
    href: links.wallet,
    cta: "Open web wallet",
  },
  {
    title: "App",
    audience: "Everyone",
    body: "Mobile wallet for everyday spend and on-the-go A2A payments.",
    href: "#waitlist",
    cta: "Join waitlist",
    hash: true,
  },
  {
    title: "API",
    audience: "Builders",
    body: "Spender /v1/sdk and operator /v1/agents — same capabilities as the SDK over HTTP.",
    href: links.docsApi,
    cta: "API docs",
  },
  {
    title: "SDK",
    audience: "Builders",
    body: "TypeScript SDK for agent wallets and x402 — ship payments in your product.",
    href: "/developers",
    cta: "SDK guide",
    internal: true,
  },
] as const;

const a2aSteps = [
  { title: "Request", body: "An agent proposes a payment with amount and payee." },
  { title: "Policy", body: "Limits decide auto-pay, confirm, or block." },
  { title: "Confirm", body: "You authorize when the rule requires it." },
  { title: "Settle", body: "Funds move fast — recorded in your ledger." },
] as const;

const compareRows = [
  {
    label: "Everyday wallet UX",
    typical: "Developer-heavy screens",
    xone: "Balances, send, receive, pay",
  },
  {
    label: "Agent-to-agent pay",
    typical: "Rare or manual",
    xone: "Built-in A2A flow",
  },
  {
    label: "AI spend safety",
    typical: "Keys in prompts / scripts",
    xone: "Policy + authorization",
  },
  {
    label: "How you access it",
    typical: "App or extension only",
    xone: "Web, App, API, SDK",
  },
] as const;

const faqs = [
  {
    question: "What is A2A?",
    answer:
      "Agent-to-agent payments. When an AI assistant or merchant agent needs to pay, X-ONE turns that into a clear request you can auto-approve under limits — or confirm yourself.",
  },
  {
    question: "Is it safe to let agents pay?",
    answer:
      "Agents never get unrestricted keys. Spend goes through policy (limits, allowlists) and explicit authorization when required. Models propose; policy decides.",
  },
  {
    question: "Who is Web / App vs API / SDK for?",
    answer:
      "Web and App are for people using the wallet day to day. API and SDK are for builders embedding payments into products and backends.",
  },
  {
    question: "Which chains and assets?",
    answer:
      "X-ONE is built multi-chain with USDC-style settlement in mind. Supported networks expand over time — check Docs for the current list.",
  },
  {
    question: "Do I pay gas?",
    answer:
      "Where sponsorship is available, network fees can be covered so you focus on the payment — not the ceremony.",
  },
  {
    question: "How much does it cost?",
    answer:
      "Free during beta for wallet and developer access. Pricing will be announced before general availability.",
  },
] as const;

/**
 * Marketing homepage — wallet-first, compressed narrative, trust + FAQ.
 */
export function HomePage() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.35]);

  return (
    <>
      <DocumentMeta
        title="X-ONE — Web3 wallet for A2A payments"
        description="Secure, fast Web3 wallet with agent-to-agent payments. Web and App for everyone. API and SDK for builders. Free during beta."
      />

      <section
        ref={heroRef}
        className="relative overflow-hidden border-b border-border"
      >
        <HeroBackdrop />
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6 sm:py-20"
        >
          <BrandMark />
          <div className="mt-4 h-px w-24 bg-[var(--color-foreground)] draw-line" />
          <h1 className="rise rise-delay-1 mt-6 max-w-3xl text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl font-semibold">
            The Web3 wallet built for A2A payments.
          </h1>
          <p className="rise rise-delay-2 mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Secure. Fast. Effortless. Hold assets, pay people and agents, and
            move money across the agent economy — on web, app, API, and SDK.
          </p>
          <div className="rise rise-delay-3 mt-8 flex flex-wrap gap-3">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Button asChild size="lg" className="cta-glow">
                <a href={links.wallet} target="_blank" rel="noreferrer">
                  Open wallet
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </a>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Button asChild size="lg" variant="outline">
                <Link to="/developers">For developers</Link>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <Marquee />

      <section className="border-b border-border py-12 sm:py-14">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 sm:px-6">
          <a
            href={links.wallet}
            target="_blank"
            rel="noreferrer"
            className="group rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted/60"
          >
            <p className="font-mono text-xs text-muted-foreground">For everyone</p>
            <p className="mt-2 text-xl font-medium">Use the wallet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Send, receive, and A2A pay in a calm fintech UI — start on web
              today.
            </p>
            <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
              Open wallet
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                strokeWidth={1.75}
              />
            </p>
          </a>
          <Link
            to="/developers"
            className="group rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted/60"
          >
            <p className="font-mono text-xs text-muted-foreground">For builders</p>
            <p className="mt-2 text-xl font-medium">Integrate API & SDK</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Embed scoped agent spend into your product with the same secure
              core.
            </p>
            <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
              Developer guide
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                strokeWidth={1.75}
              />
            </p>
          </Link>
        </div>
      </section>

      <section className="border-b border-border py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Why X-ONE
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              A modern wallet with agent-to-agent pay out front.
            </h2>
          </Reveal>
          <ul className="mt-10 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((item) => (
              <li
                key={item.title}
                className="flex h-full flex-col rounded-lg border border-border bg-card p-5"
              >
                <p className="text-lg font-medium">{item.title}</p>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-border py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Compare
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl tracking-tight sm:text-4xl font-semibold">
              Not just another crypto wallet.
            </h2>
          </Reveal>
          <div className="mt-10 overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Capability
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Typical wallet
                  </th>
                  <th className="px-4 py-3 font-medium">X-ONE</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{row.label}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.typical}
                    </td>
                    <td className="px-4 py-3">{row.xone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-b border-border py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              A2A
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl tracking-tight sm:text-4xl font-semibold">
              Agent payments that stay under your control.
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              When an assistant or merchant agent needs to pay, X-ONE turns that
              into a clear request — with policy, confirmation, and an auditable
              result.
            </p>
          </Reveal>
          <ol className="mt-10 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {a2aSteps.map((step, i) => (
              <li
                key={step.title}
                className="flex h-full flex-col rounded-lg border border-border bg-card p-5"
              >
                <p className="font-mono text-xs text-muted-foreground">
                  0{i + 1}
                </p>
                <p className="mt-2 text-lg font-medium">{step.title}</p>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="security" className="border-b border-border py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Security
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl tracking-tight sm:text-4xl font-semibold">
              Models propose. Policy decides. Keys stay out of prompts.
            </h2>
          </Reveal>
          <ul className="mt-10 grid items-stretch gap-6 sm:grid-cols-3">
            {[
              {
                title: "Protected keys",
                body: "Wallet material is never handed to the LLM as free-form signing power.",
              },
              {
                title: "Spend policy",
                body: "Daily and per-transaction limits, plus optional host and payee allowlists.",
              },
              {
                title: "Explicit authorization",
                body: "Above thresholds, you confirm. Below them, auto-pay only when policy allows.",
              },
            ].map((item) => (
              <li
                key={item.title}
                className="flex h-full flex-col border-t border-border pt-4"
              >
                <p className="font-medium">{item.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-border py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Access
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl tracking-tight sm:text-4xl font-semibold">
              Web and App for people. API and SDK for builders.
            </h2>
          </Reveal>
          <ul className="mt-10 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {channels.map((ch) => (
              <li
                key={ch.title}
                className="flex h-full flex-col rounded-lg border border-border bg-card p-5"
              >
                <p className="font-mono text-xs text-muted-foreground">
                  {ch.audience}
                </p>
                <p className="mt-2 text-lg font-medium">{ch.title}</p>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  {ch.body}
                </p>
                {"internal" in ch && ch.internal ? (
                  <Link
                    to={ch.href}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {ch.cta}
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </Link>
                ) : "hash" in ch && ch.hash ? (
                  <a
                    href={ch.href}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {ch.cta}
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </a>
                ) : (
                  <a
                    href={ch.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {ch.cta}
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="waitlist" className="border-b border-border py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Mobile app
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl tracking-tight sm:text-4xl font-semibold">
              Get notified when the app launches.
            </h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              Web wallet is live. Join the waitlist for iOS and Android — same
              wallet, on the go.
            </p>
            <WaitlistForm className="mt-8" />
          </Reveal>
        </div>
      </section>

      <section id="pricing" className="border-b border-border py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Pricing
            </p>
            <h2 className="mt-3 text-3xl tracking-tight sm:text-4xl font-semibold">
              Free during beta.
            </h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              Open the wallet and start building with API / SDK at no charge
              while we are in beta. We will publish plans before general
              availability.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <a href={links.wallet} target="_blank" rel="noreferrer">
                  Start free — wallet
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link to="/developers">Start free — developers</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-border py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal variant="left">
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              For developers
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Embed payments with API and SDK.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Call{" "}
              <code className="font-mono text-sm">/v1/sdk</code> for create and
              pay, or{" "}
              <code className="font-mono text-sm">/v1/agents</code> for pause and
              limits. Or use{" "}
              <code className="font-mono text-sm">@xone/sdk</code> as a typed
              client.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <a href={links.docsApi} target="_blank" rel="noreferrer">
                  HTTP API docs
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link to="/developers">
                  Developer guide
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </Link>
              </Button>
            </div>
          </Reveal>
          <Reveal delay={80} variant="scale">
            <pre className="overflow-x-auto rounded-lg border border-border bg-card p-5 font-mono text-xs leading-relaxed sm:text-sm">
              <code>{`import { XOne } from "@xone/sdk";

const xone = new XOne({ agentToken });
await xone.pay({
  url: "https://api.example.com/resource",
});`}</code>
            </pre>
          </Reveal>
        </div>
      </section>

      <section id="faq" className="border-b border-border py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              FAQ
            </p>
            <h2 className="mt-3 text-3xl tracking-tight sm:text-4xl font-semibold">
              Questions, answered.
            </h2>
            <div className="mt-10">
              <FaqList items={[...faqs]} />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-2 sm:px-6">
          <Reveal>
            <div className="rounded-lg border border-border bg-card p-8">
              <p className="font-mono text-xs text-muted-foreground">Everyone</p>
              <h2 className="mt-2 text-3xl tracking-tight font-semibold">
                Open the wallet
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Balances, send, receive, and A2A pay — start on web now.
              </p>
              <Button asChild className="mt-6" size="lg">
                <a href={links.wallet} target="_blank" rel="noreferrer">
                  Open wallet
                </a>
              </Button>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="rounded-lg border border-border bg-card p-8">
              <p className="font-mono text-xs text-muted-foreground">Builders</p>
              <h2 className="mt-2 text-3xl tracking-tight font-semibold">
                Build with API / SDK
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Console, docs, and playground for scoped agent spend.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild size="lg" variant="outline">
                  <Link to="/developers">Developers</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href={links.docs} target="_blank" rel="noreferrer">
                    Docs
                  </a>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
