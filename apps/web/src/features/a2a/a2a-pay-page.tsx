import { useState, type FormEvent } from "react";
import {
  Hotel,
  Power,
  Save,
  TrainFront,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useA2AStore, type ConnectedAgent } from "@/stores/a2a";
import { cn } from "@/lib/utils";

const AGENT_ICONS: Record<string, LucideIcon> = {
  "agent-rail": TrainFront,
  "agent-hotel": Hotel,
  "agent-food": UtensilsCrossed,
};

/**
 * Agent list：已对接 Agent，并为每个 Agent 配置限额。
 */
export function A2APayPage() {
  const agents = useA2AStore((s) => s.agents);
  const setAgentEnabled = useA2AStore((s) => s.setAgentEnabled);
  const updateAgentLimits = useA2AStore((s) => s.updateAgentLimits);

  const [toast, setToast] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { maxAmount: string; maxSingle: string }>>(
    {},
  );

  /**
   * Shows a short-lived feedback banner.
   */
  function showToast(tone: "ok" | "err", text: string) {
    setToast({ tone, text });
    window.setTimeout(() => setToast(null), 2800);
  }

  /**
   * Returns editable draft limits for an agent, falling back to stored values.
   */
  function getDraft(agent: ConnectedAgent) {
    return (
      drafts[agent.id] ?? {
        maxAmount: String(agent.maxAmount),
        maxSingle: String(agent.maxSinglePayment),
      }
    );
  }

  /**
   * Persists limit fields for one agent to the database.
   */
  async function onSaveLimits(event: FormEvent, agent: ConnectedAgent) {
    event.preventDefault();
    const draft = getDraft(agent);
    const error = await updateAgentLimits(
      agent.id,
      Number(draft.maxAmount),
      Number(draft.maxSingle),
    );
    if (error) {
      showToast("err", error);
      return;
    }
    showToast("ok", `已更新 ${agent.name} 的限额`);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 animate-in">
      <PageHeader icon={WalletCards} title="Agent list" />

      {toast ? (
        <div
          className={cn(
            "message-in rounded-md border px-4 py-3 text-sm",
            toast.tone === "ok"
              ? "border-border bg-muted"
              : "border-[var(--color-destructive)]/30 bg-red-50 text-destructive",
          )}
          role="status"
        >
          {toast.text}
        </div>
      ) : null}

      <div className="space-y-4">
        {agents.map((agent, index) => {
          const draft = getDraft(agent);
          const Icon = AGENT_ICONS[agent.id] ?? WalletCards;
          return (
            <Card
              key={agent.id}
              className={cn(
                "hover-lift fade-up",
                index === 1 && "delay-1",
                index === 2 && "delay-2",
              )}
            >
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted">
                      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <CardTitle>{agent.name}</CardTitle>
                    <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {agent.category}
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs",
                        agent.enabled
                          ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {agent.enabled ? "已启用" : "已停用"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    已支出 {agent.spentAmount} / {agent.maxAmount} ETH
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={agent.enabled ? "outline" : "default"}
                  onClick={() => void setAgentEnabled(agent.id, !agent.enabled)}
                >
                  <Power className="h-3.5 w-3.5" aria-hidden />
                  {agent.enabled ? "停用" : "启用"}
                </Button>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-4 sm:grid-cols-2"
                  onSubmit={(e) => void onSaveLimits(e, agent)}
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor={`${agent.id}-max`}>
                      最大金额（ETH）
                    </label>
                    <Input
                      id={`${agent.id}-max`}
                      inputMode="decimal"
                      value={draft.maxAmount}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [agent.id]: { ...getDraft(agent), maxAmount: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor={`${agent.id}-single`}>
                      最大单笔支出（ETH）
                    </label>
                    <Input
                      id={`${agent.id}-single`}
                      inputMode="decimal"
                      value={draft.maxSingle}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [agent.id]: { ...getDraft(agent), maxSingle: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit">
                      <Save className="h-3.5 w-3.5" aria-hidden />
                      保存限额
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
