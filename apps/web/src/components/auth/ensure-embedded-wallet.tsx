import { useEffect, useRef } from "react";
import {
  getEmbeddedConnectedWallet,
  useCreateWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { userWalletAddresses } from "@/hooks/use-wallet-account";

/**
 * Headless email / OAuth login does not honor createOnLogin. Creates an
 * embedded Ethereum wallet once the Privy user is authenticated without one.
 */
export function EnsureEmbeddedWallet() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const creatingRef = useRef(false);
  const userId = user?.id ?? null;

  useEffect(() => {
    creatingRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (!ready || !authenticated || !user || !walletsReady) return;
    if (creatingRef.current) return;

    const hasUserWallet = userWalletAddresses(user).length > 0;
    const hasConnector = Boolean(
      getEmbeddedConnectedWallet(wallets) ??
        wallets.find((item) => item.walletClientType === "privy"),
    );
    if (hasUserWallet || hasConnector) return;

    creatingRef.current = true;
    void createWallet()
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("already")) return;
        console.warn("[wallet] createWallet failed", error);
      })
      .finally(() => {
        creatingRef.current = false;
      });
  }, [ready, authenticated, user, wallets, walletsReady, createWallet]);

  return null;
}
