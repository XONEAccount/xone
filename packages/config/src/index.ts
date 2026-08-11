/** Shared chain and product configuration for MVP (single-chain first). */

export const APP_NAME = "X-ONE钱包";

/** Base Sepolia for x402 / USDC testnet development. */
export const DEFAULT_CHAIN = {
  id: 84532,
  name: "Base Sepolia",
  slug: "base-sepolia",
  explorerUrl: "https://sepolia.basescan.org",
  nativeCurrency: {
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
  },
} as const;

/**
 * Builds a block explorer URL for a transaction hash.
 * @param txHash - Transaction hash
 */
export function getTxExplorerUrl(txHash: string): string {
  return `${DEFAULT_CHAIN.explorerUrl}/tx/${txHash}`;
}

/**
 * Builds a block explorer URL for a wallet address on the given chain slug.
 * @param address - EVM address
 * @param chainSlug - Chain slug (defaults to app default chain)
 */
export function getAddressExplorerUrl(
  address: string,
  chainSlug: string = DEFAULT_CHAIN.slug,
): string {
  const base =
    chainSlug === "ethereum-sepolia"
      ? "https://sepolia.etherscan.io"
      : chainSlug === "base-sepolia"
        ? "https://sepolia.basescan.org"
        : DEFAULT_CHAIN.explorerUrl;
  return `${base}/address/${address}`;
}

export const SUPPORTED_ASSETS = [
  {
    symbol: "ETH",
    name: "Ether",
    address: null,
    decimals: 18,
    chainId: DEFAULT_CHAIN.id,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    /** Circle USDC on Base Sepolia (x402 default test asset). */
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    decimals: 6,
    chainId: DEFAULT_CHAIN.id,
  },
] as const;

export const DEFAULT_PAYMENT_POLICY: {
  maxAutoAmount: string;
  maxDailyAutoAmount: string;
  allowedMerchants: string[];
  allowedCategories: string[];
  allowedChains: string[];
  allowedAssets: string[];
  requireConfirmationAbove: string;
  blockAbove: string;
} = {
  maxAutoAmount: "50",
  maxDailyAutoAmount: "200",
  allowedMerchants: [],
  allowedCategories: ["travel", "subscription"],
  allowedChains: ["base-sepolia"],
  allowedAssets: ["USDC", "ETH"],
  requireConfirmationAbove: "50",
  blockAbove: "1000",
};
