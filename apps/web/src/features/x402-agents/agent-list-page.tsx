import { Bot } from "lucide-react";
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

/**
 * Agent List placeholder — empty table until catalog data is wired up.
 */
export function AgentListPage() {
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
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
