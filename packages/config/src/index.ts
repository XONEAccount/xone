/** Shared chain and product configuration for MVP (single-chain first). */

export const APP_NAME = "X-ONE钱包";

/** Ethereum Sepolia for development; switch to mainnet for production. */
export const DEFAULT_CHAIN = {
  id: 11155111,
  name: "Ethereum Sepolia",
  slug: "ethereum-sepolia",
  explorerUrl: "https://sepolia.etherscan.io",
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
    /** Circle USDC on Ethereum Sepolia. */
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
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
  allowedChains: ["ethereum-sepolia"],
  allowedAssets: ["USDC", "ETH"],
  requireConfirmationAbove: "50",
  blockAbove: "1000",
};
