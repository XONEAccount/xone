import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isReasoningUIPart,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import {
  Bot,
  ChevronDown,
  LoaderCircle,
  MessageSquare,
  SendHorizontal,
  UserRound,
  Wallet,
} from "lucide-react";
import { Streamdown } from "streamdown";
import type { DeveloperAgent } from "@xone/types";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { useI18n } from "@/hooks/use-i18n";
import {
  clearAssistantChatSession,
  clearLocalAssistantChat,
  loadAssistantChatSession,
  readLocalAssistantChat,
  saveAssistantChatSession,
  writeLocalAssistantChat,
} from "@/lib/assistant-chat-api";
import { listDeveloperAgents } from "@/lib/developer-api";
import { getWebEnv } from "@/lib/env";
import { cn } from "@/lib/utils";
import { useAgentListStore } from "@/stores/agent-list";
import { useX402AgentsStore } from "@/stores/x402-agents";
import { fetchTokenBalances, findDisplayBalance } from "@/web3";

/**
 * Builds the locale-aware welcome message.
 * @param text - Welcome body
 */
function buildWelcome(text: string): UIMessage[] {
  return [
    {
      id: "welcome",
      role: "assistant",
      parts: [{ type: "text", text }],
    },
  ];
}

/**
 * Whether messages contain real user/assistant turns beyond the welcome.
 * @param messages - Chat messages
 */
function hasPersistedContent(messages: UIMessage[]): boolean {
  return messages.some(
    (m) => m.id !== "welcome" && (m.role === "user" || m.role === "assistant"),
  );
}

const HITL_TOOLS = new Set(["request_x402_choice", "request_wallet_choice"]);

/**
 * True when a client-side HITL tool is waiting for addToolOutput.
 * @param messages - Chat messages
 */
function hasPendingHitlTool(messages: UIMessage[]): boolean {
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (!isToolUIPart(part)) continue;
      const name = getToolName(part);
      if (!HITL_TOOLS.has(name)) continue;
      if (
        part.state === "input-available" ||
        part.state === "input-streaming" ||
        part.state === "approval-requested"
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Maps SDK errors into clearer chat copy.
 * @param message - Raw error message
 * @param t - Translator
 */
function friendlyChatError(
  message: string,
  t: (key: import("@/lib/i18n/messages").MessageKey) => string,
): string {
  if (/Tool result is missing|MissingToolResults/i.test(message)) {
    return t("chat.missingToolResult");
  }
  return message;
}

/**
 * Main chat: Vercel AI SDK + reasoning fold + x402/wallet HITL.
 */
export function ChatPage() {
  const { t } = useI18n();
  const { address } = useWalletAccount();
  const ownerAddress = address?.toLowerCase() ?? "";
  const x402Agents = useX402AgentsStore((s) => s.agents);
  const catalogAgents = useAgentListStore((s) => s.agents);
  const refreshX402Catalog = useX402AgentsStore((s) => s.refreshCatalog);
  const refreshAgentCatalog = useAgentListStore((s) => s.refreshCatalog);

  useEffect(() => {
    void refreshX402Catalog();
    void refreshAgentCatalog();
  }, [refreshX402Catalog, refreshAgentCatalog]);

  const enabledX402 = useMemo(() => {
    const fromX402 = x402Agents.filter((a) => a.enabled);
    const fromAgents = catalogAgents.filter((a) => a.enabled);
    const byId = new Map<string, (typeof fromX402)[number]>();
    for (const row of [...fromX402, ...fromAgents]) {
      byId.set(row.id, row);
    }
    return [...byId.values()];
  }, [x402Agents, catalogAgents]);
  const welcome = useMemo(() => buildWelcome(t("chat.welcome")), [t]);

  const [wallets, setWallets] = useState<DeveloperAgent[]>([]);
  const [walletsError, setWalletsError] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(
    null,
  );
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerAddress) {
      setWallets([]);
      setInitialMessages(null);
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const fromDb = await loadAssistantChatSession(ownerAddress);
        if (cancelled) return;
        if (fromDb.length > 0) {
          setInitialMessages(fromDb);
          writeLocalAssistantChat(ownerAddress, fromDb);
          setHistoryError(null);
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setHistoryError(
            err instanceof Error ? err.message : t("chat.historyFailed"),
          );
        }
      }
      if (cancelled) return;
      const local = readLocalAssistantChat(ownerAddress);
      setInitialMessages(local && local.length > 0 ? local : welcome);
    })();

    return () => {
      cancelled = true;
    };
  }, [ownerAddress, welcome, t]);

  const walletKeys = wallets.map((w) => `${w.id}:${w.walletAddress}`).join("|");
  const balancesQuery = useQuery({
    queryKey: ["chat-agent-balances", walletKeys],
    enabled: wallets.length > 0,
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
    queryFn: async () => {
      const entries = await Promise.all(
        wallets.map(async (agent) => {
          const balances = await fetchTokenBalances(agent.walletAddress);
          return [agent.id, findDisplayBalance(balances, agent.asset)] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, string>;
    },
  });

  /**
   * Reloads agent rows (status / allowance) so pause/resume is reflected promptly.
   */
  useEffect(() => {
    if (!ownerAddress) {
      setWallets([]);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      void listDeveloperAgents(ownerAddress)
        .then((rows) => {
          if (!cancelled) {
            setWallets(rows);
            setWalletsError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setWalletsError(
              err instanceof Error ? err.message : t("chat.loadWalletsFailed"),
            );
          }
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [ownerAddress, t]);

  /**
   * Forces a fresh wallet list + on-chain balances before the next assistant turn.
   */
  async function refreshWalletsBeforeSend(): Promise<void> {
    if (!ownerAddress) return;
    try {
      const rows = await listDeveloperAgents(ownerAddress);
      setWallets(rows);
      setWalletsError(null);
    } catch (err) {
      setWalletsError(
        err instanceof Error ? err.message : t("chat.loadWalletsFailed"),
      );
    }
    await balancesQuery.refetch();
  }

  if (!ownerAddress) {
    return (
      <div className="mx-auto max-w-2xl animate-in">
        <PageHeader icon={MessageSquare} title={t("chat.title")} />
        <p className="mt-4 text-sm text-muted-foreground">{t("chat.connectFirst")}</p>
      </div>
    );
  }

  if (!initialMessages) {
    return (
      <div className="mx-auto max-w-2xl animate-in">
        <PageHeader icon={MessageSquare} title={t("chat.title")} />
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          {t("chat.loadingHistory")}
        </p>
      </div>
    );
  }

  return (
    <ChatPanel
      key={ownerAddress}
      ownerAddress={ownerAddress}
      x402Services={enabledX402}
      wallets={wallets}
      walletsError={walletsError}
      historyError={historyError}
      balancesById={balancesQuery.data ?? {}}
      balancesLoading={balancesQuery.isLoading || balancesQuery.isFetching}
      initialMessages={initialMessages}
      welcome={welcome}
      onCleared={() => setInitialMessages(welcome)}
      onBeforeSend={refreshWalletsBeforeSend}
    />
  );
}

type ChatPanelProps = {
  ownerAddress: string;
  x402Services: Array<{
    id: string;
    name: string;
    url: string;
    description: string;
    enabled: boolean;
  }>;
  wallets: DeveloperAgent[];
  walletsError: string | null;
  historyError: string | null;
  balancesById: Record<string, string>;
  balancesLoading: boolean;
  initialMessages: UIMessage[];
  welcome: UIMessage[];
  onCleared: () => void;
  onBeforeSend: () => Promise<void>;
};

/**
 * Inner chat remounted per owner so transport body stays in sync.
 * @param props - Owner, catalog, wallets, restored messages
 */
function ChatPanel({
  ownerAddress,
  x402Services,
  wallets,
  walletsError,
  historyError,
  balancesById,
  balancesLoading,
  initialMessages,
  welcome,
  onCleared,
  onBeforeSend,
}: ChatPanelProps) {
  const { t } = useI18n();
  const apiUrl = getWebEnv().apiUrl;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const x402Ref = useRef(x402Services);
  x402Ref.current = x402Services;
  const autoResolvedTools = useRef(new Set<string>());

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${apiUrl}/api/agents/assistant/chat`,
        headers: { Authorization: "Bearer demo" },
        body: {
          ownerAddress,
        },
        prepareSendMessagesRequest: ({ id, messages, body, headers, credentials, api }) => ({
          api,
          headers,
          credentials,
          body: {
            ...(body ?? {}),
            id,
            messages,
            ownerAddress,
            x402Services: x402Ref.current,
          },
        }),
      }),
    [apiUrl, ownerAddress],
  );

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    error,
    stop,
    addToolOutput,
    addToolApprovalResponse,
  } = useChat({
    transport,
    messages: initialMessages,
    sendAutomaticallyWhen: ({ messages: msgs }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages: msgs }) ||
      lastAssistantMessageIsCompleteWithApprovalResponses({ messages: msgs }),
  });

  const busy = status === "submitted" || status === "streaming";
  const awaitingHitl = hasPendingHitlTool(messages);
  const composerLocked = busy || awaitingHitl;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  /**
   * If wallet picker has no fundable candidates, resolve the HITL tool so chat is not stuck.
   */
  useEffect(() => {
    if (balancesLoading) return;
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        if (!isToolUIPart(part)) continue;
        if (getToolName(part) !== "request_wallet_choice") continue;
        if (part.state !== "input-available") continue;
        const input = part.input as {
          candidates?: Array<{ id: string }>;
        };
        const candidates = input?.candidates ?? [];
        const fundable = candidates.filter((c) => {
          const agent = wallets.find((w) => w.id === c.id);
          const bal = Number(balancesById[c.id] ?? "0");
          const allowance = agent?.allowanceEth ?? 0;
          return (
            agent?.status === "active" &&
            allowance > 0 &&
            Number.isFinite(bal) &&
            bal > 0
          );
        });
        if (candidates.length > 0 && fundable.length === 0) {
          if (autoResolvedTools.current.has(part.toolCallId)) continue;
          autoResolvedTools.current.add(part.toolCallId);
          void addToolOutput({
            tool: "request_wallet_choice",
            toolCallId: part.toolCallId,
            state: "output-error",
            errorText: t("chat.pickWalletEmpty"),
          });
        }
      }
    }
  }, [
    messages,
    wallets,
    balancesById,
    balancesLoading,
    addToolOutput,
    t,
  ]);

  useEffect(() => {
    if (status !== "ready") return;
    if (!hasPersistedContent(messages)) return;

    writeLocalAssistantChat(ownerAddress, messages);

    const timer = window.setTimeout(() => {
      void saveAssistantChatSession(ownerAddress, messages)
        .then(() => setSaveHint(t("chat.saved")))
        .catch(() => setSaveHint(t("chat.savedLocal")));
    }, 400);

    return () => window.clearTimeout(timer);
  }, [messages, status, ownerAddress, t]);

  /**
   * Sends the composer text after refreshing wallet status/balances.
   * @param event - Form submit
   */
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || composerLocked) return;
    setInput("");
    setSaveHint(null);
    await onBeforeSend();
    void sendMessage({ text });
  }

  /**
   * Clears cloud + local history and resets to welcome.
   */
  async function onClearHistory() {
    if (busy) return;
    try {
      await clearAssistantChatSession(ownerAddress);
    } catch {
      // Table may not exist yet — still clear local.
    }
    clearLocalAssistantChat(ownerAddress);
    setMessages(welcome);
    onCleared();
    setSaveHint(null);
  }

  const hints = [
    t("chat.hint.weather"),
    t("chat.hint.services"),
    t("chat.hint.wallets"),
  ] as const;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 animate-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader icon={MessageSquare} title={t("chat.title")} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void onClearHistory()}
        >
          {t("chat.clear")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-md border border-border px-2 py-1">
          {t("chat.x402Enabled", { count: x402Services.length })}
        </span>
        <span className="rounded-md border border-border px-2 py-1">
          {t("chat.agentWallets", { count: wallets.length })}
        </span>
        {saveHint ? (
          <span className="rounded-md border border-border px-2 py-1">{saveHint}</span>
        ) : null}
        {walletsError ? (
          <span className="text-destructive">{walletsError}</span>
        ) : null}
        {historyError ? (
          <span className="text-destructive">{historyError}</span>
        ) : null}
      </div>

      <Card className="fade-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {t("chat.session")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div
            ref={scrollRef}
            className="flex min-h-[360px] max-h-[560px] flex-col gap-3 overflow-y-auto"
          >
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                busy={busy}
                wallets={wallets}
                balancesById={balancesById}
                balancesLoading={balancesLoading}
                onPickX402={(toolCallId, selectedId) => {
                  void addToolOutput({
                    tool: "request_x402_choice",
                    toolCallId,
                    output: { selectedId },
                  });
                }}
                onPickWallet={(toolCallId, selectedId) => {
                  void addToolOutput({
                    tool: "request_wallet_choice",
                    toolCallId,
                    output: { selectedId },
                  });
                }}
                onApprovePay={(approvalId, approved) => {
                  void addToolApprovalResponse({ id: approvalId, approved });
                }}
              />
            ))}
            {busy ? (
              <p className="mr-8 flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                {t("chat.thinking")}
              </p>
            ) : null}
            {awaitingHitl && !busy ? (
              <p className="text-xs text-muted-foreground">{t("chat.awaitingChoice")}</p>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {friendlyChatError(error.message, t)}
              </p>
            ) : null}
          </div>

          <form className="flex gap-2" onSubmit={onSubmit}>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("chat.placeholder")}
              disabled={composerLocked}
            />
            {busy ? (
              <Button type="button" variant="outline" onClick={() => stop()}>
                {t("chat.stop")}
              </Button>
            ) : null}
            <Button type="submit" disabled={composerLocked || !input.trim()}>
              <SendHorizontal className="h-4 w-4" aria-hidden />
              {t("chat.send")}
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {hints.map((hint) => (
              <Button
                key={hint}
                type="button"
                size="sm"
                variant="outline"
                disabled={composerLocked}
                onClick={() => setInput(hint)}
              >
                {hint}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type MessageBubbleProps = {
  message: UIMessage;
  busy: boolean;
  wallets: DeveloperAgent[];
  balancesById: Record<string, string>;
  balancesLoading: boolean;
  onPickX402: (toolCallId: string, selectedId: string) => void;
  onPickWallet: (toolCallId: string, selectedId: string) => void;
  onApprovePay: (approvalId: string, approved: boolean) => void;
};

/**
 * Renders one chat message including reasoning + HITL tool cards.
 * @param props - Message + handlers
 */
function MessageBubble({
  message,
  busy,
  wallets,
  balancesById,
  balancesLoading,
  onPickX402,
  onPickWallet,
  onApprovePay,
}: MessageBubbleProps) {
  const { t } = useI18n();
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "message-in flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full border border-border",
          isUser ? "bg-neutral-950 text-white" : "bg-neutral-100 text-foreground",
        )}
        aria-hidden
      >
        {isUser ? <UserRound className="size-4" /> : <Bot className="size-4" />}
      </div>

      <div
        className={cn(
          "min-w-0 max-w-[90%] space-y-2 rounded-md border border-border px-3 py-2 text-sm",
          isUser ? "bg-neutral-950 text-white" : "bg-neutral-50 text-foreground",
        )}
      >
        {message.parts.map((part, index) => {
          if (isReasoningUIPart(part)) {
            return (
              <ThinkingBlock
                key={`${message.id}-r-${index}`}
                text={part.text}
                streaming={busy && message.role === "assistant"}
              />
            );
          }

          if (part.type === "text") {
            if (isUser) {
              return (
                <p
                  key={`${message.id}-t-${index}`}
                  className="whitespace-pre-wrap leading-relaxed"
                >
                  {part.text}
                </p>
              );
            }
            return (
              <div
                key={`${message.id}-t-${index}`}
                className={cn(
                  "streamdown-chat",
                  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
                  "[&_code]:rounded [&_code]:bg-neutral-200/80 [&_code]:px-1",
                )}
              >
                <Streamdown isAnimating={busy && message.role === "assistant"}>
                  {part.text}
                </Streamdown>
              </div>
            );
          }

          if (isToolUIPart(part)) {
            const toolName = getToolName(part);
            const toolCallId = part.toolCallId;
            const state = part.state;

            if (toolName === "request_x402_choice") {
              const input = part.input as {
                question?: string;
                candidates?: Array<{
                  id: string;
                  name: string;
                  url: string;
                  reason: string;
                }>;
              };
              const done = state === "output-available" || state === "output-error";
              const selected =
                state === "output-available"
                  ? (part.output as { selectedId?: string } | undefined)?.selectedId
                  : undefined;
              return (
                <ChoiceCard
                  key={`${message.id}-tool-${index}`}
                  title={t("chat.pickX402")}
                  question={input?.question}
                  options={(input?.candidates ?? []).map((c) => ({
                    id: c.id,
                    title: c.name,
                    detail: c.reason,
                    meta: c.url,
                  }))}
                  disabled={done || busy}
                  selectedId={selected}
                  onSelect={(id) => onPickX402(toolCallId, id)}
                />
              );
            }

            if (toolName === "request_wallet_choice") {
              const input = part.input as {
                question?: string;
                candidates?: Array<{
                  id: string;
                  name: string;
                  maxAmount?: number;
                  reason?: string;
                }>;
              };
              const done = state === "output-available" || state === "output-error";
              const selected =
                state === "output-available"
                  ? (part.output as { selectedId?: string } | undefined)?.selectedId
                  : undefined;
              const options = (input?.candidates ?? [])
                .map((c) => {
                  const agent = wallets.find((w) => w.id === c.id);
                  const asset = agent?.currency || agent?.asset || "USDC";
                  const balanceRaw = balancesById[c.id] ?? "0";
                  const balanceNum = Number(balanceRaw);
                  const allowance = agent?.allowanceEth ?? 0;
                  const hasFunds =
                    agent?.status === "active" &&
                    allowance > 0 &&
                    (balancesLoading || (Number.isFinite(balanceNum) && balanceNum > 0));
                  if (!hasFunds) return null;
                  const balance = balancesLoading ? "…" : balanceRaw;
                  const daily = agent?.dailyLimit ?? agent?.maxAmount ?? "—";
                  const perTx =
                    agent?.perTransaction ?? agent?.maxSinglePayment ?? "—";
                  return {
                    id: c.id,
                    title: c.name,
                    detail: t("chat.balance", { balance, asset }),
                    meta: `dailyLimit ${daily} · perTx ${perTx} ${asset}`,
                    icon: true,
                  };
                })
                .filter((o): o is NonNullable<typeof o> => o != null);
              return (
                <ChoiceCard
                  key={`${message.id}-tool-${index}`}
                  title={t("chat.pickWallet")}
                  question={
                    options.length === 0 ? t("chat.pickWalletEmpty") : input?.question
                  }
                  options={options}
                  disabled={done || busy || options.length === 0}
                  selectedId={selected}
                  onSelect={(id) => onPickWallet(toolCallId, id)}
                />
              );
            }

            if (toolName === "pay_x402") {
              const approval = "approval" in part ? part.approval : undefined;
              const input = part.input as
                | { x402Id?: string; agentId?: string }
                | undefined;
              if (state === "approval-requested" && approval) {
                const agent = wallets.find((w) => w.id === input?.agentId);
                const asset = agent?.currency || agent?.asset || "USDC";
                const balance = balancesLoading
                  ? "…"
                  : (balancesById[input?.agentId ?? ""] ?? "0");
                const daily = agent?.dailyLimit ?? agent?.maxAmount;
                const perTx = agent?.perTransaction ?? agent?.maxSinglePayment;
                const remaining =
                  agent && daily != null
                    ? Math.max(0, daily - agent.spentAmount)
                    : null;
                return (
                  <div
                    key={`${message.id}-tool-${index}`}
                    className="space-y-2 rounded-md border border-border bg-white p-3"
                  >
                    <p className="font-medium">{t("chat.payOverLimitTitle")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("chat.payOverLimitBody")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("chat.payWalletLine", {
                        name: agent?.name ?? input?.agentId ?? "—",
                        balance: `${balance} ${asset}`,
                      })}
                      {perTx != null ? ` · perTx ${perTx}` : ""}
                      {remaining != null
                        ? t("chat.payDailyRemaining", {
                            remaining,
                            daily: daily ?? "—",
                          })
                        : ""}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onApprovePay(approval.id, true)}
                      >
                        {t("chat.payAnyway")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onApprovePay(approval.id, false)}
                      >
                        {t("chat.cancel")}
                      </Button>
                    </div>
                  </div>
                );
              }
            }

            return (
              <p
                key={`${message.id}-tool-${index}`}
                className="text-xs text-muted-foreground"
              >
                {state === "output-available"
                  ? t("chat.toolDone", { tool: toolName })
                  : t("chat.toolRunning", { tool: toolName })}
              </p>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

type ThinkingBlockProps = {
  text: string;
  streaming: boolean;
};

/**
 * Collapsible reasoning: open while streaming, collapsed when finished.
 * @param props - Reasoning text + stream flag
 */
function ThinkingBlock({ text, streaming }: ThinkingBlockProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!streaming && text.trim()) {
      setOpen(false);
    }
  }, [streaming, text]);

  if (!text.trim()) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-md border border-dashed border-border bg-white/80"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-muted-foreground">
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
        <span>
          {streaming ? t("chat.reasoningStreaming") : t("chat.reasoning")}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="whitespace-pre-wrap border-t border-border px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
          {text}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

type ChoiceCardProps = {
  title: string;
  question?: string;
  options: Array<{
    id: string;
    title: string;
    detail: string;
    meta?: string;
    icon?: boolean;
  }>;
  disabled: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
};

/**
 * HITL picker card for x402 or wallet selection.
 * @param props - Options + select handler
 */
function ChoiceCard({
  title,
  question,
  options,
  disabled,
  selectedId,
  onSelect,
}: ChoiceCardProps) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-white p-3">
      <p className="font-medium">{title}</p>
      {question ? (
        <p className="text-xs text-muted-foreground">{question}</p>
      ) : null}
      <ul className="space-y-2">
        {options.map((opt) => {
          const selected = selectedId === opt.id;
          return (
            <li key={opt.id}>
              <Button
                type="button"
                variant={selected ? "default" : "outline"}
                disabled={disabled}
                onClick={() => onSelect(opt.id)}
                className={cn(
                  "h-auto w-full items-start justify-start gap-2 px-3 py-2 text-left whitespace-normal",
                  disabled && !selected && "opacity-60",
                )}
              >
                {opt.icon ? (
                  <Wallet className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{opt.title}</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-xs",
                      selected ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {opt.detail}
                  </span>
                  {opt.meta ? (
                    <span
                      className={cn(
                        "mt-0.5 block break-all font-mono text-[10px]",
                        selected ? "text-primary-foreground/70" : "text-muted-foreground",
                      )}
                    >
                      {opt.meta}
                    </span>
                  ) : null}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
