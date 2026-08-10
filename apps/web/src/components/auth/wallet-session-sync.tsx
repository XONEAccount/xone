import { useEffect, useRef } from "react";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import { apiFetch } from "@/lib/api";
import { useA2AStore } from "@/stores/a2a";

/**
 * Links the connected thirdweb wallet to the backend profile once per address,
 * and scopes local A2A demo balance to the active wallet.
 */
export function WalletSessionSync() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const linkedRef = useRef<string | null>(null);
  const switchWallet = useA2AStore((s) => s.switchWallet);

  useEffect(() => {
    void switchWallet(account?.address ?? null);
  }, [account?.address, switchWallet]);

  useEffect(() => {
    const address = account?.address;
    if (!address || linkedRef.current === address) return;

    linkedRef.current = address;
    void apiFetch("/api/auth/link-wallet", {
      method: "POST",
      body: {
        address,
        provider: wallet?.id ?? "thirdweb",
        chainType: "evm",
      },
    }).catch((error) => {
      console.warn("[auth] link-wallet failed", error);
      linkedRef.current = null;
    });
  }, [account?.address, wallet?.id]);

  return null;
}
