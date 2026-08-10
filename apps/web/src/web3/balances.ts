import { getWalletBalance } from "thirdweb/wallets";
import { SUPPORTED_ASSETS } from "@wallet/config";
import { thirdwebClient } from "@/web3/client";
import { appChain } from "@/web3/chains";

export interface TokenBalanceView {
  symbol: string;
  name: string;
  address: string | null;
  decimals: number;
  balance: string;
  displayValue: string;
  chainId: number;
}

/**
 * Fetches ETH + configured ERC-20 balances for an address on the app chain.
 * @param address - Wallet address
 * @returns Normalized balance list
 */
export async function fetchTokenBalances(address: string): Promise<TokenBalanceView[]> {
  const results = await Promise.all(
    SUPPORTED_ASSETS.map(async (asset) => {
      try {
        const balance = await getWalletBalance({
          address,
          client: thirdwebClient,
          chain: appChain,
          ...(asset.address ? { tokenAddress: asset.address } : {}),
        });

        return {
          symbol: asset.symbol,
          name: asset.name,
          address: asset.address,
          decimals: asset.decimals,
          balance: balance.value.toString(),
          displayValue: balance.displayValue,
          chainId: appChain.id,
        } satisfies TokenBalanceView;
      } catch (error) {
        console.warn(`[web3] balance failed for ${asset.symbol}`, error);
        return {
          symbol: asset.symbol,
          name: asset.name,
          address: asset.address,
          decimals: asset.decimals,
          balance: "0",
          displayValue: "0",
          chainId: appChain.id,
        } satisfies TokenBalanceView;
      }
    }),
  );

  return results;
}

/**
 * Returns a single asset display balance, or "0" when missing.
 * @param balances - Balance list
 * @param symbol - Asset symbol
 */
export function findDisplayBalance(balances: TokenBalanceView[], symbol: string): string {
  return balances.find((item) => item.symbol === symbol)?.displayValue ?? "0";
}
