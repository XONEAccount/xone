import { Bot } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClientPagination } from "@/hooks/use-client-pagination";

/**
 * Agent List placeholder — empty table until catalog data is wired up.
 */
export function AgentListPage() {
  const rows: Array<{ id: string; name: string; description: string; status: string }> = [];
  const pager = useClientPagination(rows);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 animate-in">
      <PageHeader icon={Bot} title="Agent List" />
      <Card className="fade-up">
        <CardHeader>
          <CardTitle>可用 Agents</CardTitle>
          <CardDescription>暂无 Agent</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>功能介绍</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pager.pageItems.length === 0 ? (
                <TableEmpty colSpan={3} title="暂无数据" />
              ) : (
                pager.pageItems.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell>{row.status}</TableCell>
                  </TableRow>
                ))
              )}
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
        </CardContent>
      </Card>
    </div>
  );
}
