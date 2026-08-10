import type { LucideIcon } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { getTxExplorerUrl } from "@wallet/config";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LedgerRecord } from "@/stores/a2a";
import { cn } from "@/lib/utils";

type LedgerTablePageProps = {
  icon: LucideIcon;
  title: string;
  emptyText: string;
  rows: LedgerRecord[];
  /** Show signed amount with + / - based on direction. */
  signedAmount?: boolean;
  /** Whether to show the title column (kept for A2A order labels). */
  showTitleColumn?: boolean;
};

/**
 * Shared ledger detail page rendered as a table.
 */
export function LedgerTablePage({
  icon,
  title,
  emptyText,
  rows,
  signedAmount = true,
  showTitleColumn = true,
}: LedgerTablePageProps) {
  return (
    <div className="w-full max-w-5xl space-y-6 animate-in md:mx-0">
      <PageHeader icon={icon} title={title} />

      <Card className="fade-up overflow-hidden">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {emptyText}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  {showTitleColumn ? <TableHead>标题</TableHead> : null}
                  <TableHead>对方</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>交易哈希</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <TableRow key={item.id} className="message-in">
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("zh-CN")}
                    </TableCell>
                    {showTitleColumn ? (
                      <TableCell className="font-medium">{item.title}</TableCell>
                    ) : null}
                    <TableCell className="max-w-40 truncate">{item.counterparty}</TableCell>
                    <TableCell className="font-mono whitespace-nowrap">
                      {signedAmount ? (item.direction === "in" ? "+" : "-") : ""}
                      {item.amount} {item.asset}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="max-w-60">
                      <TxHashCell note={item.note} />
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

/**
 * Renders a tx hash as an explorer link when possible.
 * @param note - Ledger note, usually a 0x hash
 */
function TxHashCell({ note }: { note: string }) {
  const hash = note.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    return (
      <span className="truncate text-muted-foreground" title={note}>
        {note}
      </span>
    );
  }

  return (
    <a
      href={getTxExplorerUrl(hash)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-1 font-mono text-xs text-(--color-foreground) underline-offset-2 hover:underline"
      title="在 Sepolia Etherscan 查看"
    >
      <span className="truncate">{shortHash(hash)}</span>
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
    </a>
  );
}

/**
 * Shortens a transaction hash for table display.
 * @param hash - Full tx hash
 */
function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

function StatusBadge({ status }: { status: LedgerRecord["status"] }) {
  const label =
    status === "success"
      ? "成功"
      : status === "blocked"
        ? "已拦截"
        : status === "pending"
          ? "处理中"
          : "失败";

  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs",
        status === "success"
          ? "bg-muted text-(--color-foreground)"
          : "bg-red-50 text-destructive",
      )}
    >
      {label}
    </span>
  );
}
