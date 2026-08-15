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
import type { DeveloperAgent } from "@wallet/types";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWalletAccount } from "@/hooks/use-wallet-account";
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
import { useX402AgentsStore } from "@/stores/x402-agents";
import { fetchTokenBalances, findDisplayBalance } from "@/web3";

const WELCOME: UIMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "你好。我会根据 **Agent List** 里已启用的 x402 服务判断该调用哪一个；若多个都能满足，会请你选择。支付时若有多个 Agent 钱包，也会请你选择。金额未超限额时自动付款，超过则需手动确认。例如：「查一下天气」。",
      },
    ],
  },
];

const HINTS = ["查一下天气", "现在有哪些 x402 服务？", "我的 Agent 钱包有哪些？"] as const;

/**
 * Whether messages contain real user/assistant turns beyond the welcome.
 * @param messages - UI messages
 */
function hasPersistedContent(messages: UIMessage[]): boolean {
  return messages.some(
    (m) => m.id !== "welcome" && (m.role === "user" || m.role === "assistant"),
  );
}

/**
 * Main 对话：Vercel AI SDK + 思考折叠 + x402/钱包 HITL 选择。
 */
export function ChatPage() {
  const { address } = useWalletAccount();
  const ownerAddress = address?.toLowerCase() ?? "";
  const x402Agents = useX402AgentsStore((s) => s.agents);
  const enabledX402 = useMemo(
    () => x402Agents.filter((a) => a.enabled),
    [x402Agents],
  );

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
    void listDeveloperAgents(ownerAddress)
      .then((rows) => {
        if (!cancelled) {
          setWallets(rows);
          setWalletsError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setWalletsError(err instanceof Error ? err.message : "加载钱包失败");
        }
      });

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
            err instanceof Error
              ? err.message
              : "云端会话加载失败，已尝试本地备份",
          );
        }
      }
      if (cancelled) return;
      const local = readLocalAssistantChat(ownerAddress);
      setInitialMessages(local && local.length > 0 ? local : WELCOME);
    })();

    return () => {
      cancelled = true;
    };
  }, [ownerAddress]);

  const walletKeys = wallets.map((w) => `${w.id}:${w.walletAddress}`).join("|");
  const balancesQuery = useQuery({
    queryKey: ["chat-agent-balances", walletKeys],
    enabled: wallets.length > 0,
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

  if (!ownerAddress) {
    return (
      <div className="mx-auto max-w-2xl animate-in">
        <PageHeader icon={MessageSquare} title="对话" />
        <p className="mt-4 text-sm text-muted-foreground">请先连接钱包。</p>
      </div>
    );
  }

  if (!initialMessages) {
    return (
      <div className="mx-auto max-w-2xl animate-in">
        <PageHeader icon={MessageSquare} title="对话" />
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          正在加载历史会话…
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
      onCleared={() => setInitialMessages(WELCOME)}
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
  onCleared: () => void;
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
  onCleared,
}: ChatPanelProps) {
  const apiUrl = getWebEnv().apiUrl;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const x402Ref = useRef(x402Services);
  x402Ref.current = x402Services;

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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    if (status !== "ready") return;
    if (!hasPersistedContent(messages)) return;

    writeLocalAssistantChat(ownerAddress, messages);

    const timer = window.setTimeout(() => {
      void saveAssistantChatSession(ownerAddress, messages)
        .then(() => setSaveHint("已保存"))
        .catch(() => setSaveHint("已存本地（云端暂不可用）"));
    }, 400);

    return () => window.clearTimeout(timer);
  }, [messages, status, ownerAddress]);

  /**
   * Sends the composer text.
   * @param event - Form submit
   */
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setSaveHint(null);
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
    setMessages(WELCOME);
    onCleared();
    setSaveHint(null);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 animate-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader icon={MessageSquare} title="对话" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void onClearHistory()}
        >
          清空会话
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-md border border-border px-2 py-1">
          x402 已启用 {x402Services.length}
        </span>
        <span className="rounded-md border border-border px-2 py-1">
          Agent 钱包 {wallets.length}
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
            会话
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
                思考与调用中…
              </p>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error.message}
              </p>
            ) : null}
          </div>

          <form className="flex gap-2" onSubmit={onSubmit}>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="例如：查一下天气"
              disabled={busy}
            />
            {busy ? (
              <Button type="button" variant="outline" onClick={() => stop()}>
                停止
              </Button>
            ) : null}
            <Button type="submit" disabled={busy || !input.trim()}>
              <SendHorizontal className="h-4 w-4" aria-hidden />
              发送
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {HINTS.map((hint) => (
              <Button
                key={hint}
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
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
                  title="选择 x402 服务"
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
              return (
                <ChoiceCard
                  key={`${message.id}-tool-${index}`}
                  title="选择 Agent 钱包"
                  question={input?.question}
                  options={(input?.candidates ?? []).map((c) => {
                    const agent = wallets.find((w) => w.id === c.id);
                    const asset = agent?.currency || agent?.asset || "USDC";
                    const balance = balancesLoading
                      ? "…"
                      : (balancesById[c.id] ?? "0");
                    const daily = agent?.dailyLimit ?? agent?.maxAmount ?? "—";
                    const perTx =
                      agent?.perTransaction ?? agent?.maxSinglePayment ?? "—";
                    return {
                      id: c.id,
                      title: c.name,
                      detail: `余额 ${balance} ${asset}`,
                      meta: `dailyLimit ${daily} · perTx ${perTx} ${asset}`,
                      icon: true,
                    };
                  })}
                  disabled={done || busy}
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
                    <p className="font-medium">支付超过限额，需手动确认</p>
                    <p className="text-xs text-muted-foreground">
                      报价超过该钱包的 perTransaction（单笔确认线）或剩余
                      dailyLimit。确认后将尝试支付。
                    </p>
                    <p className="text-xs text-muted-foreground">
                      钱包 {agent?.name ?? input?.agentId ?? "—"} · 余额{" "}
                      {balance} {asset}
                      {perTx != null ? ` · perTx ${perTx}` : ""}
                      {remaining != null
                        ? ` · 剩余 daily ${remaining}/${daily}`
                        : ""}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onApprovePay(approval.id, true)}
                      >
                        仍要支付
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onApprovePay(approval.id, false)}
                      >
                        取消
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
                  ? `已完成 \`${toolName}\``
                  : `正在调用 \`${toolName}\`…`}
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
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!streaming && text.trim()) {
      setOpen(false);
    }
  }, [streaming, text]);

  if (!text.trim()) return null;

  return (
    <div className="rounded-md border border-dashed border-border bg-white/80">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-muted-foreground"
        onClick={() => setOpen((v) => !open)}
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
        <span>{streaming ? "思考中…" : "思考过程"}</span>
      </button>
      {open ? (
        <p className="whitespace-pre-wrap border-t border-border px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
          {text}
        </p>
      ) : null}
    </div>
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
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(opt.id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-muted",
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
                      selected ? "text-background/80" : "text-muted-foreground",
                    )}
                  >
                    {opt.detail}
                  </span>
                  {opt.meta ? (
                    <span
                      className={cn(
                        "mt-0.5 block break-all font-mono text-[10px]",
                        selected ? "text-background/70" : "text-muted-foreground",
                      )}
                    >
                      {opt.meta}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
