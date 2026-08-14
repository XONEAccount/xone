/**
 * @returns RFC4122 UUID string (Web Crypto / Node global crypto)
 */
export function uuid(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * @returns Compact hex id without dashes
 */
export function uuidHex(length = 16): string {
  return uuid().replace(/-/g, "").slice(0, length);
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
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const byte of bytes) {
    out += alphabet[byte % alphabet.length]!;
  }
  return out;
}

/**
 * Encodes UTF-8 text as base64url (browser + Node).
 *
 * @param value - Plain text
 * @returns base64url string
 */
export function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Decodes a hex string into bytes.
 *
 * @param hex - Hex string (optional 0x prefix)
 * @returns Byte array
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
 * Encodes bytes as lowercase hex.
 *
 * @param bytes - Byte array
 * @returns Hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
