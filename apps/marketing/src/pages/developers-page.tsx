import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { DocumentMeta } from "@/components/document-meta";
import { ConsolePolicyMock } from "@/components/product-mocks";
import { Reveal } from "@/components/reveal";
import { MarketingButton as Button } from "@/components/ui/marketing-button";
import { links } from "@/lib/links";

const surfaces = [
  {
    title: "Web & App",
    body: "End-user wallets — not for embedding. Point people to the web wallet today; mobile app follows.",
  },
  {
    title: "API",
    body: "HTTP /v1/sdk for create, pay, history. JWT /v1/agents for pause, limits, and keys.",
  },
  {
    title: "SDK",
    body: "TypeScript client and LangChain tools over the same HTTP surface.",
  },
  {
    title: "MCP",
    body: "@xone/mcp for Cursor, Claude Desktop, and other hosts. Spend tools only.",
  },
  {
    title: "Console",
    body: "Operator JWT: keys, allowlists, pause, resume, soft-delete, ledger.",
  },
] as const;

const x402Steps = [
  {
    title: "Resource returns 402",
    body: "Your agent requests a paid HTTP resource. The seller quotes amount, asset, and payee.",
  },
  {
    title: "Policy checks the quote",
    body: "Daily cap, per-transaction cap, status, and optional host/payee allowlists run server-side.",
  },
  {
    title: "Settle once",
    body: "X-ONE pays with a sealed key. Reuse Idempotency-Key on retries so a blip does not double-charge.",
  },
] as const;

const steps = [
  {
    title: "Create an API key",
    body: "Sign in to Console and create a uniquely named key. The plaintext token is shown once — copy it immediately.",
  },
  {
    title: "Bind a wallet",
    body: "Generate an agent wallet for that key (SDK create, or POST /v1/sdk/agents). Set daily and per-transaction limits. Fund USDC at the address.",
  },
  {
    title: "Pay via SDK, HTTP, or MCP",
    body: "Use @xonepay/sdk, POST /v1/sdk/agents/:id/pay, or xone_x402_pay. Runtime tokens pay and read — pause and limits stay on JWT / Console.",
  },
] as const;

const spenderRoutes = [
  { method: "POST", path: "/v1/sdk/agents", note: "Create wallet" },
  { method: "GET", path: "/v1/sdk/agents", note: "List / get bound agent" },
  { method: "GET", path: "/v1/sdk/agents/:id", note: "Agent detail" },
  { method: "POST", path: "/v1/sdk/agents/:id/pay", note: "x402 pay" },
  { method: "GET", path: "/v1/sdk/agents/:id/history", note: "History" },
] as const;

const operatorRoutes = [
  { method: "GET", path: "/v1/agents", note: "List agents" },
  { method: "GET", path: "/v1/agents/history", note: "Account ledger" },
  { method: "POST", path: "/v1/agents", note: "Create (needs apiKeyId)" },
  { method: "GET", path: "/v1/agents/:id", note: "Get agent" },
  { method: "DELETE", path: "/v1/agents/:id", note: "Soft-delete" },
  { method: "POST", path: "/v1/agents/:id/pause", note: "Pause spend" },
  { method: "POST", path: "/v1/agents/:id/resume", note: "Resume spend" },
  { method: "PATCH", path: "/v1/agents/:id/limits", note: "Update limits" },
  { method: "GET", path: "/v1/agents/:id/history", note: "Agent history" },
  { method: "GET", path: "/v1/api-keys", note: "List keys" },
  { method: "POST", path: "/v1/api-keys", note: "Create key" },
  { method: "DELETE", path: "/v1/api-keys/:id", note: "Delete key" },
  { method: "GET", path: "/v1/me", note: "Profile" },
] as const;

const mcpTools = [
  { name: "xone_create_agent", note: "Create or load the bound wallet" },
  { name: "xone_wallet_address", note: "Address, chain, status" },
  { name: "xone_wallet_balance", note: "Policy snapshot — not RPC USDC" },
  { name: "xone_x402_pay", note: "Settle an x402 URL" },
  { name: "xone_get_history", note: "Recent events" },
] as const;

/**
 * Developer landing — SDK, HTTP, MCP; web/app called out as end-user surfaces.
 */
export function DevelopersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <DocumentMeta
        title="X-ONE Developers — API, SDK & MCP for agent payments"
        description="Integrate X-ONE with HTTP, TypeScript SDK, LangChain tools, and MCP. Spender /v1/sdk plus operator /v1/agents. Web and App are for end users."
      />

      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Developers
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Embed the wallet layer with API, SDK, and MCP.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Everyday users open Web or App. Builders integrate through HTTP,{" "}
          <code className="font-mono text-sm">@xonepay/sdk</code>, or{" "}
          <code className="font-mono text-sm">@xone/mcp</code> — the same
          policy-gated core. Free during beta.
        </p>
      </Reveal>

      <Reveal delay={100} className="mt-8 flex flex-wrap gap-3">
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
          <Button asChild className="cta-glow">
            <a href={links.console} target="_blank" rel="noreferrer">
              Open Console
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </a>
          </Button>
        </motion.div>
        <Button asChild variant="outline">
          <a href={links.docsApi} target="_blank" rel="noreferrer">
            HTTP API
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={links.docs} target="_blank" rel="noreferrer">
            SDK docs
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={links.docsMcp} target="_blank" rel="noreferrer">
            MCP docs
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={links.playground} target="_blank" rel="noreferrer">
            Playground
          </a>
        </Button>
      </Reveal>

      <ul className="mt-14 grid gap-4 sm:grid-cols-2">
        {surfaces.map((item, i) => (
          <Reveal key={item.title} delay={i * 60}>
            <li className="h-full rounded-lg border border-border bg-card p-4">
              <p className="font-medium">{item.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </li>
          </Reveal>
        ))}
      </ul>

      <Reveal className="mt-16">
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
          x402
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          Pay HTTP resources without handing the model a key.
        </h2>
        <p className="mt-3 text-muted-foreground">
          x402 is an HTTP 402 payment standard. X-ONE is the buyer: quote in,
          policy check, settle USDC, return the resource body.{" "}
          <a
            href={links.x402}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline-offset-4 hover:underline"
          >
            x402.org
          </a>
        </p>
      </Reveal>
      <ol className="mt-8 space-y-6">
        {x402Steps.map((step, i) => (
          <Reveal key={step.title} delay={i * 50} variant="left">
            <li className="border-t border-border pt-5">
              <p className="font-mono text-xs text-muted-foreground">
                0{i + 1}
              </p>
              <h3 className="mt-1 text-lg font-medium">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </li>
          </Reveal>
        ))}
      </ol>

      <ol className="mt-16 space-y-8">
        {steps.map((step, i) => (
          <Reveal key={step.title} delay={i * 70} variant="left">
            <li className="border-t border-border pt-6">
              <p className="font-mono text-xs text-muted-foreground">
                Step {i + 1}
              </p>
              <h2 className="mt-2 text-xl font-medium">{step.title}</h2>
              <p className="mt-2 text-muted-foreground">{step.body}</p>
            </li>
          </Reveal>
        ))}
      </ol>

      <Reveal className="mt-16 space-y-4">
        <h2 className="text-lg font-medium">MCP</h2>
        <p className="text-sm text-muted-foreground">
          Same spend surface as the SDK, for MCP hosts. The host must supply a{" "}
          <code className="font-mono text-xs">xone_…</code> key — the server
          will not invent one. Pause and limits remain in Console.
        </p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-sm">
          <code>npx -y @xone/mcp</code>
        </pre>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 font-medium">Tool</th>
                <th className="px-3 py-2 font-medium">Use</th>
              </tr>
            </thead>
            <tbody>
              {mcpTools.map((row) => (
                <tr key={row.name} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{row.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <a
          href={links.docsMcp}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
        >
          Full MCP reference
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
        </a>
      </Reveal>

      <Reveal className="mt-14">
        <h2 className="text-lg font-medium">Console policy</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          One API key binds to one agent wallet.{" "}
          <code className="font-mono text-xs">getSpendSnapshot()</code> returns
          address plus remaining daily / caps / status — fund USDC on-chain
          separately.
        </p>
        <div className="mt-5 max-w-md">
          <ConsolePolicyMock />
        </div>
      </Reveal>

      <Reveal className="mt-14 space-y-4">
        <h2 className="text-lg font-medium">Spender API (API key)</h2>
        <p className="text-sm text-muted-foreground">
          Auth: <code className="font-mono text-xs">Authorization: Bearer xone_…</code>
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 font-medium">Path</th>
                <th className="px-3 py-2 font-medium">Use</th>
              </tr>
            </thead>
            <tbody>
              {spenderRoutes.map((row) => (
                <tr key={row.path + row.method} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{row.method}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.path}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <Reveal delay={60} className="mt-10 space-y-4">
        <h2 className="text-lg font-medium">Operator API (Console JWT)</h2>
        <p className="text-sm text-muted-foreground">
          Auth: signed-in Console user token. Pause, limits, keys — not available
          to the agent spend key.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 font-medium">Path</th>
                <th className="px-3 py-2 font-medium">Use</th>
              </tr>
            </thead>
            <tbody>
              {operatorRoutes.map((row) => (
                <tr key={row.path + row.method} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{row.method}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.path}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <a
          href={links.docsApi}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
        >
          Full HTTP API reference
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
        </a>
      </Reveal>

      <Reveal delay={80} className="mt-12 space-y-4" variant="scale">
        <h2 className="text-lg font-medium">Install SDK</h2>
        <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-sm">
          <code>npm install @xonepay/sdk</code>
        </pre>
        <h2 className="text-lg font-medium">Pay with SDK</h2>
        <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-sm leading-relaxed">
          <code>{`import { XOne } from "@xonepay/sdk";

const xone = new XOne({
  agentToken: process.env.XONE_AGENT_TOKEN!,
});

const agent = await xone.agent.create({
  apiKey: process.env.XONE_AGENT_TOKEN!,
  name: "agent",
  dailyLimit: 10,
  perTransaction: 1,
});

const result = await agent.pay({
  url: "https://api.example.com/paid-resource",
});

console.log(result.paid, result.body);`}</code>
        </pre>
        <p className="text-sm text-muted-foreground">
          LangChain: <code className="font-mono text-xs">agent.getTools()</code>{" "}
          exposes the same spend tools as MCP. Transfer is not on the runtime
          surface — x402 is the only pay path.
        </p>
      </Reveal>
    </div>
  );
}
