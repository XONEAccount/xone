import { XOne } from "@xonepay/sdk";

const PLACEHOLDER_KEYS = new Set([
  "xone_",
  "your-api-key",
  "your_api_key",
  "changeme",
  "todo",
  "xxx",
]);

/**
 * In-process spend session: one API key, one SDK client.
 */
export class McpSpendSession {
  private apiKey: string | undefined;
  private client: XOne | undefined;

  /**
   * @param apiKey - Console spend token (`xone_…`)
   */
  setApiKey(apiKey: string): void {
    const token = normalizeApiKey(apiKey);
    if (!token) {
      throw new Error("API key is empty");
    }
    this.apiKey = token;
    this.client = new XOne({ agentToken: token });
  }

  /**
   * @returns Bound key, if the user has already provided one
   */
  getApiKey(): string | undefined {
    return this.apiKey;
  }

  /**
   * @returns SDK client bound to the session key
   * @throws When no API key has been provided yet
   */
  getClient(): XOne {
    if (!this.client || !this.apiKey) {
      throw new Error("API key is required");
    }
    return this.client;
  }
}

/**
 * Trims and rejects empty / placeholder keys.
 *
 * @param value - Raw key from a tool argument, elicitation, or env
 * @returns Normalized token, or `undefined` if unusable
 */
export function normalizeApiKey(value: string | undefined): string | undefined {
  const token = value?.trim();
  if (!token) return undefined;
  if (PLACEHOLDER_KEYS.has(token.toLowerCase())) return undefined;
  if (/^xone_[x.*]+$/i.test(token)) return undefined;
  if (token.length < 12) return undefined;
  return token;
}
