import { useEffect, useRef } from "react";
import {
  useActiveAccount,
  useActiveWalletChain,
  useSwitchActiveWalletChain,
} from "thirdweb/react";
import { appChain } from "@/web3";

/**
 * Automatically switches the connected wallet to the app chain (Sepolia).
 * In-App / social logins often land on the wrong network and show "Switch Network".
 */
export function EnsureAppChain() {
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const switchingRef = useRef(false);

  useEffect(() => {
    if (!account || !activeChain) return;
    if (activeChain.id === appChain.id) {
      switchingRef.current = false;
      return;
    }
    if (switchingRef.current) return;

    switchingRef.current = true;
    void switchChain(appChain)
      .catch((error) => {
        console.warn("[web3] auto switch chain failed", error);
      })
      .finally(() => {
        switchingRef.current = false;
      });
  }, [account, activeChain, switchChain]);

  return null;
}
