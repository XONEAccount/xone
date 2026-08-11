import { baseSepolia } from "thirdweb/chains";
import { DEFAULT_CHAIN } from "@wallet/config";

/**
 * Active chain for the MVP (Base Sepolia).
 */
export const appChain = baseSepolia;

/**
 * Human-readable chain label for UI.
 */
export const appChainLabel = DEFAULT_CHAIN.name;

/**
 * Ensures the configured chain id matches the thirdweb chain object.
 */
export function assertChainAlignment(): void {
  if (appChain.id !== DEFAULT_CHAIN.id) {
    console.warn(
      `[web3] Chain mismatch: thirdweb=${appChain.id} config=${DEFAULT_CHAIN.id}`,
    );
  }
}
