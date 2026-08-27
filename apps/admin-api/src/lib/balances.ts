import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  isAddress,
  type Address,
} from "viem";
import { baseSepolia } from "viem/chains";

const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;

export type OnChainBalance = {
  symbol: string;
  balance: string;
  chain: string;
};

/**
 * Reads ETH + USDC balances on Base Sepolia for one address.
 * Failures return empty array (RPC optional for ops UI).
 * @param address - EVM address
 * @returns Display balances
 */
export async function fetchBaseSepoliaBalances(
  address: string,
): Promise<OnChainBalance[]> {
  if (!isAddress(address)) return [];
  try {
    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });
    const addr = address as Address;
    const [eth, usdc] = await Promise.all([
      client.getBalance({ address: addr }),
      client.readContract({
        address: USDC_BASE_SEPOLIA,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [addr],
      }),
    ]);
    return [
      { symbol: "ETH", balance: formatUnits(eth, 18), chain: "base-sepolia" },
      { symbol: "USDC", balance: formatUnits(usdc, 6), chain: "base-sepolia" },
    ];
  } catch (err) {
    console.error("[balances]", err instanceof Error ? err.message : err);
    return [];
  }
}
