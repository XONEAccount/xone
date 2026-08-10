import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { Bot, Plus } from "lucide-react";
import type { AgentPayment, DeveloperAgent } from "@wallet/types";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DismissibleError } from "@/components/ui/dismissible-error";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDeveloperAgentDetail, listDeveloperAgents } from "@/lib/developer-api";
import { shortAddress } from "@/lib/address";

/**
 * Dedicated list of developer agents owned by the connected wallet.
 * Click a row to open payment history in a dialog.
 */
export function AgentsListPage() {
  const account = useActiveAccount();
  const owner = account?.address?.toLowerCase() ?? "";
  const [agents, setAgents] = useState<DeveloperAgent[]>([]);
  const [selected, setSelected] = useState<DeveloperAgent | null>(null);
  const [payments, setPayments] = useState<AgentPayment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!owner) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listDeveloperAgents(owner);
      setAgents(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Opens the payment-records dialog for one agent.
   * @param agent - Selected agent row
   */
  async function onOpenPayments(agent: DeveloperAgent) {
    if (!owner) return;
    setSelected(agent);
    setDialogOpen(true);
    setDetailLoading(true);
    setPayments([]);
    try {
      const detail = await getDeveloperAgentDetail(agent.id, owner);
      setPayments(detail.payments);
      setSelected(detail.agent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载明细失败");
      setDialogOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader icon={Bot} title="我的 Agents" />
        <Button asChild variant="outline">
          <Link to="/app/developers">
            <Plus className="size-4" />
            创建 Agent
          </Link>
        </Button>
      </div>
      <p className="-mt-4 max-w-2xl text-sm text-muted-foreground">
        当前钱包名下的受限 ETH Agent。点击一行查看支付记录弹窗。
      </p>

      {error ? <DismissibleError message={error} onDismiss={() => setError(null)} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Agent 列表</CardTitle>
          <CardDescription>
            {loading
              ? "加载中…"
              : agents.length === 0
                ? "还没有 Agent，先去创建一个。"
                : `${agents.length} 个 Agent`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>钱包</TableHead>
                  <TableHead>已用 / 上限</TableHead>
                  <TableHead>可用额度</TableHead>
                  <TableHead>API Key</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => void onOpenPayments(item)}
                  >
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {shortAddress(item.walletAddress)}
                    </TableCell>
                    <TableCell>
                      {item.spentAmount}/{item.maxAmount} ETH
                    </TableCell>
                    <TableCell>{item.allowanceEth} ETH</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.apiKeyPrefix}…
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>支付记录 · {selected?.name ?? "—"}</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <p className="text-sm text-muted-foreground">加载中…</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无机器支付记录。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>金额</TableHead>
                  <TableHead>收款人</TableHead>
                  <TableHead>商户</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>通道</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((pay) => (
                  <TableRow key={pay.id}>
                    <TableCell className="font-medium">
                      {pay.amount} {pay.asset}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-mono text-xs">{shortAddress(pay.recipient)}</p>
                        <p className="break-all font-mono text-[11px] text-muted-foreground">
                          {pay.recipient}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{pay.merchant ?? "—"}</TableCell>
                    <TableCell>{pay.status}</TableCell>
                    <TableCell>{pay.provider}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
