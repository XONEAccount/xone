import { createPublicClient, http, type Chain, type PublicClient } from "viem";
import { getWebEnv } from "@/lib/env";
import { appChain, sepoliaChain } from "@/web3/chains";

const env = getWebEnv();

if (!env.privyAppId) {
  console.warn("[web3] VITE_PRIVY_APP_ID is missing");
}

/**
 * Builds a viem public client for reads (balances, gas, receipts).
 * @param chain - Target chain
 * @returns Public client
 */
export function getPublicClient(chain: Chain = appChain): PublicClient {
  const rpcUrl =
    env.rpcUrl && chain.id === appChain.id
      ? env.rpcUrl
      : chain.rpcUrls.default.http[0];
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Resolves a public client from a chain slug used by developer agents.
 * @param chainSlug - `base-sepolia` or `ethereum-sepolia`
 */
export function getPublicClientBySlug(chainSlug?: string): PublicClient {
  return getPublicClient(chainSlug === "ethereum-sepolia" ? sepoliaChain : appChain);
}
