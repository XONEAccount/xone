import type { Chain } from "./wallet";

/**
 * Maps an XOne chain to the CAIP-2 network id used by x402 v2.
 * @param chain - Agent settlement chain
 * @returns Network id
 */
export function chainToX402Network(chain: Chain): string {
  switch (chain) {
    case "base":
      return "eip155:8453";
    case "base-sepolia":
      return "eip155:84532";
    case "polygon":
      return "eip155:137";
    case "arbitrum":
      return "eip155:42161";
    case "solana":
      return "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
    default:
      return "eip155:84532";
  }
}

/**
 * @param chain - Agent chain
 * @returns Whether ExactEvmScheme can pay on this chain
 */
export function isEvmX402Chain(chain: Chain): boolean {
  return (
    chain === "base" ||
    chain === "base-sepolia" ||
    chain === "polygon" ||
    chain === "arbitrum"
  );
}
