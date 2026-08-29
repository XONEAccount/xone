import { useState } from "react";
import { Check, Copy, CreditCard, ExternalLink } from "lucide-react";
import { DEFAULT_CHAIN } from "@xone/config";
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { useI18n } from "@/hooks/use-i18n";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MessageKey } from "@/lib/i18n/messages";
import { USDC_ADDRESS, appChainLabel } from "@/web3";

const FAUCETS: Array<{
  name: string;
  href: string;
  noteKey: MessageKey;
}> = [
  {
    name: "Circle Base Sepolia USDC",
    href: "https://faucet.circle.com/",
    noteKey: "pay.faucet.circle.note",
  },
  {
    name: "Coinbase Base Sepolia Faucet",
    href: "https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet",
    noteKey: "pay.faucet.coinbase.note",
  },
  {
    name: "Alchemy Base Sepolia Faucet",
    href: "https://www.alchemy.com/faucets/base-sepolia",
    noteKey: "pay.faucet.alchemy.note",
  },
];

/**
 * Top-up page (Sepolia): faucet guidance instead of fiat BuyWidget on testnet.
 */
export function PayPage() {
  const { t } = useI18n();
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
      <PageHeader icon={CreditCard} title={t("pay.title")} tone="amber" />

      <Card className="fade-up">
        <CardHeader>
          <CardTitle>{t("pay.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("pay.intro", { chain: appChainLabel })}
          </p>

          <div className="rounded-md border border-border bg-muted p-4">
            <p className="text-xs text-muted-foreground">{t("pay.receiveAddress")}</p>
            <p className="mt-1 break-all font-mono text-sm">
              {address || t("pay.notConnected")}
            </p>
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
                  {t("pay.copied")}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden />
                  {t("pay.copyAddress")}
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium">{t("pay.assetsTitle")}</p>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              <li>
                {t("pay.network", {
                  name: DEFAULT_CHAIN.name,
                  id: DEFAULT_CHAIN.id,
                })}
              </li>
              <li>{t("pay.native")}</li>
              <li>
                {t("pay.usdc")}
                <span className="break-all font-mono text-xs">
                  {USDC_ADDRESS ?? t("pay.usdcMissing")}
                </span>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("pay.faucetsTitle")}</p>
            {FAUCETS.map((faucet) => (
              <a
                key={faucet.href}
                href={faucet.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-3 text-sm transition-colors hover:bg-muted"
              >
                <span>
                  <span className="font-medium">{faucet.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t(faucet.noteKey)}
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
