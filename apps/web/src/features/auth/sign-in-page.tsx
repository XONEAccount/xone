import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLoginWithEmail, useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import { LoaderCircle, Mail, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Skeleton } from "@/components/ui/skeleton";
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { useI18n } from "@/hooks/use-i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { assertChainAlignment } from "@/web3";

assertChainAlignment();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CREATE_WAIT_MS = 12_000;

/**
 * Sign-in: email OTP, Google / GitHub, external wallet.
 */
export function SignInPage() {
  const { t, locale, toggleLocale } = useI18n();
  const { ready, authenticated, login, logout } = usePrivy();
  const { address } = useWalletAccount();
  const navigate = useNavigate();
  const [createTimedOut, setCreateTimedOut] = useState(false);

  useEffect(() => {
    if (ready && authenticated && address) {
      navigate("/app", { replace: true });
    }
  }, [ready, authenticated, address, navigate]);

  useEffect(() => {
    if (!authenticated || address) {
      setCreateTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setCreateTimedOut(true), CREATE_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [authenticated, address]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleLocale}
          aria-label={t("auth.language")}
        >
          {locale === "zh" ? t("settings.switchToEn") : t("settings.switchToZh")}
        </Button>
      </div>
      <div className="w-full max-w-[380px] space-y-8 animate-in">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl brand-mark float-y">
            <Wallet className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">{t("brand.name")}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.subtitle")}</p>
          </div>
        </div>

        <Card className="fade-up overflow-hidden">
          <CardContent className="p-6">
            {!ready ? (
              <div className="space-y-3">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            ) : authenticated && !address ? (
              <div className="space-y-3 py-2 text-center">
                <p className="text-sm text-muted-foreground">
                  {createTimedOut ? t("auth.createTimedOut") : t("auth.creatingWallet")}
                </p>
                {createTimedOut ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => void logout()}
                  >
                    {t("auth.backToLogin")}
                  </Button>
                ) : null}
              </div>
            ) : (
              <LoginMethods
                onWallet={() => login({ loginMethods: ["wallet"] })}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type SocialProvider = "google" | "github";
type AuthPending = "email" | "otp" | SocialProvider | "wallet";

/**
 * Headless email OTP + Google / GitHub OAuth + wallet connect.
 * @param onWallet - Opens Privy wallet-only login
 */
function LoginMethods({ onWallet }: { onWallet: () => void }) {
  const { t } = useI18n();
  const { authenticated, logout } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { initOAuth, loading: oauthLoading } = useLoginWithOAuth();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [pending, setPending] = useState<AuthPending | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = pending != null || oauthLoading;
  const emailValid = EMAIL_RE.test(email.trim());

  /**
   * Ends a leftover Privy session so the next method creates a new user
   * instead of linking onto the previous account.
   */
  async function ensureLoggedOut(): Promise<void> {
    if (!authenticated) return;
    await logout();
  }

  /**
   * Sends a one-time code to the entered email.
   */
  async function onSendCode(event: FormEvent) {
    event.preventDefault();
    if (!emailValid || busy) return;
    setError(null);
    setPending("email");
    try {
      await ensureLoggedOut();
      await sendCode({ email: email.trim() });
      setStep("otp");
      setCode("");
    } catch (err) {
      setError(friendlyAuthError(err, t));
    } finally {
      setPending(null);
    }
  }

  /**
   * Completes email login with the OTP.
   * @param nextCode - Optional code from the OTP cells (avoids stale state on auto-submit)
   */
  async function onVerifyCode(event?: FormEvent, nextCode?: string) {
    event?.preventDefault();
    const otp = (nextCode ?? code).replace(/\D/g, "");
    if (otp.length < 6 || busy) return;
    setError(null);
    setPending("otp");
    try {
      await loginWithCode({ code: otp });
    } catch (err) {
      setError(friendlyAuthError(err, t));
    } finally {
      setPending(null);
    }
  }

  /**
   * Starts Google or GitHub OAuth (redirect / popup).
   * @param provider - OAuth provider id
   */
  async function onOAuth(provider: "google" | "github") {
    if (busy) return;
    setError(null);
    setPending(provider);
    try {
      await ensureLoggedOut();
      await initOAuth({ provider });
    } catch (err) {
      setError(friendlyAuthError(err, t));
      setPending(null);
    }
  }

  /**
   * Opens the wallet picker (MetaMask / WalletConnect, etc.).
   */
  async function onWalletClick() {
    if (busy) return;
    setError(null);
    setPending("wallet");
    try {
      await ensureLoggedOut();
      onWallet();
    } catch (err) {
      setError(friendlyAuthError(err, t));
    } finally {
      window.setTimeout(() => setPending(null), 400);
    }
  }

  if (step === "otp") {
    return (
      <form className="space-y-4" onSubmit={(e) => void onVerifyCode(e)}>
        <p className="text-sm text-muted-foreground">
          {t("auth.codeSent", { email: email.trim() })}
        </p>
        <InputOTP
          maxLength={6}
          value={code}
          disabled={busy}
          containerClassName="w-full"
          onChange={setCode}
          onComplete={(otp) => void onVerifyCode(undefined, otp)}
        >
          <InputOTPGroup className="w-full justify-between gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className="h-12 min-w-0 flex-1 rounded-md border border-input text-lg first:rounded-md last:rounded-md"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
          {pending === "otp" ? <Spinner /> : t("auth.signIn")}
        </Button>
        <Button
          type="button"
          variant="link"
          className="h-auto w-full p-0 text-xs text-muted-foreground"
          disabled={busy}
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
        >
          {t("auth.otherEmail")}
        </Button>
        {error ? <AuthError message={error} /> : null}
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(e) => void onSendCode(e)}>
        <div className="relative min-w-0 flex-1">
          <Mail
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-9"
            required
          />
        </div>
        <Button type="submit" disabled={busy || !emailValid} className="shrink-0">
          {pending === "email" ? <Spinner /> : t("auth.submit")}
        </Button>
      </form>

      <Divider />

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full justify-center"
        disabled={busy}
        onClick={() => void onOAuth("google")}
      >
        {pending === "google" || oauthLoading ? <Spinner /> : <GoogleMark />}
        Google
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full justify-center"
        disabled={busy}
        onClick={() => void onOAuth("github")}
      >
        {pending === "github" ? <Spinner /> : <GitHubMark />}
        GitHub
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full justify-center"
        disabled={busy}
        onClick={() => void onWalletClick()}
      >
        {pending === "wallet" ? (
          <Spinner />
        ) : (
          <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        )}
        {t("auth.continueWithWallet")}
      </Button>

      {error ? <AuthError message={error} /> : null}
    </div>
  );
}

function Divider() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 py-1" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[11px] tracking-wide text-muted-foreground">{t("auth.or")}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function Spinner() {
  return <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />;
}

function AuthError({ message }: { message: string }) {
  return (
    <p className={cn("text-center text-sm text-destructive")} role="alert">
      {message}
    </p>
  );
}

function GitHubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 4.84c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A8.99 8.99 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.4 5.4 0 0 1 3.69 9c0-.6.1-1.17.28-1.71V4.96H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A8.99 8.99 0 0 0 .96 4.96L3.97 7.29C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * Maps Privy / network errors into short localized copy.
 * @param err - Thrown value
 * @param t - Translator
 */
function friendlyAuthError(
  err: unknown,
  t: (key: MessageKey) => string,
): string {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes("not allowed")) {
    return t("auth.errorNotAllowed");
  }
  if (lower.includes("invalid") && lower.includes("code")) {
    return t("auth.errorInvalidCode");
  }
  if (lower.includes("too many")) {
    return t("auth.errorTooMany");
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return t("auth.errorNetwork");
  }
  return message || t("auth.errorGeneric");
}
