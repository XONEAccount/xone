import { useEffect, useMemo } from "react";
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
import { useI18n } from "@/hooks/use-i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { useX402AgentsStore } from "@/stores/x402-agents";

/**
 * Resolves localized catalog name / description by agent id.
 * @param t - Translator
 * @param id - Catalog id
 * @param field - name | description
 * @param fallback - Store fallback string
 */
function catalogCopy(
  t: (key: MessageKey) => string,
  id: string,
  field: "name" | "description",
  fallback: string,
): string {
  const key = `x402.catalog.${id}.${field}` as MessageKey;
  const value = t(key);
  return value === key ? fallback : value;
}

/**
 * Shared x402 Agent List — all users see the same catalog; only enable/disable.
 */
export function X402AgentsPage() {
  const { t, locale } = useI18n();
  const agents = useX402AgentsStore((s) => s.agents);
  const toggleEnabled = useX402AgentsStore((s) => s.toggleEnabled);
  const refreshCatalog = useX402AgentsStore((s) => s.refreshCatalog);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const sorted = useMemo(
    () =>
      [...agents].sort((a, b) =>
        catalogCopy(t, a.id, "name", a.name).localeCompare(
          catalogCopy(t, b.id, "name", b.name),
          locale === "zh" ? "zh-CN" : "en",
        ),
      ),
    [agents, t, locale],
  );

  const pager = useClientPagination(sorted);
  const enabledCount = sorted.filter((a) => a.enabled).length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 animate-in">
      <PageHeader icon={List} title={t("x402.title")} tone="sky" />

      <Card className="fade-up">
        <CardHeader>
          <CardTitle>{t("x402.cardTitle")}</CardTitle>
          <CardDescription>
            {sorted.length === 0
              ? t("x402.empty")
              : t("x402.count", { total: sorted.length, enabled: enabledCount })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <Empty className="border-0 py-10 md:py-12">
              <EmptyHeader>
                <EmptyTitle>{t("x402.noData")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("x402.colName")}</TableHead>
                    <TableHead>{t("x402.colDescription")}</TableHead>
                    <TableHead>{t("x402.colUrl")}</TableHead>
                    <TableHead className="w-[7rem]">{t("x402.colStatus")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.pageItems.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">
                        {catalogCopy(t, agent.id, "name", agent.name)}
                      </TableCell>
                      <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                        {catalogCopy(t, agent.id, "description", agent.description)}
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
                            aria-label={
                              agent.enabled ? t("x402.enabled") : t("x402.disabled")
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            {agent.enabled ? t("x402.enabled") : t("x402.disabled")}
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
