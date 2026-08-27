import { useCallback, useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getAddressExplorerUrl } from "@xone/config";
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { Bot, ExternalLink, Plus, RefreshCw } from "lucide-react";
import type { AgentPayment, DeveloperAgent } from "@xone/types";
import { PageHeader } from "@/components/layout/page-header";
import { TablePagination } from "@/components/layout/table-pagination";
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
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { DismissibleError } from "@/components/ui/web-dismissible-error";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AgentChatDialog } from "@/features/developers/agent-chat-dialog";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { useI18n } from "@/hooks/use-i18n";
import {
  deleteDeveloperAgent,
  getDeveloperAgentDetail,
  listDeveloperAgents,
  pauseDeveloperAgent,
  resumeDeveloperAgent,
  updateDeveloperAgent,
} from "@/lib/developer-api";
import { shortAddress } from "@/lib/address";
import { cn } from "@/lib/utils";
import { fetchTokenBalances, findDisplayBalance } from "@/web3";

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
 * Shows balance + max limit; click name for payment history.
 */
export function AgentsListPage() {
  const { t } = useI18n();
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
  const [editDailyLimit, setEditDailyLimit] = useState("");
  const [editPerTransaction, setEditPerTransaction] = useState("");
  const [editAllowedHosts, setEditAllowedHosts] = useState("");
  const [editAllowedPayees, setEditAllowedPayees] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteAgent, setDeleteAgent] = useState<DeveloperAgent | null>(null);

  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseAgent, setPauseAgent] = useState<DeveloperAgent | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatAgent, setChatAgent] = useState<DeveloperAgent | null>(null);

  const agentsPager = useClientPagination(agents);
  const paymentsPager = useClientPagination(payments);

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

  const walletKeys = agents.map((a) => `${a.id}:${a.walletAddress}`).join("|");
  const onChainBalances = useQuery({
    queryKey: ["developer-agent-balances", walletKeys],
    enabled: agents.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        agents.map(async (agent) => {
          const balances = await fetchTokenBalances(agent.walletAddress);
          const display = findDisplayBalance(balances, agent.asset);
          return [agent.id, display] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, string>;
    },
  });

  /**
   * Reloads agent rows and on-chain balances.
   */
  async function onRefreshAll() {
    await refresh();
    await onChainBalances.refetch();
  }

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
    setEditDailyLimit(String(agent.dailyLimit ?? agent.maxAmount));
    setEditPerTransaction(String(agent.perTransaction ?? agent.maxSinglePayment));
    setEditAllowedHosts((agent.allowedHosts ?? []).join("\n"));
    setEditAllowedPayees((agent.allowedPayees ?? []).join("\n"));
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
   * Saves dailyLimit / perTransaction (and optional allowlists) for the selected agent.
   * @param event - Form submit
   */
  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!owner || !editAgent) return;

    const dailyLimit = Number(editDailyLimit);
    const perTransaction = Number(editPerTransaction);
    if (!(dailyLimit > 0) || !(perTransaction > 0)) {
      setError("请输入有效的 dailyLimit / perTransaction");
      return;
    }
    if (perTransaction > dailyLimit) {
      setError("perTransaction 不能超过 dailyLimit");
      return;
    }

    const allowedHosts = [
      ...new Set(
        editAllowedHosts
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    const allowedPayees = [
      ...new Set(
        editAllowedPayees
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];

    setBusy(true);
    setError(null);
    try {
      const updated = await updateDeveloperAgent(
        editAgent.id,
        owner,
        dailyLimit,
        perTransaction,
        { allowedHosts, allowedPayees },
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

  /**
   * Pauses or resumes an agent wallet. Pause opens a confirm dialog; resume runs immediately.
   * @param event - Click event
   * @param agent - Target agent
   */
  function onTogglePause(event: MouseEvent, agent: DeveloperAgent) {
    event.stopPropagation();
    if (agent.status === "paused") {
      void onConfirmResume(agent);
      return;
    }
    setPauseAgent(agent);
    setPauseOpen(true);
  }

  /**
   * Resumes a paused agent immediately.
   * @param agent - Target agent
   */
  async function onConfirmResume(agent: DeveloperAgent) {
    if (!owner) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await resumeDeveloperAgent(agent.id, owner);
      setAgents((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "恢复失败");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Confirms pause after dialog acknowledgement.
   */
  async function onConfirmPause() {
    if (!owner || !pauseAgent) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await pauseDeveloperAgent(pauseAgent.id, owner);
      setAgents((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setPauseOpen(false);
      setPauseAgent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂停失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader icon={Bot} title={t("devWallet.listTitle")} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading || onChainBalances.isFetching || !owner}
            onClick={() => void onRefreshAll()}
          >
            <RefreshCw
              className={cn(
                "size-4",
                (loading || onChainBalances.isFetching) && "animate-spin",
              )}
              aria-hidden
            />
            {t("devWallet.refresh")}
          </Button>
          <Button asChild variant="default">
            <Link to="/app/developers">
              <Plus className="size-4" />
              {t("devWallet.create")}
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <DismissibleError
          message={error}
          onDismiss={() => setError(null)}
          autoHideMs={2000}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardDescription>
            {loading
              ? t("devWallet.loading")
              : agents.length === 0
                ? t("devWallet.emptyHint")
                : t("devWallet.count", { count: agents.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <Empty className="border-0 py-10 md:py-12">
              <EmptyHeader>
                <EmptyTitle>{t("devWallet.noData")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">{t("devWallet.colName")}</TableHead>
                    <TableHead className="min-w-56">{t("devWallet.colAddress")}</TableHead>
                    <TableHead>{t("devWallet.colBalance")}</TableHead>
                    <TableHead>{t("devWallet.colUsedLimit")}</TableHead>
                    <TableHead>{t("devWallet.colPerTx")}</TableHead>
                    <TableHead className="w-24">{t("devWallet.colStatus")}</TableHead>
                    <TableHead className="min-w-48">{t("devWallet.colApiKey")}</TableHead>
                    <TableHead className="w-[1%] whitespace-nowrap text-left">
                      {t("devWallet.colActions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentsPager.pageItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 font-medium"
                          onClick={() => void onOpenPayments(item)}
                        >
                          {item.name}
                        </Button>
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
                      <TableCell className="font-mono text-sm">
                        {onChainBalances.isLoading || onChainBalances.isFetching
                          ? "…"
                          : `${onChainBalances.data?.[item.id] ?? "0"} ${item.asset}`}
                      </TableCell>
                      <TableCell>
                        {item.spentAmount}/{item.dailyLimit ?? item.maxAmount}{" "}
                        {item.currency || item.asset}
                      </TableCell>
                      <TableCell>
                        {item.perTransaction ?? item.maxSinglePayment}{" "}
                        {item.currency || item.asset}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          variant={item.status === "paused" ? "outline" : "default"}
                        >
                          {item.status === "paused"
                            ? t("devWallet.statusPaused")
                            : t("devWallet.statusActive")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.apiKeyPrefix}…
                      </TableCell>
                      <TableCell className="w-[1%] whitespace-nowrap text-left">
                        <div className="flex justify-start gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy || item.status === "paused"}
                            onClick={(event) => onOpenChat(event, item)}
                          >
                            {t("devWallet.chat")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={(event) => onOpenEdit(event, item)}
                          >
                            {t("devWallet.edit")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={(event) => onTogglePause(event, item)}
                          >
                            {item.status === "paused"
                              ? t("devWallet.resume")
                              : t("devWallet.pause")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            className="text-red-700 hover:bg-red-50 hover:text-red-900"
                            onClick={(event) => onOpenDelete(event, item)}
                          >
                            {t("devWallet.delete")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={agentsPager.page}
                pageCount={agentsPager.pageCount}
                total={agentsPager.total}
                pageSize={agentsPager.pageSize}
                canPrev={agentsPager.canPrev}
                canNext={agentsPager.canNext}
                onPrev={agentsPager.onPrev}
                onNext={agentsPager.onNext}
                onPageChange={agentsPager.setPage}
                onPageSizeChange={agentsPager.setPageSize}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t("devWallet.paymentsTitle", { name: selected?.name ?? "—" })}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <p className="text-sm text-muted-foreground">
              {t("devWallet.paymentsLoading")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("devWallet.colAmount")}</TableHead>
                  <TableHead>{t("devWallet.colPayee")}</TableHead>
                  <TableHead>{t("devWallet.colMerchant")}</TableHead>
                  <TableHead>{t("devWallet.colPayStatus")}</TableHead>
                  <TableHead>{t("devWallet.colProvider")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableEmpty colSpan={5} title={t("devWallet.paymentsEmpty")} />
                ) : (
                  paymentsPager.pageItems.map((pay) => (
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
                  ))
                )}
              </TableBody>
            </Table>
          )}
          {payments.length > 0 ? (
            <TablePagination
              page={paymentsPager.page}
              pageCount={paymentsPager.pageCount}
              total={paymentsPager.total}
              pageSize={paymentsPager.pageSize}
              canPrev={paymentsPager.canPrev}
              canNext={paymentsPager.canNext}
              onPrev={paymentsPager.onPrev}
              onNext={paymentsPager.onNext}
              onPageChange={paymentsPager.setPage}
              onPageSizeChange={paymentsPager.setPageSize}
            />
          ) : null}
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
              与 SDK AgentLimits 一致：dailyLimit、perTransaction，以及可选 allowlists。
              dailyLimit 不能低于已花费或当前可用额度。
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void onSaveEdit(event)}>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">
                dailyLimit ({editAgent?.currency || editAgent?.asset || "USDC"})
              </span>
              <Input
                value={editDailyLimit}
                onChange={(e) => setEditDailyLimit(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">
                perTransaction ({editAgent?.currency || editAgent?.asset || "USDC"})
              </span>
              <Input
                value={editPerTransaction}
                onChange={(e) => setEditPerTransaction(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">allowedHosts（可选）</span>
              <Textarea
                value={editAllowedHosts}
                onChange={(e) => setEditAllowedHosts(e.target.value)}
                rows={3}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">allowedPayees（可选）</span>
              <Textarea
                value={editAllowedPayees}
                onChange={(e) => setEditAllowedPayees(e.target.value)}
                rows={2}
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
            <DialogTitle>{t("devWallet.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("devWallet.deleteBody", { name: deleteAgent?.name ?? "—" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDeleteOpen(false)}
            >
              {t("devWallet.cancel")}
            </Button>
            <Button
              type="button"
              disabled={busy || !owner}
              className="bg-red-700 text-white hover:bg-red-800"
              onClick={() => void onConfirmDelete()}
            >
              {busy ? t("devWallet.deletePending") : t("devWallet.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pauseOpen}
        onOpenChange={(open) => {
          setPauseOpen(open);
          if (!open) setPauseAgent(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("devWallet.pauseTitle")}</DialogTitle>
            <DialogDescription>
              {t("devWallet.pauseBody", { name: pauseAgent?.name ?? "—" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setPauseOpen(false)}
            >
              {t("devWallet.cancel")}
            </Button>
            <Button
              type="button"
              disabled={busy || !owner}
              onClick={() => void onConfirmPause()}
            >
              {busy ? t("devWallet.pausePending") : t("devWallet.pauseConfirm")}
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
