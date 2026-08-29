import { useState, type FormEvent } from "react";
import { ArrowRightLeft } from "lucide-react";
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
import { useA2AStore } from "@/stores/a2a";
import { cn } from "@/lib/utils";

/**
 * 将钱包 USDC 划入 A2A 可支付余额。
 */
export function A2AFundPage() {
  const { usdc } = useWalletBalances();
  const a2aBalance = useA2AStore((s) => s.a2aBalance);
  const fundFromWallet = useA2AStore((s) => s.fundFromWallet);

  const [fundAmount, setFundAmount] = useState("1");
  const [toast, setToast] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [fundOpen, setFundOpen] = useState(false);

  /**
   * Shows a short-lived feedback banner.
   */
  function showToast(tone: "ok" | "err", text: string) {
    setToast({ tone, text });
    window.setTimeout(() => setToast(null), 2800);
  }

  /**
   * Opens the fund confirmation dialog after basic validation.
   */
  function onFundSubmit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(fundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("err", "请输入有效金额");
      return;
    }
    if (amount > usdc) {
      showToast("err", "钱包可用 USDC 不足");
      return;
    }
    setFundOpen(true);
  }

  /**
   * Confirms moving USDC into the A2A spending balance.
   */
  async function onConfirmFund() {
    const amount = Number(fundAmount);
    setFundOpen(false);
    const error = await fundFromWallet(amount);
    if (error) {
      showToast("err", error);
      return;
    }
    showToast("ok", `已转入 ${amount} USDC 到 A2A 余额`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-in md:mx-0">
      <PageHeader icon={ArrowRightLeft} title="A2A 转入" tone="sky" />

      <p className="text-sm text-muted-foreground">
        将钱包 USDC 划入 A2A 可支付余额，供 Agent 在限额内自动结算。当前可支付{" "}
        {a2aBalance.toFixed(2)} USDC。
      </p>

      {toast ? (
        <div
          className={cn(
            "message-in rounded-md border px-4 py-3 text-sm",
            toast.tone === "ok"
              ? "border-border bg-muted"
              : "border-[var(--color-destructive)]/30 bg-red-50 text-[var(--color-destructive)]",
          )}
          role="status"
        >
          {toast.text}
        </div>
      ) : null}

      <Card className="fade-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" aria-hidden />
            从钱包转入 A2A
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onFundSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="fund-amount">
                转入金额（USDC）· 链上可用 {usdc.toFixed(2)}
              </label>
              <Input
                id="fund-amount"
                inputMode="decimal"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                placeholder="例如 1"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {["0.1", "1", "5"].map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setFundAmount(value)}
                >
                  {value}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setFundAmount(String(usdc))}
              >
                全部
              </Button>
            </div>
            <Button type="submit" className="w-full">
              <ArrowRightLeft className="h-4 w-4" aria-hidden />
              确认转入
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={fundOpen} onOpenChange={setFundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认转入 A2A</DialogTitle>
            <DialogDescription>
              将从钱包可用余额划入 A2A 可支付余额。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <ConfirmRow label="转入金额" value={`${fundAmount} USDC`} />
            <ConfirmRow label="链上可用" value={`${usdc.toFixed(2)} USDC`} />
            <ConfirmRow label="用途" value="A2A 可支付" />
          </div>
          <DialogFooter className="sm:flex-col">
            <Button type="button" className="w-full" onClick={() => void onConfirmFund()}>
              <ArrowRightLeft className="h-4 w-4" aria-hidden />
              确认转入
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => setFundOpen(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Confirmation dialog key/value row.
 * @param label - Field label
 * @param value - Field value
 */
function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
