import { erc20Abi, formatUnits } from "viem";
import { SUPPORTED_ASSETS } from "@xone/config";
import { appChain } from "@/web3/chains";
import { getPublicClient } from "@/web3/client";

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
  const client = getPublicClient();
  const owner = address as `0x${string}`;

  const results = await Promise.all(
    SUPPORTED_ASSETS.map(async (asset) => {
      try {
        const value = asset.address
          ? await client.readContract({
              address: asset.address as `0x${string}`,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [owner],
            })
          : await client.getBalance({ address: owner });

        return {
          symbol: asset.symbol,
          name: asset.name,
          address: asset.address,
          decimals: asset.decimals,
          balance: value.toString(),
          displayValue: formatDisplay(value, asset.decimals),
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

/**
 * Formats a token amount for UI display without grouping separators.
 * @param value - Raw integer amount
 * @param decimals - Token decimals
 */
function formatDisplay(value: bigint, decimals: number): string {
  const formatted = formatUnits(value, decimals);
  const numeric = Number(formatted);
  if (!Number.isFinite(numeric)) return formatted;
  return numeric.toLocaleString("en-US", {
    useGrouping: false,
    maximumFractionDigits: Math.min(6, decimals),
  });
}
