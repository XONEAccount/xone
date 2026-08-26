/**
 * @param err - Unknown thrown value
 * @returns Human-readable message
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Shortens a wallet address for display.
 *
 * @param address - Full address
 * @returns Short form
 */
export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Formats timestamps for en-US console display.
 *
 * @param value - ISO date string or Date
 * @returns Localized datetime
 */
export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
