import { decryptSecret } from "../lib/crypto.js";
import { getEnv } from "./env.js";

/**
 * Candidate secrets used historically to seal developer-agent private keys.
 * Production often had only SUPABASE_SERVICE_ROLE_KEY; local/dev prefers JWT_SECRET.
 * @returns Deduped non-empty secrets in try order
 */
export function agentSealSecrets(): string[] {
  const env = getEnv();
  const list = [env.jwtSecret, env.supabaseServiceRoleKey].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  return [...new Set(list)];
}

/**
 * Decrypts an agent sealed private key, trying each known seal secret.
 * @param encryptedPrivateKey - AES-GCM payload from DB
 * @returns Hex private key
 * @throws When no secret works
 */
export async function unsealAgentPrivateKey(
  encryptedPrivateKey: string,
): Promise<string> {
  const secrets = agentSealSecrets();
  if (secrets.length === 0) {
    throw new Error("Server cannot unseal agent key (no seal secret configured)");
  }

  let lastError: unknown;
  for (const secret of secrets) {
    try {
      return await decryptSecret(encryptedPrivateKey, secret);
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    lastError instanceof Error
      ? `Failed to unseal agent key (${lastError.message}). The wallet was sealed with a different server secret — recreate the wallet on this environment, or set matching JWT_SECRET.`
      : "Failed to unseal agent key",
  );
}
