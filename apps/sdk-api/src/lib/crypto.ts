import { bytesToHex, hexToBytes } from "./ids";

/**
 * Derives an AES-GCM CryptoKey from a 32-byte hex secret.
 *
 * @param keyHex - 64 hex chars
 * @returns AES-GCM key
 */
async function importKey(keyHex: string): Promise<CryptoKey> {
  const raw = hexToBytes(keyHex);
  if (raw.length !== 32) {
    throw new Error("WALLET_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypts plaintext with AES-GCM. Output: `ivHex:cipherHex`.
 *
 * @param plaintext - Secret to store
 * @param keyHex - 32-byte hex key
 * @returns Encrypted payload
 */
export async function encryptSecret(
  plaintext: string,
  keyHex: string,
): Promise<string> {
  const key = await importKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(cipher))}`;
}

/**
 * Decrypts `ivHex:cipherHex` produced by {@link encryptSecret}.
 *
 * @param payload - Encrypted string
 * @param keyHex - 32-byte hex key
 * @returns Plaintext
 */
export async function decryptSecret(
  payload: string,
  keyHex: string,
): Promise<string> {
  const [ivHex, cipherHex] = payload.split(":");
  if (!ivHex || !cipherHex) {
    throw new Error("Invalid encrypted payload");
  }
  const key = await importKey(keyHex);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBytes(ivHex) },
    key,
    hexToBytes(cipherHex),
  );
  return new TextDecoder().decode(plain);
}
