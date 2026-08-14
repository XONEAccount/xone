import { useEffect, useRef } from "react";
import { appChain } from "@/web3";
import { useWalletAccount } from "@/hooks/use-wallet-account";

/**
 * Automatically switches the connected wallet to the app chain (Base Sepolia).
 */
export function EnsureAppChain() {
  const { wallet } = useWalletAccount();
  const switchingRef = useRef(false);

  useEffect(() => {
    if (!wallet) return;
    const current = Number(String(wallet.chainId).split(":").pop());
    if (current === appChain.id) {
      switchingRef.current = false;
      return;
    }
    if (switchingRef.current) return;

    switchingRef.current = true;
    void wallet
      .switchChain(appChain.id)
      .catch((error) => {
        console.warn("[web3] auto switch chain failed", error);
      })
      .finally(() => {
        switchingRef.current = false;
      });
  }, [wallet, wallet?.chainId]);

  return null;
}
