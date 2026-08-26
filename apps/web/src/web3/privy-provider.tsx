import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { APP_NAME } from "@xone/config";
import { getWebEnv } from "@/lib/env";
import { appChain, sepoliaChain } from "@/web3/chains";

/**
 * Privy wallet + auth provider for the web app.
 * @param children - Application tree
 */
export function WalletPrivyProvider({ children }: { children: ReactNode }) {
  const env = getWebEnv();

  return (
    <PrivyProvider
      appId={env.privyAppId || "missing-privy-app-id"}
      {...(env.privyClientId ? { clientId: env.privyClientId } : {})}
      config={{
        defaultChain: appChain,
        supportedChains: [appChain, sepoliaChain],
        appearance: {
          theme: "light",
          accentColor: "#171717",
          landingHeader: APP_NAME,
          loginMessage: "登录以使用钱包",
          showWalletLoginFirst: false,
          walletChainType: "ethereum-only",
        },
        loginMethods: ["email", "google", "github", "wallet"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
