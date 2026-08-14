const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const CAIP10_EVM_RE = /^eip155:\d+:(0x[a-fA-F0-9]{40})$/i;

/**
 * Extracts a 20-byte EVM address from a hex string or CAIP-10 account.
 * Rejects emails, Solana keys, and other non-EVM identifiers.
 * @param value - Raw address from Privy / a wallet connector
 * @returns Lowercased `0x` address, or undefined when invalid
 */
export function parseEvmAddress(value: string | null | undefined): `0x${string}` | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const caip = trimmed.match(CAIP10_EVM_RE);
  const hex = caip?.[1] ?? trimmed;
  if (!EVM_ADDRESS_RE.test(hex)) return undefined;
  return hex.toLowerCase() as `0x${string}`;
}

/**
 * Shortens an EVM address for compact UI display.
 * @param address - Full address
 * @returns Short form like 0x1234…abcd
 */
export function shortAddress(address: string): string {
  if (!address || address.length < 12) return address || "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
