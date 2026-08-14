import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Languages, LogOut, Settings, User } from "lucide-react";
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
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { queryClient } from "@/lib/query-client";
import { shortAddress } from "@/lib/address";
import { useA2AStore } from "@/stores/a2a";
import { appChainLabel } from "@/web3";

type Locale = "zh" | "en";

/**
 * 设置页：账户信息、语言切换（仅 UI）、退出登录。
 */
export function SettingsPage() {
  const navigate = useNavigate();
  const { address, loginMethod, logout } = useWalletAccount();
  const switchWallet = useA2AStore((s) => s.switchWallet);

  const [locale, setLocale] = useState<Locale>("zh");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
    </div>
  );
}
