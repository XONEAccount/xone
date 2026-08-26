import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getTxExplorerUrl } from "@xone/config";
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
import type { DeveloperAgent } from "@xone/types";
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
import { useI18n } from "@/hooks/use-i18n";
import { useSendAsset } from "@/hooks/use-send-asset";
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { shortAddress } from "@/lib/address";
import {
  createDeveloperAgent,
  fundDeveloperAgent,
  listDeveloperAgents,
} from "@/lib/developer-api";
import { recordTransferOnServer } from "@/lib/record-transfer";
import { cn } from "@/lib/utils";
import { buildSendTransaction, estimateSendFee } from "@/web3";

type Step = 1 | 2;

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
 * Developer flow: create restricted wallet → on-chain fund.
 * Create params aligned with `@xone/sdk` AgentCreateParams / Console.
 */
export function CreateAgentPage() {
  const { t } = useI18n();
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

  return (
    <div className="space-y-8">
      <PageHeader icon={Zap} title={t("devWallet.createTitle")} />
      <ol className="flex flex-wrap gap-3 text-base text-muted-foreground">
        {[
          { n: 1 as const, label: t("devWallet.stepCreate") },
          { n: 2 as const, label: t("devWallet.stepFund") },
        ].map((item) => (
          <li
            key={item.n}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm",
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
              {t("devWallet.configTitle")}
            </CardTitle>
            <CardDescription>{t("devWallet.configDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onCreate}>
              <label className="block space-y-1.5 text-sm">
                <div className="text-muted-foreground">{t("devWallet.nameLabel")}</div>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder={t("devWallet.namePlaceholder")}
                />
              </label>

              <label className="block space-y-1.5 text-sm">
                <div className="text-muted-foreground">{t("devWallet.chain")}</div>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--color-ring)"
                  value={chain}
                  onChange={(e) =>
                    setChain(e.target.value as (typeof CHAINS)[number]["value"])
                  }
                >
                  {CHAINS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                      {c.value !== "base-sepolia" ? t("devWallet.chainUnsupported") : ""}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  {t("devWallet.currencyFixed")}
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm">
                  <div className="text-muted-foreground">dailyLimit (USDC)</div>
                  <Input
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <div className="text-muted-foreground">perTransaction (USDC)</div>
                  <Input
                    value={perTransaction}
                    onChange={(e) => setPerTransaction(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
              </div>

              <label className="block space-y-1.5 text-sm">
                <div className="text-muted-foreground">allowedHosts（可选，每行一个）</div>
                <textarea
                  value={allowedHostsText}
                  onChange={(e) => setAllowedHostsText(e.target.value)}
                  placeholder={"seller.example.com\n*.example.com"}
                  rows={3}
                  className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-(--color-ring)"
                />
              </label>

              <label className="block space-y-1.5 text-sm">
                <div className="text-muted-foreground">allowedPayees（可选，每行一个 0x）</div>
                <textarea
                  value={allowedPayeesText}
                  onChange={(e) => setAllowedPayeesText(e.target.value)}
                  placeholder="0x…"
                  rows={2}
                  className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-(--color-ring)"
                />
              </label>

              <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                {busy ? t("devWallet.creating") : t("devWallet.createSubmit")}
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
              {t("devWallet.apiKeyTitle")}
            </CardTitle>
            <CardDescription>
              {t("devWallet.apiKeyDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <code className="flex-1 break-all rounded-md border border-border bg-neutral-50 px-3 py-2 text-xs">
                {apiKey}
              </code>
              <Button type="button" variant="outline" onClick={() => void onCopyKey()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? t("devWallet.copied") : t("devWallet.copy")}
              </Button>
            </div>

            {step === 2 ? (
              <div className="space-y-4">
                <div className="space-y-3 rounded-md border border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <ArrowDownToLine className="size-4" />
                    {t("devWallet.fundTitle")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("devWallet.fundDesc", {
                      address: shortAddress(agent.walletAddress),
                      available: usdc,
                    })}
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
                      {t("devWallet.fundAction")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("devWallet.fundAvailable", {
                      amount: agent.allowanceEth,
                      asset: agent.asset,
                    })}
                    {fundTxHash ? (
                      <>
                        {" "}
                        ·{" "}
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
                <Button asChild variant="outline">
                  <Link to="/app/developers/wallet">{t("devWallet.viewList")}</Link>
                </Button>
              </div>
            ) : null}
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
