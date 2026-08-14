/**
 * @returns Compact hex id without dashes
 * @param length - Hex chars to keep
 */
export function uuidHex(length = 16): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, length);
}

/**
 * Random alphanumeric string (A–Z, a–z, 0–9).
 *
 * @param length - Number of characters
 * @returns Random string
 */
export function randomAlnum(length: number): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const byte of bytes) {
    out += alphabet[byte % alphabet.length]!;
  }
  return out;
}

/**
 * @param bytes - Byte array
 * @returns Lowercase hex
 */
export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * @param hex - Hex string (optional 0x)
 * @returns Bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * SHA-256 hex digest of a UTF-8 string.
 *
 * @param value - Input
 * @returns Hex digest
 */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}
