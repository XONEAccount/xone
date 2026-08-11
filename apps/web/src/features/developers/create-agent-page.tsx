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
  DEFAULT_X402_MERCHANT_URL,
  LOCAL_X402_MERCHANT_URL,
  REMOTE_X402_MERCHANT_URL,
  fundDeveloperAgent,
  listDeveloperAgents,
  runFirstMachinePayment,
  runMerchantPayment,
} from "@/lib/developer-api";
import { recordTransferOnServer } from "@/lib/record-transfer";
import { getWebEnv } from "@/lib/env";
import { cn } from "@/lib/utils";
import { buildSendTransaction, connectTheme, estimateSendFee } from "@/web3";

type Step = 1 | 2 | 3;
type AgentChain = "ethereum-sepolia" | "base-sepolia";
type AgentAsset = "ETH" | "USDC";

const FIRST_PAY_AMOUNT = 0.001;

const CHAIN_OPTIONS: Array<{ value: AgentChain; label: string }> = [
  { value: "base-sepolia", label: "Base Sepolia（x402 测试）" },
  { value: "ethereum-sepolia", label: "Ethereum Sepolia" },
];

/**
 * 5-minute developer flow: create restricted agent wallet → on-chain fund → first x402 pay.
 */
export function CreateAgentPage() {
  const account = useActiveAccount();
  const queryClient = useQueryClient();
  const owner = account?.address?.toLowerCase() ?? "";
  const apiBase = getWebEnv().apiUrl;
  const { eth, usdc, refetch: refetchBalances } = useWalletBalances();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [chain, setChain] = useState<AgentChain>("base-sepolia");
  const [asset, setAsset] = useState<AgentAsset>("USDC");
  const [maxAmount, setMaxAmount] = useState("5");
  const [maxSingle, setMaxSingle] = useState("1");
  const [fundAmount, setFundAmount] = useState(String(FIRST_PAY_AMOUNT));
  const [fundOpen, setFundOpen] = useState(false);
  const [fundFee, setFundFee] = useState("估算中…");
  const [fundTxHash, setFundTxHash] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(String(FIRST_PAY_AMOUNT));
  const [payRecipient, setPayRecipient] = useState("");
  const [merchantUrl, setMerchantUrl] = useState(DEFAULT_X402_MERCHANT_URL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [agent, setAgent] = useState<DeveloperAgent | null>(null);
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [paidTo, setPaidTo] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState<string | null>(null);
  const [merchantBody, setMerchantBody] = useState<unknown>(null);
  const [settlementTx, setSettlementTx] = useState<string | null>(null);
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

  // Keep chain/asset pairs valid when either select changes.
  useEffect(() => {
    if (chain === "ethereum-sepolia" && asset !== "ETH") setAsset("ETH");
    if (chain === "base-sepolia" && asset !== "USDC") setAsset("USDC");
  }, [chain, asset]);

  const fundTransaction = useMemo(() => {
    if (!fundOpen || !agent) return null;
    const supported =
      (agent.asset === "USDC" && agent.chain === "base-sepolia") ||
      (agent.asset === "ETH" && agent.chain === "ethereum-sepolia");
    if (!supported) {
      return new Error("当前仅支持 Base Sepolia USDC 或 Ethereum Sepolia ETH 链上转入");
    }
    try {
      return buildSendTransaction(agent.walletAddress, fundAmount.trim(), agent.asset);
    } catch (err) {
      return err instanceof Error ? err : new Error("无法构建转入交易");
    }
  }, [fundOpen, agent, fundAmount]);

  const supportsOnChainFund =
    (agent?.asset === "USDC" && agent?.chain === "base-sepolia") ||
    (agent?.asset === "ETH" && agent?.chain === "ethereum-sepolia");

  /**
   * Step 1 — create agent wallet with chain, asset, and spend caps.
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
        description: `Restricted ${asset} wallet on ${chain} for MCP / x402`,
        maxAmount: max,
        maxSinglePayment: single,
        initialAllowance: 0,
        chain,
        asset,
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
    const available = agent.asset === "USDC" ? usdc : eth;
    if (amount > available) {
      setError(`钱包余额不足（可用 ${available} ${agent.asset}）`);
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
      const fee = await estimateSendFee(
        agent.walletAddress,
        fundAmount.trim(),
        agent.asset,
        account,
      );
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
        asset: agent.asset === "USDC" ? "USDC" : "ETH",
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
    const unit = current.asset;
    if (amount > current.maxSinglePayment) {
      return `超过单笔上限（最大 ${current.maxSinglePayment} ${unit}）`;
    }
    const remainingTotal = current.maxAmount - current.spentAmount;
    if (amount > remainingTotal) {
      return `超过剩余总额度（还可花 ${Math.max(0, remainingTotal)} / 上限 ${current.maxAmount} ${unit}）`;
    }
    if (amount > current.allowanceEth) {
      return `超过可用额度（当前可用 ${current.allowanceEth} ${unit}，请先链上转入）`;
    }
    return null;
  }

  /**
   * Real x402 merchant pay against allowlisted seller (/weather), or internal simulate fallback.
   */
  async function onFirstPay() {
    if (!apiKey || !agent || !owner) return;
    setBusy(true);
    setError(null);
    try {
      const useExternalMerchant =
        agent.chain === "base-sepolia" && agent.asset === "USDC";

      if (useExternalMerchant) {
        const url = merchantUrl.trim();
        if (!url.startsWith("http")) {
          setError("请填写完整的商家 URL（含 https://）");
          return;
        }
        // Amount / policy are enforced server-side against the merchant's 402 quote.

        const result = await runMerchantPayment(apiKey, {
          merchantUrl: url,
          idempotencyKey: `merchant-${agent.id}-${Date.now()}`,
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
        setMerchantBody(result.receipt.merchantBody);
        setSettlementTx(result.receipt.settlementTx ?? null);
        setStep(3);
        return;
      }

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
      setMerchantBody(null);
      setSettlementTx(null);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "支付失败");
    } finally {
      setBusy(false);
    }
  }

  const useExternalMerchant =
    agent?.chain === "base-sepolia" && agent?.asset === "USDC";
  const payAmountNumber = Number(payAmount);
  const recipientOk = /^0x[a-fA-F0-9]{40}$/.test(payRecipient.trim());
  const payValidation =
    !useExternalMerchant && agent && Number.isFinite(payAmountNumber) && payAmount.trim() !== ""
      ? validateMachineSpend(payAmountNumber, agent)
      : !useExternalMerchant && agent
        ? "请输入消费金额"
        : null;
  const recipientValidation =
    !useExternalMerchant && payRecipient.trim() && !recipientOk
      ? "收款地址格式不正确"
      : null;
  const merchantUrlOk = Boolean(merchantUrl.trim().startsWith("http"));
  const canFirstPay = useExternalMerchant
    ? Boolean(agent && merchantUrlOk)
    : Boolean(agent && !payValidation && recipientOk);
  const mcpExample = apiKey
    ? [
      `# get_balance`,
      `curl -s ${apiBase}/api/mcp \\`,
      `  -H "Authorization: Bearer ${apiKey}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_balance","arguments":{}}}'`,
      ``,
      `# get_payment_status`,
      `curl -s ${apiBase}/api/mcp \\`,
      `  -H "Authorization: Bearer ${apiKey}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_payment_status","arguments":{}}}'`,
    ].join("\n")
    : "";

  return (
    <div className="space-y-8">
      {error ? (
        <div className="sticky top-0 z-50 -mx-1">
          <DismissibleError
            message={error}
            onDismiss={() => setError(null)}
            autoHideMs={2000}
          />
        </div>
      ) : null}

      <PageHeader icon={Zap} title="创建 Agent" />
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

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-4" />
              配置 Agent
            </CardTitle>
            <CardDescription>
              系统会生成独立 EOA 钱包（私钥密封在服务端，不返回浏览器），并按链 / 币种与总额、单笔上限限制机器支付。
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
                  <span className="text-muted-foreground">运行 Chain</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                    value={chain}
                    onChange={(e) => setChain(e.target.value as AgentChain)}
                  >
                    {CHAIN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">允许的币</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                    value={asset}
                    onChange={(e) => setAsset(e.target.value as AgentAsset)}
                  >
                    {chain === "ethereum-sepolia" ? (
                      <option value="ETH">ETH</option>
                    ) : (
                      <option value="USDC">USDC</option>
                    )}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">总额上限 ({asset})</span>
                  <Input
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">单笔上限 ({asset})</span>
                  <Input
                    value={maxSingle}
                    onChange={(e) => setMaxSingle(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
              </div>
              {chain === "base-sepolia" ? (
                <p className="text-xs text-muted-foreground">
                  Base Sepolia + USDC 可对接公开 x402 facilitator（如 x402.org）与已部署商家{" "}
                  https://xone-x402-seller.tskwangyi.workers.dev 。
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ethereum Sepolia + ETH 不走公开 x402 facilitator，仅适合本产品内部额度测试。
                </p>
              )}
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
              {agent.name} · {agent.chain} / {agent.asset} · 钱包{" "}
              {shortAddress(agent.walletAddress)} · 可用额度 {agent.allowanceEth}{" "}
              {agent.asset}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-md border border-border bg-neutral-50 px-3 py-2 text-xs text-muted-foreground">
              已创建独立 EOA：<span className="font-mono text-foreground">{agent.walletAddress}</span>
              。私钥仅服务端密封存储。
            </p>

            {step === 2 ? (
              <div className="space-y-4">
                <div className="space-y-3 rounded-md border border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <ArrowDownToLine className="size-4" />
                    ① 链上转入 Agent 钱包
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
                      disabled={busy || !owner || !supportsOnChainFund}
                      onClick={() => void onOpenFundConfirm()}
                    >
                      转入额度
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    当前 Agent 可用 {agent.allowanceEth} {agent.asset}
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
                  <p className="text-sm font-medium">
                    ② 机器消费（真实 x402 /weather）
                  </p>
                  {useExternalMerchant ? (
                    <>
                      <label className="block space-y-1.5 text-sm">
                        <span className="text-muted-foreground">
                          商家资源 URL（金额以商家 402 报价为准，约 $0.001 USDC）
                        </span>
                        <Input
                          value={merchantUrl}
                          onChange={(e) => setMerchantUrl(e.target.value)}
                          className="font-mono text-xs"
                        />
                      </label>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <button
                          type="button"
                          className="text-muted-foreground underline"
                          onClick={() => setMerchantUrl(REMOTE_X402_MERCHANT_URL)}
                        >
                          线上 /weather
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground underline"
                          onClick={() => setMerchantUrl(LOCAL_X402_MERCHANT_URL)}
                        >
                          本地 /weather
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
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
                        <div className="text-muted-foreground mb-2">
                          消费金额 ({agent.asset})
                        </div>
                        <Input
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          inputMode="decimal"
                          className="sm:max-w-40"
                          placeholder="0.001"
                        />
                      </label>
                    </>
                  )}

                  {recipientValidation ||
                    payValidation ||
                    (useExternalMerchant && !merchantUrlOk) ? (
                    <p className="text-sm text-red-700" role="status">
                      {recipientValidation ??
                        payValidation ??
                        (useExternalMerchant && !merchantUrlOk ? "商家 URL 无效" : null)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {useExternalMerchant
                        ? "请求商家 → 读取 402 报价 → 策略校验 → Agent 签名结算"
                        : "校验通过，可以发起支付"}
                    </p>
                  )}
                  <Button
                    type="button"
                    disabled={busy || !owner || !canFirstPay}
                    onClick={() => void onFirstPay()}
                  >
                    <Zap className="size-4" />
                    {busy
                      ? "支付中…"
                      : useExternalMerchant
                        ? "支付 /weather"
                        : "完成机器支付"}
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
              已付{" "}
              <strong>
                {paidAmount} {agent.asset}
              </strong>{" "}
              → 收款人 <strong>{paidTo ? shortAddress(paidTo) : "—"}</strong>
            </p>
            {settlementTx ? (
              <p>
                结算 tx{" "}
                <a
                  className="inline-flex items-center gap-1 underline"
                  href={getTxExplorerUrl(settlementTx)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddress(settlementTx)}
                  <ExternalLink className="size-3" />
                </a>
              </p>
            ) : null}
            {merchantBody != null ? (
              <pre className="overflow-x-auto rounded-md border border-border bg-neutral-50 p-3 text-[11px] leading-relaxed">
                {typeof merchantBody === "string"
                  ? merchantBody
                  : "天气结果：" + JSON.stringify(merchantBody, null, 2)}
              </pre>
            ) : null}
            <p className="text-muted-foreground">
              剩余可用 {agent.allowanceEth} {agent.asset} · 已花费 {agent.spentAmount}{" "}
              {agent.asset}
            </p>
            <Button asChild variant="outline">
              <Link to="/app/developers/agents">查看我的 Agents</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={fundOpen} onOpenChange={setFundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认链上转入</DialogTitle>
            <DialogDescription>
              将从你的钱包发送 {agent?.asset ?? "资产"} 到 Agent 地址，确认后余额会减少。
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
                <span className="text-muted-foreground">金额</span> · {fundAmount}{" "}
                {agent.asset}
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
