import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { LoaderCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/utils/format";

/**
 * Login / register page (wallet web visual language).
 */
export function LoginPage() {
  const { login, register, remote, isLoggedIn, ready } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: remote ? "" : "demo@xone.dev",
    password: remote ? "" : "demo",
    confirm: remote ? "" : "demo",
  });

  if (ready && isLoggedIn) {
    return <Navigate to={params.get("redirect") || "/api-keys"} replace />;
  }

  /**
   * Switches auth mode and clears form defaults.
   */
  function switchMode(next: "login" | "register"): void {
    setMode(next);
    setError(null);
    if (next === "register") {
      setForm({ name: "", email: "", password: "", confirm: "" });
    } else if (remote) {
      setForm({ name: "", email: "", password: "", confirm: "" });
    } else {
      setForm({
        name: "",
        email: "demo@xone.dev",
        password: "demo",
        confirm: "demo",
      });
    }
  }

  /**
   * Submits login or register.
   */
  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "register") {
        if (form.password !== form.confirm) {
          throw new Error("Passwords do not match");
        }
        await register({
          email: form.email,
          password: form.password,
          name: form.name,
        });
      } else {
        await login(form.email, form.password);
      }
      navigate(params.get("redirect") || "/api-keys", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-95 space-y-8 animate-in">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-border bg-white shadow-[0_8px_24px_rgba(10,10,10,0.04)]">
            <Wallet className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">XOne</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "register" ? "Create your account" : "Sign in to the console"}
            </p>
          </div>
        </div>

        <Card className="fade-up overflow-hidden">
          <CardContent className="p-6">
            <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
              <p className="text-sm text-muted-foreground">
                {remote
                  ? "Manage API keys and agent wallets for x402 payments."
                  : (
                    <>
                      Demo —{" "}
                      <code className="font-mono text-xs">demo@xone.dev</code> /{" "}
                      <code className="font-mono text-xs">demo</code>
                    </>
                  )}
              </p>

              {mode === "register" ? (
                <div className="space-y-1.5">
                  <label htmlFor="name" className="text-sm font-medium">
                    Name
                  </label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Optional display name"
                    autoComplete="name"
                  />
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="your@email.com"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={
                    mode === "register" ? "At least 8 characters" : "Enter your password"
                  }
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                />
              </div>

              {mode === "register" ? (
                <div className="space-y-1.5">
                  <label htmlFor="confirm" className="text-sm font-medium">
                    Confirm password
                  </label>
                  <Input
                    id="confirm"
                    type="password"
                    required
                    value={form.confirm}
                    onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                  />
                </div>
              ) : null}

              {error ? (
                <p className="text-sm text-[var(--color-destructive)]">{error}</p>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                {mode === "register" ? "Create account" : "Sign in"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {mode === "register" ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                      onClick={() => switchMode("login")}
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    New here?{" "}
                    <button
                      type="button"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                      onClick={() => switchMode("register")}
                    >
                      Create an account
                    </button>
                  </>
                )}
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
