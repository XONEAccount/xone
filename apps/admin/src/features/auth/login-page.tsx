import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { LoaderCircle, Shield, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage, shorten } from "@/lib/utils";

type Step = "idle" | "connect" | "sign" | "done";

/**
 * SIWE-lite admin login (challenge → sign → JWT).
 */
export function LoginPage() {
  const { loginWithWallet, isLoggedIn, ready } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState<Step>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (ready && isLoggedIn) {
    return <Navigate to={params.get("redirect") || "/"} replace />;
  }

  const busy = step === "connect" || step === "sign";

  /**
   * Runs connect → challenge → sign → session.
   */
  async function onLogin(): Promise<void> {
    setError(null);
    setAddress(null);
    setStep("connect");
    try {
      await loginWithWallet({
        onConnected: (addr) => {
          setAddress(addr);
          setStep("sign");
        },
      });
      setStep("done");
      navigate(params.get("redirect") || "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setStep("idle");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-95 space-y-8 animate-in">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-border bg-white shadow-[0_8px_24px_rgba(10,10,10,0.04)]">
            <Shield className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">XOne Admin</h1>
            <p className="text-sm text-muted-foreground">
              Wallet login — challenge, signature, allowlist. No password.
            </p>
          </div>
        </div>

        <Card className="fade-up overflow-hidden">
          <CardContent className="space-y-5 p-6">
            {address ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs">
                {shorten(address, 10, 8)}
              </p>
            ) : null}

            {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}

            <Button
              type="button"
              className="w-full"
              disabled={busy}
              onClick={() => void onLogin()}
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" strokeWidth={1.75} />
              )}
              {step === "connect"
                ? "Connecting…"
                : step === "sign"
                  ? "Waiting for signature…"
                  : "Connect wallet & sign"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
