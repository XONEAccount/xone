import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWalletAccount } from "@/hooks/use-wallet-account";

const CONNECT_WAIT_MS = 8_000;

/**
 * Guards app routes behind an authenticated Privy session with an EVM address.
 * Shows a timed fallback so refresh never sticks on a blank skeleton forever.
 * @param children - Protected content
 */
export function RequireWallet({ children }: { children: ReactNode }) {
  const { ready, authenticated, address } = useWalletAccount();
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!ready || (authenticated && address)) {
      setTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => setTimedOut(true), CONNECT_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [ready, authenticated, address]);

  if (address && authenticated) {
    return children;
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-32 w-full" />
          <p className="text-center text-xs text-muted-foreground">
            正在恢复钱包连接…
          </p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (timedOut && !address) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">
          钱包会话恢复超时，请重新登录。
        </p>
        <Button asChild>
          <Link to="/" replace state={{ from: location.pathname }}>
            返回登录
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <p className="text-center text-xs text-muted-foreground">
          正在创建钱包…
        </p>
      </div>
    </div>
  );
}
