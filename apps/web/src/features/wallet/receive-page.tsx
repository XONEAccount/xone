import { useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";
import {
  AccountAddress,
  AccountBlobbie,
  AccountProvider,
  useActiveAccount,
} from "thirdweb/react";
import { DEFAULT_CHAIN } from "@wallet/config";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QRCodeSVG } from "qrcode.react";
import { thirdwebClient } from "@/web3";

/**
 * 收款页：thirdweb Account 组件展示地址 + 二维码。
 */
export function ReceivePage() {
  const account = useActiveAccount();
  const address = account?.address ?? "";
  const [copied, setCopied] = useState(false);

  /**
   * Copies the wallet address to the clipboard.
   */
  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 animate-in">
      <PageHeader icon={QrCode} title="收款" className="justify-center" />

      <Card className="fade-up">
        <CardHeader>
          <CardTitle>我的地址</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            仅向此地址转入 {DEFAULT_CHAIN.name} 上的资产。发送到错误网络可能导致资产丢失。
          </p>

          {address ? (
            <AccountProvider address={address} client={thirdwebClient}>
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted p-4">
                <AccountBlobbie className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">钱包地址</p>
                  <AccountAddress
                    className="mt-1 block break-all font-mono text-sm"
                    formatFn={(value) => value}
                  />
                </div>
              </div>
            </AccountProvider>
          ) : (
            <div className="rounded-md border border-border bg-muted p-4 text-center text-sm text-muted-foreground">
              未连接钱包
            </div>
          )}

          <div className="flex items-center justify-center rounded-md border border-border bg-white p-6 transition-transform duration-300 hover:scale-[1.01]">
            {address ? (
              <QRCodeSVG
                value={address}
                size={220}
                level="M"
                bgColor="#ffffff"
                fgColor="#0a0a0a"
                marginSize={1}
                title="钱包收款地址二维码"
              />
            ) : (
              <p className="text-sm text-muted-foreground">连接钱包后显示二维码</p>
            )}
          </div>
          <Button className="w-full" onClick={copyAddress} disabled={!address}>
            {copied ? (
              <>
                <Check className="h-4 w-4" aria-hidden />
                已复制
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden />
                复制地址
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            也可点击右上角账户菜单 → Receive Funds 查看 thirdweb 内置收款页。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
