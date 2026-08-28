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
 * Picks an RPC URL for the target chain.
 * `RPC_URL` overrides Base Sepolia only; never reuse an Ethereum Sepolia URL for Base.
 * @param chain - Target chain
 */
function resolveRpcUrl(chain: Chain): string {
  const env = getEnv();
  const custom = env.rpcUrl.trim();
  const fallback = chain.rpcUrls.default.http[0]!;

  if (chain.id === baseSepolia.id) {
    if (!custom) return fallback;
    // Common misconfig: ethereum-sepolia RPC used for base-sepolia agents.
    if (/ethereum-sepolia|eth-sepolia|11155111/i.test(custom) && !/base/i.test(custom)) {
      return fallback;
    }
    return custom;
  }

  if (chain.id === sepolia.id) {
    const ethOnly = process.env.ETH_SEPOLIA_RPC_URL?.trim();
    if (ethOnly) return ethOnly;
    if (custom && /ethereum-sepolia|eth-sepolia/i.test(custom) && !/base/i.test(custom)) {
      return custom;
    }
    return fallback;
  }

  return fallback;
}

/**
 * Builds a viem public client for reads.
 * @param chain - Target chain
 */
export function getPublicClient(chain: Chain = baseSepolia): PublicClient {
  return createPublicClient({
    chain,
    transport: http(resolveRpcUrl(chain)),
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
