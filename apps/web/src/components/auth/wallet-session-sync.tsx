import { useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { useA2AStore } from "@/stores/a2a";
import { useWalletAccount } from "@/hooks/use-wallet-account";

/**
 * Links the connected Privy wallet to the backend profile once per user+address,
 * scopes A2A state to the active wallet, and drops cached queries on logout.
 */
export function WalletSessionSync() {
  const { ready, authenticated, address, wallet, user } = useWalletAccount();
  const linkedRef = useRef<string | null>(null);
  const switchWallet = useA2AStore((s) => s.switchWallet);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!ready) return;

    if (!authenticated) {
      linkedRef.current = null;
      queryClient.clear();
      void switchWallet(null);
      return;
    }

    void switchWallet(address ?? null);
  }, [ready, authenticated, address, switchWallet]);

  useEffect(() => {
    if (!authenticated || !address) return;

    const key = `${userId ?? "anon"}:${address.toLowerCase()}`;
    if (linkedRef.current === key) return;

    linkedRef.current = key;
    void apiFetch("/api/auth/link-wallet", {
      method: "POST",
      body: {
        address,
        provider: wallet?.walletClientType ?? "privy",
        chainType: "evm",
      },
    }).catch((error) => {
      console.warn("[auth] link-wallet failed", error);
      linkedRef.current = null;
    });
  }, [authenticated, address, userId, wallet?.walletClientType]);

  return null;
}
