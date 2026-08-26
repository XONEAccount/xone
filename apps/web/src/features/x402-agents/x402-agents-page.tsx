import { useMemo } from "react";
import { List } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useX402AgentsStore } from "@/stores/x402-agents";

/**
 * Shared x402 Agent List — all users see the same catalog; only enable/disable.
 */
export function X402AgentsPage() {
  const agents = useX402AgentsStore((s) => s.agents);
  const toggleEnabled = useX402AgentsStore((s) => s.toggleEnabled);

  const sorted = useMemo(
    () =>
      [...agents].sort((a, b) =>
        a.name.localeCompare(b.name, "zh-CN"),
      ),
    [agents],
  );

  const enabledCount = sorted.filter((a) => a.enabled).length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 animate-in">
      <PageHeader icon={List} title="X402 List" />

      <Card className="fade-up">
        <CardHeader>
          <CardTitle>可用服务</CardTitle>
          <CardDescription>
            {sorted.length === 0
              ? "暂无服务"
              : `共 ${sorted.length} 个 · 已启用 ${enabledCount} 个`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>功能介绍</TableHead>
                  <TableHead>x402 URL</TableHead>
                  <TableHead className="w-[7rem]">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                      {agent.description}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <a
                        href={agent.url}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-xs text-muted-foreground underline-offset-2 hover:underline"
                      >
                        {agent.url}
                      </a>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => toggleEnabled(agent.id)}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs transition-colors",
                          agent.enabled
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground",
                        )}
                        aria-pressed={agent.enabled}
                      >
                        {agent.enabled ? "已启用" : "已禁用"}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
