import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRightLeft, Languages, LogOut, Settings, User } from "lucide-react";
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
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { queryClient } from "@/lib/query-client";
import { shortAddress } from "@/lib/address";
import { useA2AStore } from "@/stores/a2a";
import { cn } from "@/lib/utils";
import { appChainLabel } from "@/web3";

type Locale = "zh" | "en";

/**
 * 设置页：账户信息、语言切换（仅 UI）、退出，以及 A2A 转入。
 */
export function SettingsPage() {
  const navigate = useNavigate();
  const { address, loginMethod, logout } = useWalletAccount();
  const { usdc } = useWalletBalances();
  const fundFromWallet = useA2AStore((s) => s.fundFromWallet);
  const switchWallet = useA2AStore((s) => s.switchWallet);

  const [locale, setLocale] = useState<Locale>("zh");
  const [fundAmount, setFundAmount] = useState("1");
  const [toast, setToast] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
   * Confirms moving USDC into the A2A spending balance (persisted in Supabase).
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

  /**
   * UI-only language toggle; does not wire real i18n.
   */
  function toggleLocale() {
    setLocale((prev) => (prev === "zh" ? "en" : "zh"));
  }

  /**
   * Disconnects the Privy session and returns to sign-in.
   */
  async function onConfirmLogout() {
    setLoggingOut(true);
    try {
      queryClient.clear();
      await switchWallet(null);
      await logout();
      setLogoutOpen(false);
      navigate("/", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-in md:mx-0">
      <PageHeader icon={Settings} title="设置" />

      <Card className="fade-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" aria-hidden />
            账户
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">钱包地址</p>
              <p className="mt-1 break-all font-mono text-sm font-medium">
                {address ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {appChainLabel} · {shortAddress(address ?? "")}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-[var(--color-muted)]">
              <User className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-xs text-muted-foreground">登录方式</p>
              <p className="mt-1 text-sm font-medium">{loginMethod}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-xs text-muted-foreground">语言</p>
              <p className="mt-1 text-sm font-medium">{locale === "zh" ? "中文" : "English"}</p>
            </div>
            <Button type="button" variant="outline" onClick={toggleLocale}>
              <Languages className="h-4 w-4" aria-hidden />
              {locale === "zh" ? "EN" : "中文"}
            </Button>
          </div>

          <Button type="button" className="w-full" onClick={() => setLogoutOpen(true)}>
            <LogOut className="h-4 w-4" aria-hidden />
            退出登录
          </Button>
        </CardContent>
      </Card>

      {toast ? (
        <div
          className={cn(
            "message-in rounded-md border px-4 py-3 text-sm",
            toast.tone === "ok"
              ? "border-border bg-[var(--color-muted)]"
              : "border-[var(--color-destructive)]/30 bg-red-50 text-[var(--color-destructive)]",
          )}
          role="status"
        >
          {toast.text}
        </div>
      ) : null}

      <Card className="fade-up delay-1">
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

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认退出登录</DialogTitle>
            <DialogDescription>
              退出后需要重新连接钱包才能使用转账与收款功能。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-col">
            <Button
              type="button"
              className="w-full"
              disabled={loggingOut}
              onClick={() => void onConfirmLogout()}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {loggingOut ? "退出中…" : "确认退出"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loggingOut}
              onClick={() => setLogoutOpen(false)}
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fundOpen} onOpenChange={setFundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认转入 A2A</DialogTitle>
            <DialogDescription>
              将从钱包可用余额划入 A2A 可支付余额（演示账本）。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <ConfirmRow label="转入金额" value={`${fundAmount} USDC`} />
            <ConfirmRow label="链上可用" value={`${usdc.toFixed(2)} USDC`} />
            <ConfirmRow label="用途" value="A2A 可支付" />
          </div>
          <DialogFooter className="sm:flex-col">
            <Button
              type="button"
              className="w-full"
              onClick={() => void onConfirmFund()}
            >
              <ArrowRightLeft className="h-4 w-4" aria-hidden />
              确认转入
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setFundOpen(false)}
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
