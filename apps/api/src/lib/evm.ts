import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  type Address,
  type Chain,
  type PublicClient,
} from "viem";
import { baseSepolia, sepolia } from "viem/chains";
import { getEnv } from "./env.js";

/**
 * Maps a product chain slug to a viem chain.
 * @param slug - `base-sepolia` or `ethereum-sepolia`
 */
export function chainFromSlug(slug?: string): Chain {
  return slug === "ethereum-sepolia" ? sepolia : baseSepolia;
}

/**
 * Builds a viem public client for reads.
 * @param chain - Target chain
 */
export function getPublicClient(chain: Chain = baseSepolia): PublicClient {
  const env = getEnv();
  const rpcUrl =
    env.rpcUrl && chain.id === baseSepolia.id
      ? env.rpcUrl
      : chain.rpcUrls.default.http[0];
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Reads native ETH or ERC-20 balance as a decimal display string.
 * @param address - Wallet address
 * @param tokenAddress - ERC-20 address; omit for native ETH
 * @param decimals - Token decimals
 * @param chain - Target chain
 */
export async function fetchDisplayBalance(
  address: Address,
  tokenAddress: Address | undefined,
  decimals: number,
  chain: Chain = baseSepolia,
): Promise<string> {
  const client = getPublicClient(chain);
  const value = tokenAddress
    ? await client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      })
    : await client.getBalance({ address });
  return formatUnits(value, decimals);
}
