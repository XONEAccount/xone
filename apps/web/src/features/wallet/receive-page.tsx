import { useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";
import { DEFAULT_CHAIN } from "@xone/config";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QRCodeSVG } from "qrcode.react";
import { useWalletAccount } from "@/hooks/use-wallet-account";

/**
 * 收款页：展示地址 + 二维码。
 */
export function ReceivePage() {
  const { address } = useWalletAccount();
  const walletAddress = address ?? "";
  const [copied, setCopied] = useState(false);

  /**
   * Copies the wallet address to the clipboard.
   */
  async function copyAddress() {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
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

          {walletAddress ? (
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted p-4">
              <AddressIdenticon address={walletAddress} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">钱包地址</p>
                <p className="mt-1 break-all font-mono text-sm">{walletAddress}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-border bg-muted p-4 text-center text-sm text-muted-foreground">
              未连接钱包
            </div>
          )}

          <div className="flex items-center justify-center rounded-md border border-border bg-white p-6 transition-transform duration-300 hover:scale-[1.01]">
            {walletAddress ? (
              <QRCodeSVG
                value={walletAddress}
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
          <Button className="w-full" onClick={copyAddress} disabled={!walletAddress}>
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
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Neutral identicon derived from the address (grayscale only).
 * @param address - Wallet address
 */
function AddressIdenticon({ address }: { address: string }) {
  const tone = (Number.parseInt(address.slice(2, 4), 16) % 55) + 22;
  return (
    <div
      className="h-10 w-10 shrink-0 rounded-full border border-border"
      style={{ background: `hsl(0 0% ${tone}%)` }}
      aria-hidden
    />
  );
}
