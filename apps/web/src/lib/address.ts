/**
 * Shortens an EVM address for compact UI display.
 * @param address - Full address
 * @returns Short form like 0x1234…abcd
 */
export function shortAddress(address: string): string {
  if (!address || address.length < 12) return address || "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
