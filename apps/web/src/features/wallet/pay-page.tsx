import { useState } from "react";
import { Check, Copy, CreditCard, ExternalLink } from "lucide-react";
import { DEFAULT_CHAIN } from "@wallet/config";
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { USDC_ADDRESS, appChainLabel } from "@/web3";

const FAUCETS = [
  {
    name: "Circle Base Sepolia USDC",
    href: "https://faucet.circle.com/",
    note: "领取测试 USDC（选择 Base Sepolia）",
  },
  {
    name: "Coinbase Base Sepolia Faucet",
    href: "https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet",
    note: "领取测试 ETH（付 gas）",
  },
  {
    name: "Alchemy Base Sepolia Faucet",
    href: "https://www.alchemy.com/faucets/base-sepolia",
    note: "领取测试 ETH（付 gas）",
  },
] as const;

/**
 * 充值页（Sepolia）：BuyWidget 在测试网会因法币汇率崩溃，改为水龙头引导。
 */
export function PayPage() {
  const { address: connected } = useWalletAccount();
  const address = connected ?? "";
  const [copied, setCopied] = useState(false);

  /**
   * Copies the connected wallet address.
   */
  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 animate-in md:mx-0">
      <PageHeader icon={CreditCard} title="充值" />

      <Card className="fade-up">
        <CardHeader>
          <CardTitle>测试网充值</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            当前网络是 {appChainLabel}。测试网请用水龙头领取，向他人转账请用「转账」。
            向他人转账请用「转账」。
          </p>

          <div className="rounded-md border border-border bg-[var(--color-muted)] p-4">
            <p className="text-xs text-muted-foreground">收款地址</p>
            <p className="mt-1 break-all font-mono text-sm">{address || "未连接钱包"}</p>
            <Button
              type="button"
              className="mt-3 w-full"
              variant="outline"
              onClick={copyAddress}
              disabled={!address}
            >
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
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium">资产说明</p>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              <li>网络：{DEFAULT_CHAIN.name}（chainId {DEFAULT_CHAIN.id}）</li>
              <li>原生币：ETH</li>
              <li>
                USDC：
                <span className="break-all font-mono text-xs">
                  {USDC_ADDRESS ?? "未配置"}
                </span>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">水龙头</p>
            {FAUCETS.map((faucet) => (
              <a
                key={faucet.href}
                href={faucet.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-3 text-sm transition-colors hover:bg-[var(--color-muted)]"
              >
                <span>
                  <span className="font-medium">{faucet.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {faucet.note}
                  </span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
