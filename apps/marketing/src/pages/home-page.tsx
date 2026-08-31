import { ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand-mark";
import { DocumentMeta } from "@/components/document-meta";
import { FaqList } from "@/components/faq-list";
import { HeroBackdrop } from "@/components/hero-backdrop";
import { Marquee } from "@/components/marquee";
import { NetworkStrip } from "@/components/network-strip";
import {
  AssistantMock,
  ConsolePolicyMock,
  WalletHeroMock,
} from "@/components/product-mocks";
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

const scenarios = [
  {
    audience: "Everyone",
    title: "Pay an agent from chat",
    body: "Ask the assistant to book a hotel under 50 USDC. You get a payment card — amount, payee, policy — and confirm when the rule requires it.",
  },
  {
    audience: "Builders",
    title: "Let your product spend under limits",
    body: "Create an agent wallet, set a daily cap, and call pay() on an x402 URL. The runtime never sees a private key.",
  },
  {
    audience: "Operators",
    title: "Pause, limit, and audit",
    body: "Console JWT owns keys, allowlists, pause, and the ledger. The spend token can pay — it cannot change policy.",
  },
] as const;

const walletCapabilities = [
  {
    title: "Balances",
    body: "See USDC and network token on the chain you are using — without a wall of contract addresses.",
  },
  {
    title: "Send & receive",
    body: "Address, QR, and a clear network warning. Preview before every user-initiated send.",
  },
  {
    title: "AI assistant",
    body: "Task-oriented: balances, send, pay an order. Financial actions show as cards, not buried in chat.",
  },
  {
    title: "History",
    body: "Every payment lands in a ledger you can read — intent, result, and on-chain proof when it exists.",
  },
] as const;

const channels = [
  {
    title: "Web",
    audience: "Everyone",
    body: "Full wallet in the browser — balances, send, receive, assistant, and A2A pay.",
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
    body: "TypeScript client and LangChain tools for agent wallets and x402.",
    href: "/developers",
    cta: "SDK guide",
    internal: true,
  },
  {
    title: "MCP",
    audience: "Builders",
    body: "Spend tools for Cursor, Claude Desktop, and other MCP hosts — policy still lives in Console.",
    href: links.docsMcp,
    cta: "MCP docs",
  },
  {
    title: "Console",
    audience: "Operators",
    body: "API keys, limits, allowlists, pause, and ledger. Operator JWT only.",
    href: links.console,
    cta: "Open Console",
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
    label: "x402 HTTP pay",
    typical: "Custom checkout glue",
    xone: "Native settle from SDK / MCP",
  },
  {
    label: "How you access it",
    typical: "App or extension only",
    xone: "Web, App, API, SDK, MCP",
  },
] as const;

const faqs = [
  {
    question: "How do I get started?",
    answer:
      "Open the web wallet, top up testnet USDC from a faucet, confirm the signature, then try Chat. Getting started has a one-minute silent walkthrough of that path.",
  },
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
    question: "Does the wallet include an AI assistant?",
    answer:
      "Yes. It is task-oriented — balances, send, pay an order — not a generic chatbot. Financial actions appear as structured cards. The model cannot bypass policy.",
  },
  {
    question: "What is x402?",
    answer:
      "An HTTP 402 payment standard. A resource returns a quote; X-ONE settles USDC under your agent’s policy and retries with the same idempotency key.",
  },
  {
    question: "What is MCP?",
    answer:
      "@xone/mcp exposes the spend surface to MCP hosts such as Cursor and Claude Desktop: create agent, snapshot, pay, history. Pause and limits stay in Console.",
  },
  {
    question: "Who is Web / App vs API / SDK / MCP for?",
    answer:
      "Web and App are for people using the wallet day to day. API, SDK, and MCP are for builders embedding payments into products and agent runtimes.",
  },
  {
    question: "Which chains and assets?",
    answer:
      "Beta settles USDC on Base Sepolia. Mainnet networks will be listed in Docs as they go live. Do not send mainnet assets to a testnet address.",
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
        description="Secure, fast Web3 wallet with agent-to-agent payments. Web and App for everyone. API, SDK, and MCP for builders. Free during beta."
      />

      <section
        ref={heroRef}
        className="relative overflow-hidden border-b border-border"
      >
        <HeroBackdrop />
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:min-h-[calc(100vh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16"
        >
          <div>
            <BrandMark className="text-4xl sm:text-6xl md:text-7xl" />
            <div className="mt-4 h-px w-24 bg-[var(--color-foreground)] draw-line" />
            <h1 className="rise rise-delay-1 mt-6 max-w-xl text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl font-semibold">
              The Web3 wallet built for A2A payments.
            </h1>
            <p className="rise rise-delay-2 mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Hold assets, pay people and agents, and keep AI spend under
              policy — on web, app, API, SDK, and MCP.
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
            <p className="rise rise-delay-3 mt-4">
              <Link
                to="/guide"
                className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-[var(--color-foreground)] hover:underline"
              >
                Watch a 1-min tour
              </Link>
            </p>
          </div>
          <div className="rise rise-delay-2 min-w-0">
            <WalletHeroMock />
          </div>
        </motion.div>
      </section>

      <Marquee />
      <NetworkStrip />

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
              Send, receive, assistant, and A2A pay in a calm fintech UI —
              start on web today.
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
            <p className="mt-2 text-xl font-medium">Integrate API, SDK & MCP</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Embed scoped agent spend into your product or runtime with the
              same secure core.
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

      <section id="use-cases" className="scroll-mt-16 border-b border-border py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Use cases
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Built for people, products, and operators.
            </h2>
          </Reveal>
          <ul className="mt-10 grid items-stretch gap-6 lg:grid-cols-3">
            {scenarios.map((item) => (
              <li
                key={item.title}
                className="flex h-full flex-col rounded-lg border border-border bg-card p-5"
              >
                <p className="font-mono text-xs text-muted-foreground">
                  {item.audience}
                </p>
                <p className="mt-2 text-lg font-medium">{item.title}</p>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="wallet" className="scroll-mt-16 border-b border-border py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Wallet
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Everyday money, plus an assistant that cannot skip policy.
            </h2>
          </Reveal>
          <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
            <ul className="grid items-stretch gap-6 sm:grid-cols-2">
              {walletCapabilities.map((item) => (
                <li
                  key={item.title}
                  className="flex h-full flex-col border-t border-border pt-4"
                >
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ul>
            <Reveal delay={80} variant="scale">
              <AssistantMock />
            </Reveal>
          </div>
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
                className="a2a-step flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card p-5"
              >
                <span className="a2a-pulse" aria-hidden />
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

      <section id="security" className="scroll-mt-16 border-b border-border py-20 sm:py-24">
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
          <Link
            to="/security"
            className="mt-8 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            How the safety model works
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Link>
        </div>
      </section>

      <section className="border-b border-border py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Access
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl tracking-tight sm:text-4xl font-semibold">
              Web and App for people. API, SDK, and MCP for builders.
            </h2>
          </Reveal>
          <ul className="mt-10 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

      <section id="waitlist" className="scroll-mt-16 border-b border-border py-20 sm:py-24">
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

      <section id="pricing" className="scroll-mt-16 border-b border-border py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Pricing
            </p>
            <h2 className="mt-3 text-3xl tracking-tight sm:text-4xl font-semibold">
              Free during beta.
            </h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              Open the wallet and start building with API, SDK, and MCP at no
              charge while we are in beta. We will publish plans before general
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
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <Reveal variant="left">
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              For developers
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Same spend surface: HTTP, SDK, MCP.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Create an agent, pay an x402 resource, read history. Console owns
              pause and limits.{" "}
              <code className="font-mono text-sm">getSpendSnapshot()</code> is
              policy headroom — not a live chain balance.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <a href={links.docsApi} target="_blank" rel="noreferrer">
                  HTTP API
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={links.docsMcp} target="_blank" rel="noreferrer">
                  MCP
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
            <div className="mt-8">
              <ConsolePolicyMock />
            </div>
          </Reveal>
          <Reveal delay={80} variant="scale">
            <pre className="overflow-x-auto rounded-lg border border-border bg-card p-5 font-mono text-xs leading-relaxed sm:text-sm">
              <code>{`import { XOne } from "@xonepay/sdk";

const xone = new XOne({ agentToken });
const agent = await xone.agent.create({
  apiKey: agentToken,
  name: "travel-bot",
  dailyLimit: 10,
  perTransaction: 1,
});
await agent.pay({
  url: "https://api.example.com/resource",
});`}</code>
            </pre>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-5 font-mono text-xs leading-relaxed sm:text-sm">
              <code>{`npx -y @xone/mcp

# Cursor / Claude Desktop
"mcpServers": {
  "xone": {
    "command": "npx",
    "args": ["-y", "@xone/mcp"]
  }
}`}</code>
            </pre>
          </Reveal>
        </div>
      </section>

      <section id="faq" className="scroll-mt-16 border-b border-border py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              FAQ
            </p>
            <h2 className="mt-3 text-3xl tracking-tight sm:text-4xl font-semibold">
              Questions, answered.
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Prefer to watch?{" "}
              <Link
                to="/guide"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Getting started — 1 min
              </Link>
            </p>
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
                Balances, send, receive, assistant, and A2A pay — start on web
                now.
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
                Build with API / SDK / MCP
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
