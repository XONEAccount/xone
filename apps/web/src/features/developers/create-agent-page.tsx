import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getTxExplorerUrl } from "@wallet/config";
import { TransactionButton, useActiveAccount } from "thirdweb/react";
import {
  ArrowDownToLine,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Terminal,
  Wallet,
  Zap,
} from "lucide-react";
import type { DeveloperAgent } from "@wallet/types";
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
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { shortAddress } from "@/lib/address";
import {
  createDeveloperAgent,
  fundDeveloperAgent,
  listDeveloperAgents,
  runFirstMachinePayment,
} from "@/lib/developer-api";
import { recordTransferOnServer } from "@/lib/record-transfer";
import { getWebEnv } from "@/lib/env";
import { cn } from "@/lib/utils";
import { buildSendTransaction, connectTheme, estimateSendFee } from "@/web3";

type Step = 1 | 2 | 3;

const FIRST_PAY_AMOUNT = 0.001;

/**
 * 5-minute developer flow: create restricted ETH agent → on-chain fund → first x402 pay.
 */
export function CreateAgentPage() {
  const account = useActiveAccount();
  const queryClient = useQueryClient();
  const owner = account?.address?.toLowerCase() ?? "";
  const apiBase = getWebEnv().apiUrl;
  const { eth, refetch: refetchBalances } = useWalletBalances();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [maxAmount, setMaxAmount] = useState("0.05");
  const [maxSingle, setMaxSingle] = useState("0.01");
  const [fundAmount, setFundAmount] = useState(String(FIRST_PAY_AMOUNT));
  const [fundOpen, setFundOpen] = useState(false);
  const [fundFee, setFundFee] = useState("估算中…");
  const [fundTxHash, setFundTxHash] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(String(FIRST_PAY_AMOUNT));
  const [payRecipient, setPayRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [agent, setAgent] = useState<DeveloperAgent | null>(null);
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [paidTo, setPaidTo] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!owner) return;
    void listDeveloperAgents(owner)
      .then((rows) => setExistingNames(rows.map((row) => row.name.trim().toLowerCase())))
      .catch(() => setExistingNames([]));
  }, [owner]);

  // Default recipient to connected wallet when empty or when wallet switches.
  useEffect(() => {
    if (!owner) return;
    setPayRecipient((prev) => (!prev ? owner : prev));
  }, [owner]);

  const fundTransaction = useMemo(() => {
    if (!fundOpen || !agent) return null;
    try {
      return buildSendTransaction(agent.walletAddress, fundAmount.trim(), "ETH");
    } catch (err) {
      return err instanceof Error ? err : new Error("无法构建转入交易");
    }
  }, [fundOpen, agent, fundAmount]);

  /**
   * Step 1 — create agent with spend caps only.
   */
  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!owner) {
      setError("请先连接钱包");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请填写 Agent 名称");
      return;
    }
    if (existingNames.includes(trimmed.toLowerCase())) {
      setError("名称已存在，请换一个");
      return;
    }
    const max = Number(maxAmount);
    const single = Number(maxSingle);
    if (!(max > 0) || !(single > 0) || single > max) {
      setError("请检查限额：单笔不能超过总额");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await createDeveloperAgent({
        ownerAddress: owner,
        name: trimmed,
        description: "Restricted ETH wallet for MCP / x402 machine payments",
        maxAmount: max,
        maxSinglePayment: single,
        initialAllowance: 0,
      });
      setAgent(result.agent);
      setApiKey(result.apiKey);
      setExistingNames((prev) => [...prev, trimmed.toLowerCase()]);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Copies the one-time API key to clipboard.
   */
  async function onCopyKey() {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  /**
   * Opens confirm dialog after validating amount; estimates gas for the on-chain fund.
   */
  async function onOpenFundConfirm() {
    if (!agent || !owner || !account) {
      setError("请先连接钱包");
      return;
    }
    const amount = Number(fundAmount);
    if (!(amount > 0)) {
      setError("请输入有效转入金额");
      return;
    }
    if (amount > eth) {
      setError(`钱包余额不足（可用 ${eth} ETH）`);
      return;
    }
    if (agent.allowanceEth + amount > agent.maxAmount) {
      setError("转入后会超过总额上限");
      return;
    }

    setError(null);
    setFundFee("估算中…");
    setFundOpen(true);
    try {
      const fee = await estimateSendFee(agent.walletAddress, fundAmount.trim(), "ETH", account);
      setFundFee(fee);
    } catch {
      setFundFee("暂无法估算，以钱包确认为准");
    }
  }

  /**
   * After on-chain send: credit allowance + ledger, refresh balances.
   * @param txHash - Submitted transaction hash
   */
  async function onFundTxSent(txHash: string) {
    if (!agent || !owner || !account?.address) return;
    const amount = Number(fundAmount);
    setFundTxHash(txHash);
    setBusy(true);
    setError(null);
    try {
      void recordTransferOnServer({
        txHash,
        from: account.address,
        to: agent.walletAddress,
        amount: fundAmount.trim(),
        asset: "ETH",
        status: "submitted",
      }).catch((err) => console.warn("[fund] ledger record failed", err));

      const updated = await fundDeveloperAgent(agent.id, owner, amount, txHash);
      setAgent(updated);
      setFundOpen(false);
      void refetchBalances();
      void queryClient.invalidateQueries({ queryKey: ["wallet-balances"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-txs"] });
    } catch (err) {
      setError(
        err instanceof Error
          ? `链上已发送，但记账失败：${err.message}（tx ${txHash}）`
          : "转入记账失败",
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * Validates simulated machine spend against single-cap, lifetime cap, and funded allowance.
   * @param amount - Requested ETH amount
   * @param current - Agent state
   * @returns Error message, or null when allowed
   */
  function validateMachineSpend(amount: number, current: DeveloperAgent): string | null {
    if (!Number.isFinite(amount) || amount <= 0) {
      return "请输入有效的消费金额";
    }
    if (amount > current.maxSinglePayment) {
      return `超过单笔上限（最大 ${current.maxSinglePayment} ETH）`;
    }
    const remainingTotal = current.maxAmount - current.spentAmount;
    if (amount > remainingTotal) {
      return `超过剩余总额度（还可花 ${Math.max(0, remainingTotal)} / 上限 ${current.maxAmount} ETH）`;
    }
    if (amount > current.allowanceEth) {
      return `超过可用额度（当前可用 ${current.allowanceEth} ETH，请先链上转入）`;
    }
    return null;
  }

  /**
   * First machine payment — recipient defaults to connected wallet but is editable.
   */
  async function onFirstPay() {
    if (!apiKey || !agent || !owner) return;
    setBusy(true);
    setError(null);
    try {
      const recipient = payRecipient.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
        setError("收款地址格式不正确");
        return;
      }
      const amount = Number(payAmount);
      const validationError = validateMachineSpend(amount, agent);
      if (validationError) {
        setError(validationError);
        return;
      }

      const result = await runFirstMachinePayment(apiKey, {
        amount: String(amount),
        recipient,
        merchant: "xone-first-pay",
        resource: "xone://developers/first-machine-payment",
        idempotencyKey: `pay-${agent.id}-${amount}-${Date.now()}`,
      });
      setAgent((prev) =>
        prev
          ? {
            ...prev,
            allowanceEth: result.agent.allowanceEth,
            spentAmount: result.agent.spentAmount,
          }
          : prev,
      );
      setReceiptId(result.receipt.paymentId);
      setPaidTo(result.receipt.recipient);
      setPaidAmount(result.receipt.amount);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "支付失败");
    } finally {
      setBusy(false);
    }
  }

  const payAmountNumber = Number(payAmount);
  const recipientOk = /^0x[a-fA-F0-9]{40}$/.test(payRecipient.trim());
  const payValidation =
    agent && Number.isFinite(payAmountNumber) && payAmount.trim() !== ""
      ? validateMachineSpend(payAmountNumber, agent)
      : agent
        ? "请输入消费金额"
        : null;
  const recipientValidation =
    payRecipient.trim() && !recipientOk ? "收款地址格式不正确" : null;
  const canFirstPay = Boolean(agent && !payValidation && recipientOk);
  const mcpExample = apiKey
    ? `curl -s ${apiBase}/api/mcp \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"pay","arguments":{"amount":"${payAmount || FIRST_PAY_AMOUNT}","recipient":"${payRecipient.trim() || owner || "0x…"}","merchant":"demo"}}}'`
    : "";

  return (
    <div className="space-y-8">
      <PageHeader icon={Zap} title="创建 Agent" />
      <p className="-mt-4 max-w-2xl text-sm text-muted-foreground">
        生成受限 ETH 钱包并设置支付上限。转入额度会真实把 ETH 发到 Agent 地址，钱包余额会减少。
      </p>

      <ol className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        {[
          { n: 1 as const, label: "创建受限钱包" },
          { n: 2 as const, label: "链上转入并支付" },
          { n: 3 as const, label: "完成" },
        ].map((item) => (
          <li
            key={item.n}
            className={cn(
              "rounded-full border px-3 py-1",
              step === item.n
                ? "border-foreground bg-foreground text-background"
                : step > item.n
                  ? "border-foreground/40 text-foreground"
                  : "border-border",
            )}
          >
            {item.n}. {item.label}
          </li>
        ))}
      </ol>

      {error ? <DismissibleError message={error} onDismiss={() => setError(null)} /> : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-4" />
              配置 Agent
            </CardTitle>
            <CardDescription>
              系统会生成独立 EOA，并按总额 / 单笔上限限制 ETH 机器支付。私钥密封在服务端，不会返回给浏览器。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onCreate}>
              <label className="block space-y-1.5 text-sm">
                <div className="text-muted-foreground mb-2">名称（不可与已有 Agent 重复）</div>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="例如 travel-bot"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">总额上限 (ETH)</span>
                  <Input
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">单笔上限 (ETH)</span>
                  <Input
                    value={maxSingle}
                    onChange={(e) => setMaxSingle(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
              </div>
              <Button type="submit" disabled={busy || !owner} className="w-full sm:w-auto">
                {busy ? "创建中…" : "创建 Agent"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step >= 2 && agent && apiKey ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              API Key（仅显示一次）
            </CardTitle>
            <CardDescription>
              {agent.name} · 钱包 {shortAddress(agent.walletAddress)} · 可用额度{" "}
              {agent.allowanceEth} ETH
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <code className="flex-1 break-all rounded-md border border-border bg-neutral-50 px-3 py-2 text-xs">
                {apiKey}
              </code>
              <Button type="button" variant="outline" onClick={() => void onCopyKey()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "已复制" : "复制"}
              </Button>
            </div>

            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Terminal className="size-4" />
                两个接口分别做什么
              </p>
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="font-medium">MCP · 给 AI / 工具调用</p>
                <p className="text-muted-foreground">
                  用 JSON-RPC 调工具：查钱包、查限额、发起支付。
                </p>
                <code className="block break-all rounded-md bg-neutral-50 px-3 py-2 text-xs">
                  POST {apiBase}/api/mcp
                </code>
              </div>
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="font-medium">x402 · 专用支付接口</p>
                <p className="text-muted-foreground">
                  带 Agent API Key 直接付款；额度不足返回 402。
                </p>
                <code className="block break-all rounded-md bg-neutral-50 px-3 py-2 text-xs">
                  POST {apiBase}/api/x402/pay
                </code>
              </div>
            </div>

            {step === 2 ? (
              <div className="space-y-4">
                <div className="space-y-3 rounded-md border border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <ArrowDownToLine className="size-4" />
                    ① 链上转入 Agent 钱包
                  </p>
                  <p className="text-sm text-muted-foreground">
                    将 ETH 真实转到 Agent 地址 {shortAddress(agent.walletAddress)}。需 ≤ 钱包可用{" "}
                    {eth} ETH，并支付 gas。
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      inputMode="decimal"
                      className="sm:max-w-40"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || !owner}
                      onClick={() => void onOpenFundConfirm()}
                    >
                      转入额度
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    当前 Agent 可用 {agent.allowanceEth} ETH
                    {fundTxHash ? (
                      <>
                        {" "}
                        · 最近转入{" "}
                        <a
                          className="inline-flex items-center gap-1 underline"
                          href={getTxExplorerUrl(fundTxHash)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortAddress(fundTxHash)}
                          <ExternalLink className="size-3" />
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>

                <div className="space-y-3 rounded-md border border-border p-3">
                  <p className="text-sm font-medium">② 机器消费（模拟）</p>
                  <label className="block space-y-1.5 text-sm">
                    <span className="text-muted-foreground">
                      收款人（默认当前钱包，可改）
                    </span>
                    <Input
                      value={payRecipient}
                      onChange={(e) => setPayRecipient(e.target.value)}
                      placeholder="0x…"
                      className="font-mono text-xs"
                    />
                  </label>
                  {owner ? (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline"
                      onClick={() => setPayRecipient(owner)}
                    >
                      填回当前钱包 {shortAddress(owner)}
                    </button>
                  ) : null}
                  <label className="block space-y-1.5 text-sm">
                    <div className="text-muted-foreground mb-2">消费金额 (ETH)</div>
                    <Input
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      inputMode="decimal"
                      className="sm:max-w-40"
                      placeholder="0.001"
                    />
                  </label>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>单笔上限 {agent.maxSinglePayment} ETH</li>
                    <li>
                      总额剩余{" "}
                      {Math.max(0, Number((agent.maxAmount - agent.spentAmount).toFixed(8)))} /{" "}
                      {agent.maxAmount} ETH（已花 {agent.spentAmount}）
                    </li>
                    <li>可用额度 {agent.allowanceEth} ETH</li>
                  </ul>
                  {recipientValidation || payValidation ? (
                    <p className="text-sm text-red-700" role="status">
                      {recipientValidation ?? payValidation}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">校验通过，可以发起支付</p>
                  )}
                  <Button
                    type="button"
                    disabled={busy || !owner || !canFirstPay}
                    onClick={() => void onFirstPay()}
                  >
                    <Zap className="size-4" />
                    {busy ? "支付中…" : "完成机器支付"}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 3 && receiptId && agent ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="size-4" />
              首次机器支付已确认
            </CardTitle>
            <CardDescription>Payment ID：{receiptId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              已付 <strong>{paidAmount}</strong> ETH → 收款人{" "}
              <strong>{paidTo ? shortAddress(paidTo) : "—"}</strong>
            </p>
            {paidTo ? (
              <p className="break-all font-mono text-xs text-muted-foreground">{paidTo}</p>
            ) : null}
            <p className="text-muted-foreground">
              剩余可用 {agent.allowanceEth} ETH · 已花费 {agent.spentAmount} ETH
            </p>
            <Button asChild variant="outline">
              <Link to="/app/developers/agents">查看我的 Agents</Link>
            </Button>
            <pre className="overflow-x-auto rounded-md border border-border bg-neutral-50 p-3 text-[11px] leading-relaxed">
              {mcpExample}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={fundOpen} onOpenChange={setFundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认链上转入</DialogTitle>
            <DialogDescription>
              将从你的钱包发送 ETH 到 Agent 地址，确认后余额会减少。
            </DialogDescription>
          </DialogHeader>
          {agent ? (
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">收款 Agent</span>
                <br />
                <span className="break-all font-mono text-xs">{agent.walletAddress}</span>
              </p>
              <p>
                <span className="text-muted-foreground">金额</span> · {fundAmount} ETH
              </p>
              <p>
                <span className="text-muted-foreground">预估手续费</span> · {fundFee}
              </p>
            </div>
          ) : null}
          <DialogFooter className="sm:flex-col">
            {fundTransaction instanceof Error ? (
              <p className="text-sm text-destructive" role="alert">
                {fundTransaction.message}
              </p>
            ) : fundTransaction ? (
              <TransactionButton
                transaction={() => fundTransaction}
                theme={connectTheme}
                className="!h-10 !w-full !rounded-md !bg-[var(--color-foreground)] !text-sm !font-medium !text-[var(--color-background)]"
                payModal={false}
                onTransactionSent={(result) => {
                  void onFundTxSent(result.transactionHash);
                }}
                onError={(err) => {
                  setError(err.message || "链上转入失败");
                  setFundOpen(false);
                }}
              >
                确认发送
              </TransactionButton>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setFundOpen(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
