import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useSignTypedData } from "@privy-io/react-auth";
import { getTxExplorerUrl, USDC_TRANSFER_AUTHORIZATION_TYPES } from "@xone/config";
import {
  ArrowDownToLine,
  Check,
  ExternalLink,
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
import { DismissibleError } from "@/components/ui/web-dismissible-error";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEnsureEmbeddedWallet } from "@/hooks/use-ensure-embedded-wallet";
import { useI18n } from "@/hooks/use-i18n";
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { shortAddress } from "@/lib/address";
import {
  createDeveloperAgent,
  fundDeveloperAgentRelay,
  getFundRelayStatus,
  listDeveloperAgents,
} from "@/lib/developer-api";
import { recordTransferOnServer } from "@/lib/record-transfer";
import { cn } from "@/lib/utils";
import {
  buildUsdcTransferTypedData,
  serializeUsdcAuthorizationMessage,
} from "@/web3/usdc-authorization";

type Step = 1 | 2;

const AGENT_CHAIN = "base-sepolia" as const;
const AGENT_ASSET = "USDC" as const;
const FIRST_PAY_AMOUNT = 1;

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
 * Create params aligned with `@xonepay/sdk` AgentCreateParams / Console.
 */
export function CreateAgentPage() {
  const { t } = useI18n();
  const { address } = useWalletAccount();
  const { signTypedData } = useSignTypedData();
  const { ensureEmbeddedWalletAddress } = useEnsureEmbeddedWallet();
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
  const [fundRelayEnabled, setFundRelayEnabled] = useState<boolean | null>(null);
  const [fundTxHash, setFundTxHash] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<DeveloperAgent | null>(null);
  const [existingNames, setExistingNames] = useState<string[]>([]);

  useEffect(() => {
    if (!owner) return;
    void listDeveloperAgents(owner)
      .then((rows) => setExistingNames(rows.map((row) => row.name.trim().toLowerCase())))
      .catch(() => setExistingNames([]));
  }, [owner]);

  useEffect(() => {
    void getFundRelayStatus()
      .then((status) => setFundRelayEnabled(status.enabled))
      .catch(() => setFundRelayEnabled(false));
  }, []);

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
      setExistingNames((prev) => [...prev, trimmed.toLowerCase()]);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Opens confirm dialog after validating amount for gas-sponsored relay fund.
   */
  async function onOpenFundConfirm() {
    if (!agent || !owner || !address) {
      setError("请先连接钱包");
      return;
    }
    if (fundRelayEnabled === false) {
      setError("Gas Relayer 未配置，请联系管理员设置 RELAYER_PRIVATE_KEY");
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
    setFundOpen(true);
  }

  /**
   * Signs USDC EIP-3009 authorization; relayer broadcasts and pays gas.
   */
  async function onConfirmFundSend() {
    if (!agent || !address) return;
    setFunding(true);
    setError(null);
    try {
      const typedData = buildUsdcTransferTypedData({
        from: address,
        to: agent.walletAddress as `0x${string}`,
        amount: fundAmount.trim(),
      });
      const { signature } = await signTypedData(
        {
          domain: typedData.domain,
          types: {
            TransferWithAuthorization: [...USDC_TRANSFER_AUTHORIZATION_TYPES.TransferWithAuthorization],
          },
          primaryType: typedData.primaryType,
          message: {
            from: typedData.message.from,
            to: typedData.message.to,
            value: typedData.message.value.toString(),
            validAfter: typedData.message.validAfter.toString(),
            validBefore: typedData.message.validBefore.toString(),
            nonce: typedData.message.nonce,
          },
        },
        {
          address,
          uiOptions: { showWalletUIs: true },
        },
      );
      const amount = Number(fundAmount);
      const authorization = serializeUsdcAuthorizationMessage(typedData.message);
      const { agent: updated, txHash } = await fundDeveloperAgentRelay(
        agent.id,
        owner,
        amount,
        authorization,
        signature,
      );
      setAgent(updated);
      setFundTxHash(txHash);
      setFundOpen(false);
      void refetchBalances();
      void queryClient.invalidateQueries({ queryKey: ["wallet-balances"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-txs"] });
      void recordTransferOnServer({
        txHash,
        from: address,
        to: agent.walletAddress,
        amount: fundAmount.trim(),
        asset: AGENT_ASSET,
        status: "submitted",
      }).catch((err) => console.warn("[fund] ledger record failed", err));
    } catch (err) {
      setError(err instanceof Error ? err.message : "链上转入失败");
      setFundOpen(false);
    } finally {
      setFunding(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader icon={Zap} title={t("devWallet.createTitle")} tone="amber" />
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {[
          { n: 1 as const, label: t("devWallet.stepCreate") },
          { n: 2 as const, label: t("devWallet.stepFund") },
        ].map((item, index, list) => {
          const active = step === item.n;
          const done = step > item.n;
          return (
            <li key={item.n} className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-medium transition-colors",
                  active && "border-foreground bg-foreground text-background",
                  done && "border-foreground/30 text-foreground",
                  !active && !done && "border-border text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
                    active && "bg-background/15 text-background",
                    done && "bg-foreground text-background",
                    !active && !done && "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden /> : item.n}
                </span>
                {item.label}
              </span>
              {index < list.length - 1 ? (
                <span
                  className={cn(
                    "hidden h-px w-6 sm:block",
                    done ? "bg-foreground/30" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
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
                <Select
                  value={chain}
                  onValueChange={(v) =>
                    setChain(v as (typeof CHAINS)[number]["value"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAINS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                        {c.value !== "base-sepolia" ? t("devWallet.chainUnsupported") : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Textarea
                  value={allowedHostsText}
                  onChange={(e) => setAllowedHostsText(e.target.value)}
                  placeholder={"seller.example.com\n*.example.com"}
                  rows={3}
                />
              </label>

              <label className="block space-y-1.5 text-sm">
                <div className="text-muted-foreground">allowedPayees（可选，每行一个 0x）</div>
                <Textarea
                  value={allowedPayeesText}
                  onChange={(e) => setAllowedPayeesText(e.target.value)}
                  placeholder="0x…"
                  rows={2}
                />
              </label>

              <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Wallet className="size-4" aria-hidden />
                )}
                {busy ? t("devWallet.creating") : t("devWallet.createSubmit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step >= 2 && agent ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownToLine className="size-4" />
              {t("devWallet.fundTitle")}
            </CardTitle>
            <CardDescription>
              {t("devWallet.fundDesc", {
                address: shortAddress(agent.walletAddress),
                available: usdc,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 2 ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    inputMode="decimal"
                    className="sm:max-w-40"
                  />
                  <Button
                    type="button"
                    disabled={busy || !owner || !supportsOnChainFund}
                    onClick={() => void onOpenFundConfirm()}
                  >
                    <ArrowDownToLine className="size-4" aria-hidden />
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
                <Button asChild>
                  <Link to="/app/developers/wallet">
                    <Wallet className="size-4" aria-hidden />
                    {t("devWallet.viewList")}
                  </Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={fundOpen} onOpenChange={setFundOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("devWallet.fundConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("devWallet.fundConfirmDesc")}</DialogDescription>
          </DialogHeader>
          {agent ? (
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">{t("devWallet.fundConfirmRecipient")}</span>
                <br />
                <span className="break-all font-mono text-xs">{agent.walletAddress}</span>
              </p>
              <p>
                <span className="text-muted-foreground">{t("devWallet.fundConfirmAmount")}</span>
                {" · "}
                {fundAmount} {agent.asset}
              </p>
              <p>
                <span className="text-muted-foreground">{t("devWallet.fundConfirmFee")}</span>
                {" · "}
                {t("devWallet.fundConfirmFeeValue")}
              </p>
            </div>
          ) : null}
          <DialogFooter className="sm:flex-col sm:space-x-0 gap-2">
            <Button
              type="button"
              className="w-full"
              disabled={funding || fundRelayEnabled === false}
              onClick={() => void onConfirmFundSend()}
            >
              {funding ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  {t("devWallet.fundConfirmSubmitting")}
                </>
              ) : (
                t("devWallet.fundConfirmSubmit")
              )}
            </Button>
            <Button type="button" variant="outline" disabled={funding} onClick={() => setFundOpen(false)}>
              {t("devWallet.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
