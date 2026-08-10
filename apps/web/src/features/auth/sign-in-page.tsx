import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ConnectEmbed, useActiveAccount } from "thirdweb/react";
import { Wallet } from "lucide-react";
import { APP_NAME } from "@wallet/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  appChain,
  appWallets,
  assertChainAlignment,
  connectTheme,
  thirdwebClient,
} from "@/web3";

assertChainAlignment();

/**
 * 登录页：邮箱 / GitHub / 社交登录 / MetaMask 等常见方式（thirdweb ConnectEmbed）。
 */
export function SignInPage() {
  const account = useActiveAccount();
  const navigate = useNavigate();

  useEffect(() => {
    if (account?.address) {
      navigate("/app", { replace: true });
    }
  }, [account?.address, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-8 animate-in">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-border bg-white shadow-[0_8px_24px_rgba(10,10,10,0.04)]">
            <Wallet className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
        </div>

        <Card className="fade-up overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>登录 / 注册</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center px-2 pb-6 sm:px-4">
            <ConnectEmbed
              client={thirdwebClient}
              chain={appChain}
              wallets={appWallets}
              theme={connectTheme}
              showThirdwebBranding={false}
              privacyPolicyUrl="https://thirdweb.com/privacy"
              termsOfServiceUrl="https://thirdweb.com/terms"
            />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          支持邮箱验证码、GitHub / Google / Apple / Discord、手机号、Passkey，
          以及 MetaMask、Coinbase、Rainbow、WalletConnect 等外部钱包。
        </p>
      </div>
    </div>
  );
}
