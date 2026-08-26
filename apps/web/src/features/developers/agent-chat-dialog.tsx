import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { Bot, LoaderCircle, SendHorizontal, UserRound } from "lucide-react";
import { Streamdown } from "streamdown";
import type { DeveloperAgent } from "@xone/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getWebEnv } from "@/lib/env";
import { cn } from "@/lib/utils";

const WELCOME_MESSAGES: UIMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "你好。我可以查询这个 Agent 的**钱包信息**和**消费记录**。例如：「当前余额多少？」「最近花了哪些钱？」",
      },
    ],
  },
];

type AgentChatDialogProps = {
  open: boolean;
  agent: DeveloperAgent | null;
  ownerAddress: string;
  onOpenChange: (open: boolean) => void;
};

/**
 * Developer-agent chat dialog powered by Vercel AI SDK + Streamdown.
 * @param props - Dialog visibility, agent context, owner wallet
 */
export function AgentChatDialog({
  open,
  agent,
  ownerAddress,
  onOpenChange,
}: AgentChatDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,720px)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
          <DialogTitle>对话 · {agent?.name ?? "—"}</DialogTitle>
          <DialogDescription>
            工具：钱包信息、消费记录
          </DialogDescription>
        </DialogHeader>
        {open && agent && ownerAddress ? (
          <AgentChatPanel
            key={`${agent.id}:${ownerAddress}`}
            agent={agent}
            ownerAddress={ownerAddress}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type AgentChatPanelProps = {
  agent: DeveloperAgent;
  ownerAddress: string;
};

/**
 * Inner chat panel remounted per agent so useChat state stays scoped.
 * @param props - Agent + owner
 */
function AgentChatPanel({ agent, ownerAddress }: AgentChatPanelProps) {
  const apiUrl = getWebEnv().apiUrl;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${apiUrl}/api/developer/agents/${agent.id}/chat`,
        headers: {
          Authorization: "Bearer demo",
        },
        body: {
          ownerAddress,
        },
      }),
    [apiUrl, agent.id, ownerAddress],
  );

  const { messages, sendMessage, status, error, stop } = useChat({
    transport,
    messages: WELCOME_MESSAGES,
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  /**
   * Sends the current input through AI SDK useChat.
   * @param event - Form submit
   */
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text });
  }

  return (
    <>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4"
      >
        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                isUser ? "flex-row-reverse" : "flex-row",
              )}
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border border-border",
                  isUser
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-100 text-foreground",
                )}
                aria-hidden
              >
                {isUser ? (
                  <UserRound className="size-4" />
                ) : (
                  <Bot className="size-4" />
                )}
              </div>

              <div
                className={cn(
                  "min-w-0 max-w-[85%] rounded-md border border-border px-3 py-2 text-sm",
                  isUser
                    ? "bg-neutral-950 text-white"
                    : "bg-neutral-50 text-foreground",
                )}
              >
                <div className="space-y-2">
                  {message.parts.map((part, index) => {
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
                            "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
                            "[&_th]:border [&_th]:border-border [&_th]:bg-neutral-100 [&_th]:px-2 [&_th]:py-1.5",
                            "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5",
                            "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
                            "[&_code]:rounded [&_code]:bg-neutral-200/80 [&_code]:px-1",
                            "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-neutral-900 [&_pre]:p-3 [&_pre]:text-neutral-100",
                          )}
                        >
                          <Streamdown isAnimating={busy && message.role === "assistant"}>
                            {part.text}
                          </Streamdown>
                        </div>
                      );
                    }

                    if (isToolUIPart(part)) {
                      const toolPart = part as {
                        type: string;
                        state?: string;
                      };
                      const toolName = toolPart.type.replace(/^tool-/, "");
                      const state = toolPart.state ?? "unknown";
                      return (
                        <p
                          key={`${message.id}-tool-${index}`}
                          className="text-xs text-muted-foreground"
                        >
                          {state === "output-available" || state === "result"
                            ? `已完成工具 \`${toolName}\``
                            : `正在调用工具 \`${toolName}\`…`}
                        </p>
                      );
                    }

                    return null;
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error.message}
          </p>
        ) : null}
      </div>

      <form
        className="flex shrink-0 items-center gap-2 border-t border-border px-6 py-4"
        onSubmit={onSubmit}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="问钱包余额、额度或消费记录…"
          disabled={busy || !ownerAddress}
          className="flex-1"
        />
        {busy ? (
          <Button type="button" variant="outline" onClick={() => stop()}>
            停止
          </Button>
        ) : null}
        <Button type="submit" disabled={busy || !input.trim()}>
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <SendHorizontal className="size-4" />
          )}
          发送
        </Button>
      </form>
    </>
  );
}
