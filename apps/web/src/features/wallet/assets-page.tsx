import { Coins } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useWalletBalances } from "@/hooks/use-wallet-balances";

/**
 * 资产列表：当前网络下的代币余额。
 */
export function AssetsPage() {
  const { balances, isLoading } = useWalletBalances();
  const assets = balances.length
    ? [...balances].sort((a, b) => (a.symbol === "USDC" ? -1 : b.symbol === "USDC" ? 1 : 0))
    : [
        { symbol: "USDC", name: "USD Coin", displayValue: "0" },
        { symbol: "ETH", name: "Ether", displayValue: "0" },
      ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 animate-in md:mx-0">
      <PageHeader icon={Coins} title="资产" tone="teal" />

      <div className="divide-y divide-border rounded-md border border-border bg-white fade-up">
        {assets.map((asset) => (
          <div key={asset.symbol} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{asset.symbol}</p>
              <p className="text-xs text-muted-foreground">{asset.name}</p>
            </div>
            {isLoading ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <p className="font-mono">
                {Number(asset.displayValue).toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
