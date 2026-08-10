import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getTxExplorerUrl } from "@wallet/config";
import { ArrowLeftRight, ExternalLink, Eye, LoaderCircle } from "lucide-react";
import { TransactionButton, useActiveAccount } from "thirdweb/react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { recordTransferOnServer } from "@/lib/record-transfer";
import { useA2AStore } from "@/stores/a2a";
import {
  buildSendTransaction,
  connectTheme,
  estimateSendFee,
  prepareSendPreview,
  type PreparedSend,
} from "@/web3";

/**
 * 转账页：自研表单预览 + thirdweb TransactionButton 提交。
 */
export function SendPage() {
  const account = useActiveAccount();
  const queryClient = useQueryClient();
  const { usdc, eth, refetch } = useWalletBalances();
  const recordTransfer = useA2AStore((s) => s.recordTransfer);

  const [asset, setAsset] = useState("ETH");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [preview, setPreview] = useState<PreparedSend | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const available = asset === "ETH" ? eth : usdc;
  const confirmOpen = preview != null;

  const transaction = useMemo(() => {
    if (!preview) return null;
    try {
      return buildSendTransaction(preview.to, preview.amount, preview.asset);
    } catch (err) {
      return err instanceof Error ? err : new Error("无法构建交易");
    }
  }, [preview]);

  /**
   * Builds a transaction preview with a live gas estimate, then opens confirm dialog.
   */
  async function onPreview(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setTxHash(null);
    setPreview(null);

    if (!account) {
      setError("请先连接钱包");
      return;
    }

    if (Number(amount) > available) {
      setError(`余额不足（可用 ${available} ${asset}）`);
      return;
    }

    const trimmedTo = to.trim();
    const trimmedAmount = amount.trim();

    try {
      buildSendTransaction(trimmedTo, trimmedAmount, asset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "预览失败");
      return;
    }

    setEstimating(true);
    try {
      const estimatedFee = await estimateSendFee(
        trimmedTo,
        trimmedAmount,
        asset,
        account,
      );
      setPreview(prepareSendPreview(trimmedTo, trimmedAmount, asset, estimatedFee));
    } catch (err) {
      console.warn("[send] fee estimate failed", err);
      setPreview(
        prepareSendPreview(trimmedTo, trimmedAmount, asset, "暂无法估算，以钱包确认为准"),
      );
    } finally {
      setEstimating(false);
    }
  }

  /**
   * Closes the confirm dialog without sending.
   * @param open - Dialog open state from Radix
   */
  function onConfirmOpenChange(open: boolean) {
    if (!open) setPreview(null);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 animate-in">
      <PageHeader icon={ArrowLeftRight} title="转账" className="justify-center" />

      <Card className="fade-up">
        <CardHeader>
          <CardTitle>转账详情</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onPreview}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="asset">
                资产
              </label>
              <select
                id="asset"
                className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={asset}
                onChange={(e) => {
                  setAsset(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="ETH">ETH（可用 {eth}）</option>
                <option value="USDC">USDC（可用 {usdc}）</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="to">
                收款地址
              </label>
              <Input
                id="to"
                placeholder="0x…"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="amount">
                金额
              </label>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={estimating}>
              {estimating ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  估算手续费…
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" aria-hidden />
                  预览
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={onConfirmOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认转账</DialogTitle>
            <DialogDescription>请核对以下信息后再发送。</DialogDescription>
          </DialogHeader>

          {preview ? (
            <div className="space-y-1 text-sm">
              <Row label="收款方" value={preview.to} mono />
              <Row label="资产" value={preview.asset} />
              <Row label="金额" value={preview.amount} />
              <Row label="网络" value={preview.chain} />
              <Row label="预估手续费" value={preview.estimatedFee} />
            </div>
          ) : null}

          <DialogFooter className="sm:flex-col">
            {transaction instanceof Error ? (
              <p className="text-sm text-destructive" role="alert">
                {transaction.message}
              </p>
            ) : transaction ? (
              <TransactionButton
                transaction={() => transaction}
                theme={connectTheme}
                className="!h-10 !w-full !rounded-md !bg-[var(--color-foreground)] !text-sm !font-medium !text-[var(--color-background)]"
                payModal={false}
                onTransactionSent={(result) => {
                  const hash = result.transactionHash;
                  setTxHash(hash);
                  if (preview && account?.address) {
                    const sentAsset = preview.asset === "ETH" ? "ETH" : "USDC";
                    recordTransfer({
                      from: account.address,
                      to: preview.to,
                      amount: preview.amount,
                      asset: sentAsset,
                      txHash: hash,
                    });
                    void recordTransferOnServer({
                      txHash: hash,
                      from: account.address,
                      to: preview.to,
                      amount: preview.amount,
                      asset: sentAsset,
                      status: "submitted",
                    })
                      .catch((err) => {
                        console.warn("[send] backend ledger record failed", err);
                      })
                      .finally(() => {
                        void queryClient.invalidateQueries({
                          queryKey: ["wallet-txs"],
                        });
                      });
                  }
                  setPreview(null);
                  void refetch();
                  void queryClient.invalidateQueries({
                    queryKey: ["wallet-txs", account?.address?.toLowerCase()],
                  });
                }}
                onError={(err) => setError(friendlySendError(err.message))}
              >
                确认并发送
              </TransactionButton>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setPreview(null)}
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {txHash ? (
        <Card className="message-in">
          <CardContent className="space-y-2 pt-6 text-sm">
            <p className="font-medium">交易已提交</p>
            <a
              href={getTxExplorerUrl(txHash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 break-all font-mono text-xs text-(--color-foreground) underline-offset-2 hover:underline"
            >
              {txHash}
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <p className="text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Maps common chain errors into user-friendly Chinese copy.
 * @param message - Raw error message
 */
function friendlySendError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("insufficient funds") || lower.includes("exceeds balance")) {
    return "余额不足，无法完成转账（可能还包括网络手续费）。";
  }
  if (lower.includes("user rejected") || lower.includes("denied")) {
    return "你已取消本次交易。";
  }
  if (lower.includes("execution reverted")) {
    return "交易失败。代币合约拒绝了本次转账。";
  }
  return message;
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "break-all text-right font-mono text-xs" : "text-right"}>
        {value}
      </span>
    </div>
  );
}
