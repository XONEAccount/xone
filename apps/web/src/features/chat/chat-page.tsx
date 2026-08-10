import { useState, type FormEvent } from "react";
import {
  Bot,
  Hotel,
  LoaderCircle,
  MessageSquare,
  SendHorizontal,
  ShieldAlert,
  ShieldCheck,
  TrainFront,
  UtensilsCrossed,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { matchAgentIntent, quoteFromAgent } from "@/features/chat/agent-router";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useA2AStore } from "@/stores/a2a";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: {
    agentName: string;
    title: string;
    quotedAmount: string;
    status: "success" | "blocked" | "failed";
    detail: string;
  };
};

const HINTS = [
  { text: "买上海到杭州的车票", icon: TrainFront },
  { text: "订一晚酒店", icon: Hotel },
  { text: "点一份外卖", icon: UtensilsCrossed },
] as const;

/**
 * 对话页：识别购票等意图后自动调用对接 Agent，并由对方动态报价结算。
 */
export function ChatPage() {
  const agents = useA2AStore((s) => s.agents);
  const settleAgentPayment = useA2AStore((s) => s.settleAgentPayment);

  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "直接说需求即可，例如「帮我买一张上海到杭州的高铁票」。我会自动调用已对接的 Agent，由对方报价后按你的限额支付。",
    },
  ]);

  /**
   * Handles a user message: route intent → agent quote → policy settle.
   */
  async function onSend(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || pending) return;

    setInput("");
    setPending(true);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: text },
    ]);

    const intent = matchAgentIntent(text);
    if (!intent) {
      try {
        const result = await apiFetch<{ reply: string }>("/api/agents/chat", {
          method: "POST",
          body: { message: text },
        });
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.reply,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "助手暂时连不上。也可直接说车票、酒店、外卖相关需求，或先到商家列表确认 Agent 已启用。",
          },
        ]);
      }
      setPending(false);
      return;
    }

    const agent = agents.find((item) => item.id === intent.agentId);
    if (!agent) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "未找到对应 Agent，请检查商家列表。",
        },
      ]);
      setPending(false);
      return;
    }

    if (!agent.enabled) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `${agent.name} 当前未启用。请到商家列表启用后再试。`,
        },
      ]);
      setPending(false);
      return;
    }

    const quoted = quoteFromAgent(agent, intent.amountHint);
    const result = await settleAgentPayment(agent.id, quoted, intent.title);
    const status: "success" | "blocked" | "failed" = result.ok
      ? "success"
      : result.message.includes("拦截")
        ? "blocked"
        : "failed";

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.ok
          ? `已调用 ${agent.name}${intent.routeHint ? `（${intent.routeHint}）` : ""}，对方返回动态报价并完成结算。`
          : `已调用 ${agent.name}，但支付未通过策略校验。`,
        action: {
          agentName: agent.name,
          title: intent.title,
          quotedAmount: quoted.toFixed(6),
          status,
          detail: result.message,
        },
      },
    ]);
    setPending(false);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 animate-in">
      <PageHeader icon={MessageSquare} title="对话" />

      <Card className="min-h-[520px] fade-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            会话
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex min-h-[320px] flex-col gap-3 overflow-y-auto">
            {messages.map((message) => (
              <div key={message.id} className="message-in space-y-2">
                <div
                  className={
                    message.role === "user"
                      ? "ml-8 rounded-md bg-[var(--color-foreground)] px-3 py-2 text-sm text-[var(--color-background)]"
                      : "mr-8 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
                  }
                >
                  {message.content}
                </div>
                {message.action ? (
                  <div className="mr-8 rounded-md border border-[var(--color-border)] bg-muted p-3 text-sm">
                    <p className="flex items-center gap-2 font-medium">
                      {message.action.status === "success" ? (
                        <ShieldCheck className="h-4 w-4" aria-hidden />
                      ) : (
                        <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden />
                      )}
                      {message.action.title}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Agent：{message.action.agentName}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="font-mono">报价 {message.action.quotedAmount} ETH</span>
                      <span
                        className={cn(
                          "text-xs",
                          message.action.status === "success"
                            ? "text-muted-foreground"
                            : "text-destructive",
                        )}
                      >
                        {message.action.status === "success"
                          ? "已支付"
                          : message.action.status === "blocked"
                            ? "已拦截"
                            : "失败"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {message.action.detail}
                    </p>
                  </div>
                ) : null}
              </div>
            ))}
            {pending ? (
              <p className="mr-8 flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                <span className="pulse-soft">正在呼叫对方 Agent…</span>
              </p>
            ) : null}
          </div>

          <form className="flex gap-2" onSubmit={onSend}>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="例如：帮我买一张上海到杭州的高铁票"
              disabled={pending}
            />
            <Button type="submit" disabled={pending}>
              <SendHorizontal className="h-4 w-4" aria-hidden />
              发送
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {HINTS.map((hint) => {
              const Icon = hint.icon;
              return (
                <Button
                  key={hint.text}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="hover-lift"
                  disabled={pending}
                  onClick={() => setInput(hint.text)}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {hint.text}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
