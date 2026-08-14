import { baseSepolia, sepolia } from "viem/chains";
import { DEFAULT_CHAIN } from "@wallet/config";

/**
 * Active chain for the MVP (Base Sepolia).
 */
export const appChain = baseSepolia;

/**
 * Ethereum Sepolia, used by ETH-only developer agents.
 */
export const sepoliaChain = sepolia;

/**
 * Human-readable chain label for UI.
 */
export const appChainLabel = DEFAULT_CHAIN.name;

/**
 * Maps a product chain slug to a viem chain.
 * @param chainSlug - Product chain slug
 */
export function chainFromSlug(chainSlug?: string) {
  return chainSlug === "ethereum-sepolia" ? sepoliaChain : appChain;
}

/**
 * Ensures the configured chain id matches the viem chain object.
 */
export function assertChainAlignment(): void {
  if (appChain.id !== DEFAULT_CHAIN.id) {
    console.warn(
      `[web3] Chain mismatch: viem=${appChain.id} config=${DEFAULT_CHAIN.id}`,
    );
  }
}
