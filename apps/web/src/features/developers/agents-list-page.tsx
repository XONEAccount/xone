import { useCallback, useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { getAddressExplorerUrl } from "@wallet/config";
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { Bot, ExternalLink, Plus } from "lucide-react";
import type { AgentPayment, DeveloperAgent } from "@wallet/types";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DismissibleError } from "@/components/ui/dismissible-error";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AgentChatDialog } from "@/features/developers/agent-chat-dialog";
import {
  deleteDeveloperAgent,
  getDeveloperAgentDetail,
  listDeveloperAgents,
  updateDeveloperAgent,
} from "@/lib/developer-api";
import { shortAddress } from "@/lib/address";

/**
 * Formats a wallet address with a longer visible prefix/suffix.
 * @param address - Full address
 */
function displayWalletAddress(address: string): string {
  if (!address || address.length < 24) return address || "—";
  return `${address.slice(0, 14)}…${address.slice(-10)}`;
}

/**
 * Dedicated list of developer agents owned by the connected wallet.
 * Click name for payment history; wallet opens the block explorer.
 */
export function AgentsListPage() {
  const { address } = useWalletAccount();
  const owner = address?.toLowerCase() ?? "";
  const [agents, setAgents] = useState<DeveloperAgent[]>([]);
  const [selected, setSelected] = useState<DeveloperAgent | null>(null);
  const [payments, setPayments] = useState<AgentPayment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<DeveloperAgent | null>(null);
  const [editMaxAmount, setEditMaxAmount] = useState("");
  const [editMaxSingle, setEditMaxSingle] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteAgent, setDeleteAgent] = useState<DeveloperAgent | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatAgent, setChatAgent] = useState<DeveloperAgent | null>(null);

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

  /**
   * Opens the edit-limits dialog.
   * @param event - Click event (stop row navigation)
   * @param agent - Agent to edit
   */
  function onOpenEdit(event: MouseEvent, agent: DeveloperAgent) {
    event.stopPropagation();
    setEditAgent(agent);
    setEditMaxAmount(String(agent.maxAmount));
    setEditMaxSingle(String(agent.maxSinglePayment));
    setEditOpen(true);
  }

  /**
   * Opens the DeepSeek chat dialog for one agent.
   * @param event - Click event
   * @param agent - Target agent
   */
  function onOpenChat(event: MouseEvent, agent: DeveloperAgent) {
    event.stopPropagation();
    setChatAgent(agent);
    setChatOpen(true);
  }

  /**
   * Opens the delete confirmation dialog.
   * @param event - Click event (stop row navigation)
   * @param agent - Agent to delete
   */
  function onOpenDelete(event: MouseEvent, agent: DeveloperAgent) {
    event.stopPropagation();
    setDeleteAgent(agent);
    setDeleteOpen(true);
  }

  /**
   * Saves new maxAmount / maxSinglePayment for the selected agent.
   * @param event - Form submit
   */
  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!owner || !editAgent) return;

    const maxAmount = Number(editMaxAmount);
    const maxSinglePayment = Number(editMaxSingle);
    if (!(maxAmount > 0) || !(maxSinglePayment > 0)) {
      setError("请输入有效的上限数值");
      return;
    }
    if (maxSinglePayment > maxAmount) {
      setError("单笔最大值不能超过总额上限");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const updated = await updateDeveloperAgent(
        editAgent.id,
        owner,
        maxAmount,
        maxSinglePayment,
      );
      setAgents((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setEditOpen(false);
      setEditAgent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改失败");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Confirms soft-delete of the selected agent.
   */
  async function onConfirmDelete() {
    if (!owner || !deleteAgent) return;
    setBusy(true);
    setError(null);
    try {
      await deleteDeveloperAgent(deleteAgent.id, owner);
      setAgents((prev) => prev.filter((row) => row.id !== deleteAgent.id));
      setDeleteOpen(false);
      setDeleteAgent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setBusy(false);
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
        当前钱包名下的受限 Agent。点击名称查看支付记录；点击钱包地址打开区块链浏览器。
      </p>

      {error ? (
        <DismissibleError
          message={error}
          onDismiss={() => setError(null)}
          autoHideMs={2000}
        />
      ) : null}

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
                  <TableHead className="w-[7rem]">名称</TableHead>
                  <TableHead className="min-w-[14rem]">钱包</TableHead>
                  <TableHead>已用 / 上限</TableHead>
                  <TableHead>单笔最大值</TableHead>
                  <TableHead>可用额度</TableHead>
                  <TableHead className="min-w-[12rem]">API Key</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-left">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        className="text-left font-medium text-foreground underline decoration-foreground/40 underline-offset-4 transition-colors hover:decoration-foreground"
                        onClick={() => void onOpenPayments(item)}
                      >
                        {item.name}
                      </button>
                    </TableCell>
                    <TableCell className="min-w-[16rem]" title={item.walletAddress}>
                      <a
                        href={getAddressExplorerUrl(item.walletAddress, item.chain)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {displayWalletAddress(item.walletAddress)}
                        <ExternalLink className="size-3 shrink-0 opacity-60" />
                      </a>
                    </TableCell>
                    <TableCell>
                      {item.spentAmount}/{item.maxAmount} {item.asset}
                    </TableCell>
                    <TableCell>
                      {item.maxSinglePayment} {item.asset}
                    </TableCell>
                    <TableCell>
                      {item.allowanceEth} {item.asset}
                    </TableCell>
                    <TableCell
                      className="min-w-[12rem] font-mono text-xs text-muted-foreground"
                      title={item.apiKeyPrefix}
                    >
                      {item.apiKeyPrefix}…
                    </TableCell>
                    <TableCell className="w-[1%] whitespace-nowrap text-left">
                      <div className="flex justify-start gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={(event) => onOpenChat(event, item)}
                        >
                          对话
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={(event) => onOpenEdit(event, item)}
                        >
                          修改
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          className="text-red-700 hover:bg-red-50 hover:text-red-900"
                          onClick={(event) => onOpenDelete(event, item)}
                        >
                          删除
                        </Button>
                      </div>
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

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditAgent(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改限额 · {editAgent?.name ?? "—"}</DialogTitle>
            <DialogDescription>
              可调整总额上限与单笔最大值。总额不能低于已花费或当前可用额度。
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void onSaveEdit(event)}>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">
                总额上限 ({editAgent?.asset ?? "USDC"})
              </span>
              <Input
                value={editMaxAmount}
                onChange={(e) => setEditMaxAmount(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">
                单笔最大值 ({editAgent?.asset ?? "USDC"})
              </span>
              <Input
                value={editMaxSingle}
                onChange={(e) => setEditMaxSingle(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setEditOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={busy || !owner}>
                {busy ? "保存中…" : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteAgent(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定删除 Agent「{deleteAgent?.name ?? "—"}」吗？删除后将无法再用于 MCP /
              x402 支付（历史记录仍保留）。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDeleteOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={busy || !owner}
              className="bg-red-700 text-white hover:bg-red-800"
              onClick={() => void onConfirmDelete()}
            >
              {busy ? "删除中…" : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AgentChatDialog
        open={chatOpen}
        agent={chatAgent}
        ownerAddress={owner}
        onOpenChange={(open) => {
          setChatOpen(open);
          if (!open) setChatAgent(null);
        }}
      />
    </div>
  );
}
