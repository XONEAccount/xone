import { useEffect, useMemo } from "react";
import { Bot } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
import { Badge } from "@/components/ui/badge";
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
import { useAgentListStore } from "@/stores/agent-list";

/**
 * Service List → Agent List — shared catalog; Chat uses enabled rows.
 */
export function AgentListPage() {
  const agents = useAgentListStore((s) => s.agents);
  const toggleEnabled = useAgentListStore((s) => s.toggleEnabled);
  const refreshCatalog = useAgentListStore((s) => s.refreshCatalog);
  const error = useAgentListStore((s) => s.error);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const sorted = useMemo(
    () => [...agents].sort((a, b) => a.name.localeCompare(b.name, "en")),
    [agents],
  );
  const pager = useClientPagination(sorted);
  const enabledCount = sorted.filter((a) => a.enabled).length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 animate-in">
      <PageHeader icon={Bot} title="Agent List" />
      {error ? (
        <p className="text-sm text-muted-foreground">
          Catalog refresh failed ({error}). Showing last known list.
        </p>
      ) : null}
      <Card className="fade-up">
        <CardHeader>
          <CardTitle>Available agents</CardTitle>
          <CardDescription>
            {sorted.length === 0
              ? "No agents yet"
              : `${sorted.length} total · ${enabledCount} enabled `}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <Empty className="border-0 py-10 md:py-12">
              <EmptyHeader>
                <EmptyTitle>No data</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.pageItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="max-w-90 text-sm text-muted-foreground">
                        {row.description}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={row.enabled}
                            onCheckedChange={() => toggleEnabled(row.id)}
                            aria-label={row.enabled ? "Enabled" : "Disabled"}
                          />
                          <Badge
                            variant={row.enabled ? "secondary" : "outline"}
                            className={
                              row.enabled
                                ? "capitalize"
                                : "border-border bg-muted text-muted-foreground capitalize"
                            }
                          >
                            {row.enabled ? "enabled" : "disabled"}
                          </Badge>
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
