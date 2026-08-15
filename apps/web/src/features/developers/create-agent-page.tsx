import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getTxExplorerUrl } from "@wallet/config";
import {
  ArrowDownToLine,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  LoaderCircle,
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
import { useEnsureEmbeddedWallet } from "@/hooks/use-ensure-embedded-wallet";
import { useSendAsset } from "@/hooks/use-send-asset";
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { shortAddress } from "@/lib/address";
import {
  createDeveloperAgent,
  DEFAULT_X402_MERCHANT_URL,
  fundDeveloperAgent,
  listDeveloperAgents,
  runMerchantPayment,
} from "@/lib/developer-api";
import { recordTransferOnServer } from "@/lib/record-transfer";
import { cn } from "@/lib/utils";
import { buildSendTransaction, estimateSendFee } from "@/web3";

type Step = 1 | 2 | 3;

const AGENT_CHAIN = "base-sepolia" as const;
const AGENT_ASSET = "USDC" as const;
const FIRST_PAY_AMOUNT = 0.001;

const CHAINS = [
  { label: "Base Sepolia", value: "base-sepolia" as const },
  { label: "Base", value: "base" as const },
  { label: "Polygon", value: "polygon" as const },
  { label: "Arbitrum", value: "arbitrum" as const },
];

/**
 * Parses newline / comma separated allowlist text.
 * @param text - Raw textarea
 */
function parseList(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * 5-minute developer flow: create restricted agent wallet → on-chain fund → first x402 pay.
 * Create params aligned with `@xone/sdk` AgentCreateParams / Console.
 */
export function CreateAgentPage() {
  const { address } = useWalletAccount();
  const { ensureEmbeddedWalletAddress } = useEnsureEmbeddedWallet();
  const { sendAsset } = useSendAsset();
  const queryClient = useQueryClient();
  const owner = address?.toLowerCase() ?? "";
  const { usdc, refetch: refetchBalances } = useWalletBalances();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [chain, setChain] = useState<(typeof CHAINS)[number]["value"]>("base-sepolia");
  const [dailyLimit, setDailyLimit] = useState("10");
  const [perTransaction, setPerTransaction] = useState("1");
  const [allowedHostsText, setAllowedHostsText] = useState("");
  const [allowedPayeesText, setAllowedPayeesText] = useState("");
  const [fundAmount, setFundAmount] = useState(String(FIRST_PAY_AMOUNT));
  const [fundOpen, setFundOpen] = useState(false);
  const [fundFee, setFundFee] = useState("估算中…");
  const [fundTxHash, setFundTxHash] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);
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

  const fundTransaction = useMemo(() => {
    if (!fundOpen || !agent) return null;
    try {
      return buildSendTransaction(
        agent.walletAddress,
        fundAmount.trim(),
        AGENT_ASSET,
        AGENT_CHAIN,
      );
    } catch (err) {
      return err instanceof Error ? err : new Error("无法构建转入交易");
    }
  }, [fundOpen, agent, fundAmount]);

  const supportsOnChainFund = Boolean(agent);

  /**
   * Step 1 — ensure the owner has an embedded wallet, then create the agent EOA.
   */
  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请填写 Agent 名称");
      return;
    }
    if (existingNames.includes(trimmed.toLowerCase())) {
      setError("名称已存在，请换一个");
      return;
    }
    const daily = Number(dailyLimit);
    const perTx = Number(perTransaction);
    if (!(daily > 0) || !(perTx > 0) || perTx > daily) {
      setError("请检查限额：perTransaction 不能超过 dailyLimit");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const ownerAddress = await ensureEmbeddedWalletAddress();
      const result = await createDeveloperAgent({
        ownerAddress,
        name: trimmed,
        description: "Restricted USDC wallet for MCP / x402 (SDK-aligned)",
        dailyLimit: daily,
        perTransaction: perTx,
        chain,
        currency: "USDC",
        allowedHosts: parseList(allowedHostsText),
        allowedPayees: parseList(allowedPayeesText),
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
    if (!agent || !owner || !address) {
      setError("请先连接钱包");
      return;
    }
    const amount = Number(fundAmount);
    if (!(amount > 0)) {
      setError("请输入有效转入金额");
      return;
    }
    const available = usdc;
    if (amount > available) {
      setError(`钱包余额不足（可用 ${available} USDC）`);
      return;
    }
    if (agent.allowanceEth + amount > agent.dailyLimit) {
      setError("转入后会超过 dailyLimit");
      return;
    }

    setError(null);
    setFundFee("估算中…");
    setFundOpen(true);
    try {
      const fee = await estimateSendFee(
        agent.walletAddress,
        fundAmount.trim(),
        AGENT_ASSET,
        address,
        AGENT_CHAIN,
      );
      setFundFee(fee);
    } catch {
      setFundFee("暂无法估算，以钱包确认为准");
    }
  }

  /**
   * Signs and broadcasts the on-chain USDC fund transfer to the agent wallet.
   */
  async function onConfirmFundSend() {
    if (!agent || fundTransaction instanceof Error || !fundTransaction) return;
    setFunding(true);
    setError(null);
    try {
      const hash = await sendAsset(
        agent.walletAddress,
        fundAmount.trim(),
        AGENT_ASSET,
        AGENT_CHAIN,
      );
      await onFundTxSent(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "链上转入失败");
      setFundOpen(false);
    } finally {
      setFunding(false);
    }
  }

  /**
   * After on-chain send: credit allowance + ledger, refresh balances.
   * @param txHash - Submitted transaction hash
   */
  async function onFundTxSent(txHash: string) {
    if (!agent || !owner || !address) return;
    const amount = Number(fundAmount);
    setFundTxHash(txHash);
    setBusy(true);
    setError(null);
    try {
      void recordTransferOnServer({
        txHash,
        from: address,
        to: agent.walletAddress,
        amount: fundAmount.trim(),
        asset: AGENT_ASSET,
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
   * @param amount - Requested USDC amount
   * @param current - Agent state
   * @returns Error message, or null when allowed
   */
  function validateMachineSpend(amount: number, current: DeveloperAgent): string | null {
    if (!Number.isFinite(amount) || amount <= 0) {
      return "请输入有效的消费金额";
    }
    const unit = current.currency || current.asset;
    if (amount > current.perTransaction) {
      return `超过 perTransaction（最大 ${current.perTransaction} ${unit}）`;
    }
    const remaining = current.dailyLimit - current.spentAmount;
    if (amount > remaining) {
      return `超过 dailyLimit 剩余（还可花 ${Math.max(0, remaining)} / ${current.dailyLimit} ${unit}）`;
    }
    if (amount > current.allowanceEth) {
      return `超过可用额度（当前可用 ${current.allowanceEth} ${unit}，请先链上转入）`;
    }
    return null;
  }

  /**
   * Pays the allowlisted x402 weather merchant with the agent wallet.
   */
  async function onMerchantPay() {
    if (!apiKey || !agent) return;
    const validationError = validateMachineSpend(FIRST_PAY_AMOUNT, agent);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await runMerchantPayment(apiKey, {
        merchantUrl: DEFAULT_X402_MERCHANT_URL,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "支付失败");
    } finally {
      setBusy(false);
    }
  }

  const payValidation = agent ? validateMachineSpend(FIRST_PAY_AMOUNT, agent) : null;
  const canMerchantPay = Boolean(agent && !payValidation);

  return (
    <div className="space-y-8">
      <PageHeader icon={Zap} title="创建 Agent" />
      <p className="-mt-4 max-w-2xl text-sm text-muted-foreground">
        与 <code className="text-xs">@xone/sdk</code> / Console 一致：name、chain、dailyLimit、
        perTransaction，可选 allowedHosts / allowedPayees。currency 默认 USDC。
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
              创建时会同时生成 Agent 受限钱包（独立 EOA）。按 dailyLimit / perTransaction 限制
              USDC 机器支付。私钥密封在服务端，不会返回给浏览器。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onCreate}>
              <label className="block space-y-1.5 text-sm">
                <div className="text-muted-foreground mb-2">name（不可与已有 Agent 重复）</div>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="例如 research-bot"
                />
              </label>

              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">chain</span>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                  value={chain}
                  onChange={(e) =>
                    setChain(e.target.value as (typeof CHAINS)[number]["value"])
                  }
                >
                  {CHAINS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                      {c.value !== "base-sepolia" ? "（暂不支持结算）" : ""}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  currency 固定 USDC（与 SDK 默认一致；当前仅 base-sepolia 可结算）
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">dailyLimit (USDC)</span>
                  <Input
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">perTransaction (USDC)</span>
                  <Input
                    value={perTransaction}
                    onChange={(e) => setPerTransaction(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
              </div>

              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">allowedHosts（可选，每行一个）</span>
                <textarea
                  value={allowedHostsText}
                  onChange={(e) => setAllowedHostsText(e.target.value)}
                  placeholder={"seller.example.com\n*.example.com"}
                  rows={3}
                  className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                />
              </label>

              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">allowedPayees（可选，每行一个 0x）</span>
                <textarea
                  value={allowedPayeesText}
                  onChange={(e) => setAllowedPayeesText(e.target.value)}
                  placeholder="0x…"
                  rows={2}
                  className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                />
              </label>

              <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                {busy ? "正在创建钱包…" : "创建 Agent"}
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
              API Key
            </CardTitle>
            <CardDescription>
              Agent 调 x402 / MCP 的机器凭证。
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

            {step === 2 ? (
              <div className="space-y-4">
                <div className="space-y-3 rounded-md border border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <ArrowDownToLine className="size-4" />
                    ① 链上转入 Agent 钱包
                  </p>
                  <p className="text-sm text-muted-foreground">
                    将 USDC 真实转到 Agent 地址 {shortAddress(agent.walletAddress)}。需 ≤ 钱包可用{" "}
                    {usdc} USDC，并支付少量 ETH 作为 gas。
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      inputMode="decimal"
                      className="sm:max-w-[10rem]"
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
                  <p className="text-sm font-medium">② x402 机器消费</p>
                  <p className="text-sm text-muted-foreground">
                    调用公开商家 GET /weather，价格固定 0.001 USDC。
                  </p>
                  <a
                    className="inline-flex items-center gap-1 break-all text-xs underline"
                    href={DEFAULT_X402_MERCHANT_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {DEFAULT_X402_MERCHANT_URL}
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>本次扣款 0.001 USDC</li>
                    <li>perTransaction {agent.perTransaction} USDC</li>
                    <li>
                      dailyLimit 剩余{" "}
                      {Math.max(0, Number((agent.dailyLimit - agent.spentAmount).toFixed(8)))} /{" "}
                      {agent.dailyLimit} USDC（已花 {agent.spentAmount}）
                    </li>
                    <li>可用额度 {agent.allowanceEth} USDC</li>
                  </ul>
                  {payValidation ? (
                    <p className="text-sm text-red-700" role="status">
                      {payValidation}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">额度充足，可以发起支付</p>
                  )}
                  <Button
                    type="button"
                    disabled={busy || !canMerchantPay}
                    onClick={() => void onMerchantPay()}
                  >
                    <Zap className="size-4" />
                    {busy ? "支付中…" : "支付并获取天气"}
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
              x402 支付已确认
            </CardTitle>
            <CardDescription>Payment ID：{receiptId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              已付{" "}
              <strong>
                {paidAmount} {agent.asset}
              </strong>{" "}
              →{" "}
              <a
                className="underline"
                href={DEFAULT_X402_MERCHANT_URL}
                target="_blank"
                rel="noreferrer"
              >
                /weather
              </a>
            </p>
            {paidTo ? (
              <p className="break-all font-mono text-xs text-muted-foreground">
                商家收款地址 {paidTo}
              </p>
            ) : null}
            {settlementTx ? (
              <a
                className="inline-flex items-center gap-1 text-xs underline"
                href={getTxExplorerUrl(settlementTx)}
                target="_blank"
                rel="noreferrer"
              >
                结算交易 {shortAddress(settlementTx)}
                <ExternalLink className="size-3" />
              </a>
            ) : null}
            <p className="text-muted-foreground">
              剩余可用 {agent.allowanceEth} {agent.asset} · 已花费 {agent.spentAmount}{" "}
              {agent.asset}
            </p>
            {merchantBody ? (
              <pre className="overflow-x-auto rounded-md border border-border bg-neutral-50 p-3 text-[11px] leading-relaxed">
                {JSON.stringify(merchantBody, null, 2)}
              </pre>
            ) : null}
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
              将从你的钱包发送 USDC 到 Agent 地址，确认后余额会减少。
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
              <Button
                type="button"
                className="w-full"
                disabled={funding}
                onClick={() => void onConfirmFundSend()}
              >
                {funding ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                    发送中…
                  </>
                ) : (
                  "确认发送"
                )}
              </Button>
            ) : null}
            <Button type="button" variant="outline" disabled={funding} onClick={() => setFundOpen(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
