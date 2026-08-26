import { Languages, LogOut, Settings, User } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useI18n } from "@/hooks/use-i18n";
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { queryClient } from "@/lib/query-client";
import { useA2AStore } from "@/stores/a2a";

/**
 * Settings: account info, language toggle, sign out.
 */
export function SettingsPage() {
  const navigate = useNavigate();
  const { t, locale, toggleLocale } = useI18n();
  const { address, loginMethod, logout } = useWalletAccount();
  const switchWallet = useA2AStore((s) => s.switchWallet);

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const displayLoginMethod =
    loginMethod === "Privy embedded wallet"
      ? t("settings.loginPrivyEmbedded")
      : loginMethod;

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
      <PageHeader icon={Settings} title={t("settings.title")} />

      <Card className="fade-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" aria-hidden />
            {t("settings.account")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {t("settings.walletAddress")}
              </p>
              <p className="mt-1 break-all font-mono text-sm font-medium">
                {address ?? "—"}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
              <User className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {t("settings.loginMethod")}
              </p>
              <p className="mt-1 text-sm font-medium">{displayLoginMethod}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {t("settings.language")}
              </p>
              <p className="mt-1 text-sm font-medium">
                {locale === "zh"
                  ? t("settings.languageZh")
                  : t("settings.languageEn")}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={toggleLocale}>
              <Languages className="h-4 w-4" aria-hidden />
              {locale === "zh"
                ? t("settings.switchToEn")
                : t("settings.switchToZh")}
            </Button>
          </div>

          <Button type="button" className="w-full" onClick={() => setLogoutOpen(true)}>
            <LogOut className="h-4 w-4" aria-hidden />
            {t("settings.logout")}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.logoutConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("settings.logoutConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-col">
            <Button
              type="button"
              className="w-full"
              disabled={loggingOut}
              onClick={() => void onConfirmLogout()}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {loggingOut
                ? t("settings.logoutPending")
                : t("settings.logoutConfirm")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loggingOut}
              onClick={() => setLogoutOpen(false)}
            >
              {t("settings.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
