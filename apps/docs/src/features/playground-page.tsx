import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  Menu,
  Play,
  Wallet,
  X,
} from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_PAY_URL,
  PlaygroundApiError,
  formatCurl,
  getConsoleUrl,
  getPlaygroundApiLabel,
  loadBoundAgent,
  createBoundAgent,
  loadStoredToken,
  normalizeAgentToken,
  isSpendToken,
  spendTokenError,
  playgroundFetch,
  storeToken,
  type PlaygroundAgent,
  type PlaygroundCall,
} from "@/lib/sdk-client";
import type { DocsView } from "@/lib/view";
import { cn } from "@/lib/utils";

type PlaygroundPageProps = {
  view: DocsView;
  onView: (view: DocsView) => void;
};

type MethodId =
  | "create"
  | "get"
  | "getStatus"
  | "getAddress"
  | "getSpendSnapshot"
  | "getLimits"
  | "getHistory"
  | "pay";

type MethodDef = {
  id: MethodId;
  group: string;
  label: string;
  hint: string;
  needsAgent: boolean;
};

const METHODS: MethodDef[] = [
  {
    id: "create",
    group: "xone.agent",
    label: "create()",
    hint: "Create the wallet bound to this key",
    needsAgent: false,
  },
  {
    id: "get",
    group: "xone.agent",
    label: "get()",
    hint: "Load the agent bound to this key",
    needsAgent: false,
  },
  {
    id: "getStatus",
    group: "SDK methods",
    label: "getStatus()",
    hint: "active · paused · exhausted · deleted",
    needsAgent: true,
  },
  {
    id: "getAddress",
    group: "SDK methods",
    label: "getAddress()",
    hint: "On-chain wallet address",
    needsAgent: true,
  },
  {
    id: "getSpendSnapshot",
    group: "SDK methods",
    label: "getSpendSnapshot()",
    hint: "Address + spend-policy snapshot (not RPC USDC)",
    needsAgent: true,
  },
  {
    id: "getLimits",
    group: "SDK methods",
    label: "getLimits()",
    hint: "Caps, remaining daily, allowlists",
    needsAgent: true,
  },
  {
    id: "getHistory",
    group: "SDK methods",
    label: "getHistory()",
    hint: "Spend and lifecycle events",
    needsAgent: true,
  },
  {
    id: "pay",
    group: "SDK methods",
    label: "pay(params)",
    hint: "Settle an x402 resource (real USDC)",
    needsAgent: true,
  },
];

const CONSOLE_ONLY = [
  "agent.delete()",
  "agent.pause()",
  "agent.resume()",
  "agent.updateLimits()",
];

/**
 * Live API key tester: every spend-token SDK method, plus a live wallet panel.
 * @param props - Site view switch
 */
export function PlaygroundPage({ view, onView }: PlaygroundPageProps) {
  const fetchedFor = useRef("");
  const selectedRef = useRef<MethodId>("get");
  const methodTouched = useRef(false);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [token, setToken] = useState(() => {
    const stored = loadStoredToken();
    return isSpendToken(stored) ? stored : "";
  });
  const [agent, setAgent] = useState<PlaygroundAgent | null>(null);
  const [session, setSession] = useState<"idle" | "connecting" | "ready">("idle");
  const [selected, setSelected] = useState<MethodId>("get");
  const [payUrl, setPayUrl] = useState(DEFAULT_PAY_URL);
  const [confirmPay, setConfirmPay] = useState(false);
  const [busy, setBusy] = useState<MethodId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [call, setCall] = useState<PlaygroundCall | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [copied, setCopied] = useState<"curl" | "sdk" | "address" | null>(null);
  selectedRef.current = selected;

  /**
   * Reads the live input (autofill/paste) then React state.
   * @returns Normalized spend token
   */
  function currentToken(): string {
    const live = tokenInputRef.current?.value ?? "";
    return normalizeAgentToken(live || token || loadStoredToken());
  }

  useEffect(() => {
    const secret = normalizeAgentToken(token);
    if (!isSpendToken(secret) || secret.length < 21) return;
    const timer = window.setTimeout(() => {
      if (fetchedFor.current === secret) return;
      fetchedFor.current = secret;
      connectWallet();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [token]);
  const apiUrl = getPlaygroundApiLabel();
  const consoleUrl = getConsoleUrl();
  const active = METHODS.find((m) => m.id === selected) ?? METHODS[0]!;

  const sdkSnippet = useMemo(
    () => snippetFor(selected, payUrl),
    [selected, payUrl],
  );

  /**
   * Highlights a method. Connect/auto-connect must not steal this.
   * @param id - Method to show
   */
  function selectMethod(id: MethodId): void {
    methodTouched.current = true;
    selectedRef.current = id;
    setSelected(id);
  }

  /**
   * Runs an authenticated SDK call and records the exchange.
   * @param id - Method being run
   * @param fn - Authenticated work
   * @param opts.select - When false, do not change the highlighted method (Connect)
   */
  async function run(
    id: MethodId,
    fn: (secret: string) => Promise<{
      call?: PlaygroundCall | null;
      agent?: PlaygroundAgent | null;
      result: unknown;
    }>,
    opts: { select?: boolean } = {},
  ): Promise<void> {
    const select = opts.select !== false;
    const secret = currentToken();
    const tokenError = spendTokenError(secret);
    if (tokenError) {
      setError(tokenError);
      if (id === "get" || id === "create") setSession("idle");
      return;
    }
    if (secret !== token) setToken(secret);
    if (select) selectMethod(id);
    setBusy(id);
    if (select) setError(null);
    if (id === "get" || id === "create") setSession("connecting");
    if (select && id !== "pay") setConfirmPay(false);
    try {
      storeToken(secret);
      const next = await fn(secret);
      if (next.agent !== undefined) setAgent(next.agent);
      if (id === "get" || id === "create") setSession("ready");
      const stillOnThis = selectedRef.current === id;
      if (select || stillOnThis || !methodTouched.current) {
        if (next.call !== undefined) setCall(next.call);
        setResult(next.result);
        if (!select && !methodTouched.current) selectMethod("get");
      }
    } catch (err) {
      if (err instanceof PlaygroundApiError) {
        if (select || selectedRef.current === id) {
          setError(err.message);
          if (err.call) setCall(err.call);
        }
        if (err.code === "invalid_api_key") {
          setAgent(null);
          if (select) setResult(null);
          setSession("idle");
        } else if (id === "get" || id === "create") {
          setSession("idle");
        }
      } else {
        if (select) setError(err instanceof Error ? err.message : String(err));
        if (id === "get" || id === "create") setSession("idle");
      }
    } finally {
      setBusy(null);
    }
  }

  /**
   * Executes the given spender method (does not run create unless `id` is create).
   * @param id - Method to run
   */
  function onRun(id: MethodId = selected): void {
    const def = METHODS.find((m) => m.id === id);
    if (!def) return;
    selectMethod(id);
    if (def.needsAgent && !agent && id !== "get" && id !== "create") {
      setError("Connect a key first — run create() then get().");
      return;
    }

    if (id === "create") {
      void run("create", async (secret) => {
        const created = await createBoundAgent(secret);
        return {
          call: created.call,
          agent: created.agent,
          result: created.agent,
        };
      });
      return;
    }

    if (id === "get") {
      void run("get", async (secret) => {
        const loaded = await loadBoundAgent(secret);
        return {
          call: loaded.call,
          agent: loaded.agent ?? null,
          result: loaded.agent ?? { items: [], note: "No agent bound to this API key" },
        };
      });
      return;
    }

    if (id === "getStatus") {
      setResult(agent!.status);
      setCall(null);
      setError(null);
      setConfirmPay(false);
      return;
    }

    if (id === "getAddress") {
      setResult(agent!.address);
      setCall(null);
      setError(null);
      setConfirmPay(false);
      return;
    }

    if (id === "getSpendSnapshot" || id === "getLimits") {
      void run(id, async (secret) => {
        const { data, call: next } = await playgroundFetch<PlaygroundAgent>({
          token: secret,
          path: `/v1/sdk/agents/${agent!.id}`,
        });
        return {
          call: next,
          agent: data,
          result: id === "getSpendSnapshot" ? toSpendSnapshot(data) : toLimits(data),
        };
      });
      return;
    }

    if (id === "getHistory") {
      void run("getHistory", async (secret) => {
        const { data, call: next } = await playgroundFetch<{ items: unknown[] }>(
          {
            token: secret,
            path: `/v1/sdk/agents/${agent!.id}/history?limit=20`,
          },
        );
        return { call: next, result: data.items };
      });
      return;
    }

    onPay();
  }

  /**
   * Creates the wallet if needed, then loads it. Does not change the method list.
   */
  function connectWallet(): void {
    void run(
      "create",
      async (secret) => {
        const created = await createBoundAgent(secret);
        const loaded = await loadBoundAgent(secret);
        const next = loaded.agent ?? created.agent;
        return {
          call: loaded.call,
          agent: next,
          result: loaded.agent ?? created.agent,
        };
      },
      { select: false },
    );
  }

  /**
   * Settles the sample (or custom) x402 URL. Real USDC spend.
   */
  function onPay(): void {
    if (!agent) {
      setSelected("pay");
      setError("Connect a key first — run create() then get().");
      return;
    }
    const url = payUrl.trim();
    if (!url) {
      setSelected("pay");
      setError("Enter an x402 resource URL.");
      return;
    }
    if (!confirmPay) {
      setSelected("pay");
      setConfirmPay(true);
      setError(null);
      return;
    }
    void run("pay", async (secret) => {
      const idempotencyKey = crypto.randomUUID();
      const { data, call: next } = await playgroundFetch<{
        agent?: PlaygroundAgent;
      }>({
        token: secret,
        method: "POST",
        path: `/v1/sdk/agents/${agent.id}/pay`,
        headers: { "Idempotency-Key": idempotencyKey },
        body: { url, idempotencyKey },
      });
      return {
        call: next,
        agent: data.agent ?? agent,
        result: data,
      };
    });
  }

  /**
   * Copies text and briefly shows a checkmark.
   */
  async function copy(
    kind: "curl" | "sdk" | "address",
    value: string,
  ): Promise<void> {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1500);
  }

  const methodList = (
    <nav className="space-y-4" aria-label="SDK methods">
      {(["xone.agent", "SDK methods"] as const).map((group) => (
        <div key={group}>
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {group}
          </p>
          <ul className="space-y-0.5">
            {METHODS.filter((m) => m.group === group).map((item) => {
              const on = selected === item.id;
              const loading = busy === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={on ? "true" : undefined}
                    onClick={() => onRun(item.id)}
                    className={cn(
                      "relative w-full rounded-md px-2.5 py-1.5 text-left transition-colors",
                      on
                        ? "bg-muted font-medium text-foreground before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <span className="pointer-events-none flex items-center gap-2  text-[14px]">
                      {loading ? (
                        <LoaderCircle className="h-3 w-3 animate-spin" />
                      ) : null}
                      {item.label}
                    </span>
                    <span className="pointer-events-none mt-0.5 block text-[10px] font-normal leading-snug text-muted-foreground">
                      {item.hint}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
        Console only: {CONSOLE_ONLY.join(" · ")}
      </p>
    </nav>
  );

  const keyPanel = (
    <div className="space-y-2">
      <label htmlFor="agent-token" className="text-xs font-medium">
        API key
      </label>
      <Input
        id="agent-token"
        ref={tokenInputRef}
        name="xone-spend-token"
        type="text"
        inputMode="text"
        autoComplete="off"
        data-1p-ignore="true"
        data-lpignore="true"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="xone_…"
        value={token}
        onChange={(e) => {
          setToken(e.target.value);
          setConfirmPay(false);
          setError(null);
        }}
        onInput={(e) => {
          setToken((e.target as HTMLInputElement).value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") connectWallet();
        }}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1"
          disabled={Boolean(busy) || Boolean(agent)}
          onClick={() => connectWallet()}
        >
          {busy === "create" || busy === "get" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : agent ? (
            <Check className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {agent ? "Connected" : "Connect"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!token}
          onClick={() => {
            setToken("");
            setAgent(null);
            setSession("idle");
            setCall(null);
            setResult(null);
            setError(null);
            setSelected("get");
            fetchedFor.current = "";
            methodTouched.current = false;
            selectedRef.current = "get";
            storeToken("");
          }}
        >
          Forget
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Spend-only token from the{" "}
        <a
          href={`${consoleUrl}/api-keys`}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          console
        </a>
        . Click a method to run it.
      </p>
    </div>
  );

  const sidebar = (
    <div className="space-y-5">
      <SiteNav view={view} onView={onView} />
      {keyPanel}
      {methodList}
    </div>
  );

  return (
    <div className="min-h-screen text-(--color-foreground)">
      <div className="flex min-h-screen">
        <aside className="docs-sidebar sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-border bg-white/80 px-3 py-6 backdrop-blur-sm md:block">
          <Brand />
          <div className="mt-5">{sidebar}</div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-white/80 px-4 py-3 backdrop-blur-sm md:hidden">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                <p className="text-sm font-semibold">Playground</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                onClick={() => setMobileOpen((v) => !v)}
              >
                {mobileOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </Button>
            </header>

            {mobileOpen ? (
              <div className="border-b border-border bg-white px-4 py-4 md:hidden">
                {sidebar}
              </div>
            ) : null}

            <main className="px-4 py-8 md:px-8 md:py-10">
              <div className="mx-auto max-w-2xl space-y-6 animate-in">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Try your API key
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {apiUrl}
                  </p>
                </div>

                {error ? (
                  <p className="rounded-md border border-destructive/30 bg-white px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                {selected === "pay" ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className=" text-sm">
                        agent.pay(params)
                      </CardTitle>
                      <CardDescription>
                        Real on-chain USDC. Click Run, then confirm.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <label htmlFor="pay-url" className="text-xs font-medium">
                        x402 URL
                      </label>
                      <Input
                        id="pay-url"
                        spellCheck={false}
                        value={payUrl}
                        onChange={(e) => {
                          setPayUrl(e.target.value);
                          setConfirmPay(false);
                        }}
                      />
                      {confirmPay ? (
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          This spends {agent?.currency ?? "USDC"} under policy.
                          Click again to confirm.
                        </p>
                      ) : null}
                      <Button
                        type="button"
                        variant={confirmPay ? "default" : "outline"}
                        disabled={Boolean(busy) || !agent}
                        onClick={onPay}
                      >
                        {busy === "pay" ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : null}
                        {confirmPay ? "Confirm pay" : "Run pay()"}
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                    <div>
                      <CardTitle>Result</CardTitle>
                      <CardDescription>
                        {active.label}
                        {call
                          ? ` · ${call.method} ${call.path} · ${call.status} · ${call.ms}ms`
                          : " · local snapshot"}
                      </CardDescription>
                    </div>
                    {call ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void copy("curl", formatCurl(currentToken(), call))
                        }
                      >
                        {copied === "curl" ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        curl
                      </Button>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    {result !== null ? (
                      <pre className="overflow-x-auto rounded-md border border-border bg-primary-foreground p-3  text-[11px] leading-relaxed text-foreground">
                        {typeof result === "string"
                          ? result
                          : JSON.stringify(result, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Click a method on the left to run it.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                    <div>
                      <CardTitle>SDK</CardTitle>
                      <CardDescription>{active.hint}</CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void copy("sdk", sdkSnippet)}
                    >
                      {copied === "sdk" ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copy
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <pre className="overflow-x-auto rounded-md border border-border bg-primary-foreground p-3  text-[11px] leading-relaxed">
                      {sdkSnippet}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </main>
          </div>

          <aside className="docs-sidebar border-t border-border bg-white/80 lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <WalletPanel
              agent={agent}
              session={session}
              copied={copied === "address"}
              onCopy={() => {
                if (agent) void copy("address", agent.address);
              }}
              consoleUrl={consoleUrl}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

/**
 * Right-rail wallet status for the bound agent.
 */
function WalletPanel({
  agent,
  session,
  copied,
  onCopy,
  consoleUrl,
}: {
  agent: PlaygroundAgent | null;
  session: "idle" | "connecting" | "ready";
  copied: boolean;
  onCopy: () => void;
  consoleUrl: string;
}) {
  const remaining =
    agent && agent.dailyLimit > 0
      ? Math.max(0, Math.min(1, agent.remainingDaily / agent.dailyLimit))
      : 0;

  return (
    <div className="space-y-5 px-4 py-6 md:px-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Agent wallet
        </p>
        <p className="mt-1 text-sm font-semibold tracking-tight">
          {agent
            ? agent.name
            : session === "connecting"
              ? "Connecting…"
              : session === "ready"
                ? "No agent bound"
                : "Not connected"}
        </p>
      </div>

      {agent ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Status</span>
            <StatusPill status={agent.status} />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Address</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={onCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <p className="break-all  text-[11px] leading-relaxed">
              {agent.address}
            </p>
          </div>

          <dl className="space-y-2 text-xs">
            <Row label="Chain" value={agent.chain} />
            <Row label="Asset" value={agent.currency} />
            <Row
              label="Daily left"
              value={`${formatAmt(agent.remainingDaily)} / ${formatAmt(agent.dailyLimit)}`}
            />
            <Row label="Per tx" value={formatAmt(agent.perTransaction)} />
            {agent.dailyPeriod ? (
              <Row label="Period" value={agent.dailyPeriod} />
            ) : null}
          </dl>

          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground">Daily budget</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground"
                style={{ width: `${remaining * 100}%` }}
              />
            </div>
          </div>

          <Allowlist label="Allowed hosts" items={agent.allowedHosts} />
          <Allowlist label="Allowed payees" items={agent.allowedPayees} />

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Fund on-chain {agent.currency} at this address. Policy snapshot is
            not an RPC balance.
          </p>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            {session === "connecting"
              ? "Creating the wallet for this API key…"
              : session === "ready"
                ? "This key is valid, but no wallet was created."
                : "Paste a console API key (xone_…) on the left and click Connect. That creates the wallet, then loads it."}
          </p>
          <a
            href={`${consoleUrl}/api-keys`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-foreground underline-offset-2 hover:underline"
          >
            Open console
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Optional allowlist preview.
 */
function Allowlist({ label, items }: { label: string; items?: string[] }) {
  const list = items ?? [];
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className=" text-[11px] leading-relaxed">
        {list.length === 0 ? "Any (public)" : list.join("\n")}
      </p>
    </div>
  );
}

/**
 * Site mark used in the playground sidebar.
 */
function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted">
        <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </div>
      <div>
        <p className="text-sm font-semibold tracking-tight">XOne SDK</p>
        <p className="text-[11px] text-muted-foreground">Playground</p>
      </div>
    </div>
  );
}

/**
 * Compact status chip.
 */
function StatusPill({ status }: { status: string }) {
  const ok = status === "active";
  return (
    <span
      className={cn(
        "shrink-0 rounded-md border px-2 py-0.5 text-[11px]",
        ok
          ? "border-border bg-muted"
          : "border-destructive/30 text-destructive",
      )}
    >
      {status}
    </span>
  );
}

/**
 * Definition list row.
 */
function Row({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right ">{value}</dd>
    </div>
  );
}

/**
 * @param n - Numeric amount
 * @returns Compact display string
 */
function formatAmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return String(n);
}

/**
 * SDK-shaped getSpendSnapshot() return.
 */
function toSpendSnapshot(agent: PlaygroundAgent) {
  return {
    currency: agent.currency,
    chain: agent.chain,
    address: agent.address,
    remainingDaily: agent.remainingDaily,
    dailyLimit: agent.dailyLimit,
    perTransaction: agent.perTransaction,
    status: agent.status,
    note: "Fund on-chain USDC at address; limits use remainingDaily / perTransaction",
  };
}

/**
 * SDK-shaped getLimits() return.
 */
function toLimits(agent: PlaygroundAgent) {
  return {
    dailyLimit: agent.dailyLimit,
    perTransaction: agent.perTransaction,
    remainingDaily: agent.remainingDaily,
    currency: agent.currency,
    dailyPeriod: agent.dailyPeriod,
    allowedHosts: agent.allowedHosts ?? [],
    allowedPayees: agent.allowedPayees ?? [],
  };
}

/**
 * Example snippet for the selected method.
 */
function snippetFor(id: MethodId, payUrl: string): string {
  const url = payUrl.trim() || DEFAULT_PAY_URL;
  const prefix = `import { XOne } from "@xonepay/sdk";

const xone = new XOne();
`;
  switch (id) {
    case "create":
      return `${prefix}
const agent = await xone.agent.create({
  apiKey: process.env.XONE_AGENT_TOKEN!,
  name: "agent",
  chain: "base-sepolia",
  dailyLimit: 10,
  perTransaction: 1,
});`;
    case "get":
      return `${prefix}
const agent = await xone.agent.get();`;
    case "getStatus":
      return `${prefix}
const agent = await xone.agent.get();
const status = agent?.getStatus();`;
    case "getAddress":
      return `${prefix}
const agent = await xone.agent.get();
const address = agent?.getAddress();`;
    case "getSpendSnapshot":
      return `${prefix}
const agent = await xone.agent.get();
const snap = await agent?.getSpendSnapshot();`;
    case "getLimits":
      return `${prefix}
const agent = await xone.agent.get();
const limits = await agent?.getLimits();`;
    case "getHistory":
      return `${prefix}
const agent = await xone.agent.get();
const history = await agent?.getHistory({ limit: 20 });`;
    case "pay":
      return `${prefix}
const agent = await xone.agent.get();
const result = await agent?.pay({
  url: "${url}",
  idempotencyKey: crypto.randomUUID(),
});`;
  }
}
