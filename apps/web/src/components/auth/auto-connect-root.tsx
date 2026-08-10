import { AutoConnect } from "thirdweb/react";
import { appChain, appWallets, thirdwebClient } from "@/web3";

/**
 * Global AutoConnect so refreshing /app/* can restore the last wallet session.
 */
export function AutoConnectRoot() {
  return (
    <AutoConnect
      client={thirdwebClient}
      wallets={appWallets}
      chain={appChain}
      timeout={8_000}
    />
  );
}
