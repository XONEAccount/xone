/**
 * Hashes an API key with SHA-256 for storage (never store raw keys).
 * @param apiKey - Raw API key string
 * @returns Hex digest
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(apiKey),
  );
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Encrypts a secret with AES-GCM using a key derived from `secret`.
 * @param plain - Plaintext (e.g. private key)
 * @param secret - Server secret (JWT_SECRET)
 * @returns Base64 payload `iv.ciphertext`
 * @throws When secret is empty
 */
export async function encryptSecret(plain: string, secret: string): Promise<string> {
  if (!secret) throw new Error("Encryption secret is not configured");
  const key = await deriveAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipher))}`;
}

/**
 * Decrypts a payload produced by {@link encryptSecret}.
 * @param payload - `iv.ciphertext` base64 string
 * @param secret - Server secret
 * @returns Plaintext
 */
export async function decryptSecret(payload: string, secret: string): Promise<string> {
  if (!secret) throw new Error("Encryption secret is not configured");
  const [ivB64, dataB64] = payload.split(".");
  if (!ivB64 || !dataB64) throw new Error("Invalid encrypted payload");
  const key = await deriveAesKey(secret);
  const iv = base64ToBytes(ivB64);
  const data = base64ToBytes(dataB64);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}

/**
 * Generates a cryptographically random API key for developer agents.
 * @returns Key in the form `xone_ag_<hex>`
 */
export function generateAgentApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `xone_ag_${bytesToHex(bytes)}`;
}

/**
 * Generates a random secp256k1 private key hex (0x-prefixed).
 * @returns Private key hex
 */
export function generatePrivateKeyHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  // Ensure key is in valid secp256k1 range by retrying zero (extremely unlikely).
  if (bytes.every((b) => b === 0)) {
    return generatePrivateKeyHex();
  }
  return `0x${bytesToHex(bytes)}`;
}

/**
 * @param secret - Passphrase / JWT secret
 * @returns AES-GCM key for encrypt/decrypt
 */
async function deriveAesKey(secret: string) {
  const material = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * @param bytes - Byte array
 * @returns Lowercase hex
 */
function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * @param bytes - Byte array
 * @returns Base64 string
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * @param value - Base64 string
 * @returns Uint8Array
 */
function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
