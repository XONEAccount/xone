import { useMemo } from "react";
import { List } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { useX402AgentsStore } from "@/stores/x402-agents";

/**
 * Shared x402 Agent List — all users see the same catalog; only enable/disable.
 */
export function X402AgentsPage() {
  const agents = useX402AgentsStore((s) => s.agents);
  const toggleEnabled = useX402AgentsStore((s) => s.toggleEnabled);

  const sorted = useMemo(
    () => [...agents].sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
    [agents],
  );

  const pager = useClientPagination(sorted);
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
            <Empty className="border-0 py-10 md:py-12">
              <EmptyHeader>
                <EmptyTitle>暂无数据</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
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
                  {pager.pageItems.map((agent) => (
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
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={agent.enabled}
                            onCheckedChange={() => toggleEnabled(agent.id)}
                            aria-label={agent.enabled ? "已启用" : "已禁用"}
                          />
                          <span className="text-xs text-muted-foreground">
                            {agent.enabled ? "已启用" : "已禁用"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={pager.page}
                pageCount={pager.pageCount}
                total={pager.total}
                pageSize={pager.pageSize}
                canPrev={pager.canPrev}
                canNext={pager.canNext}
                onPrev={pager.onPrev}
                onNext={pager.onNext}
                onPageChange={pager.setPage}
                onPageSizeChange={pager.setPageSize}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
