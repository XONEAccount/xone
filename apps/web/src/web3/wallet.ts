import { DEFAULT_CHAIN } from "@xone/config";
import { prepareSendPreview } from "@/web3/transactions";

/**
 * Application-level wallet facade for non-hook call sites.
 * Live address/balance/send should prefer `useWalletAccount` in components.
 */
export const wallet = {
  /**
   * Placeholder until a connected account is available in the component tree.
   * @returns Empty string; UI should use useWalletAccount
   */
  async getAddress(): Promise<string> {
    return "";
  },

  /**
   * @returns Placeholder balance string
   */
  async getBalance(): Promise<string> {
    return "0";
  },

  /**
   * Prepares a send intent for confirmation UI. Does not broadcast.
   * @param to - Recipient address
   * @param amount - Decimal amount
   * @param asset - Asset symbol
   */
  async prepareTransaction(to: string, amount: string, asset: string) {
    return prepareSendPreview(to, amount, asset);
  },

  /**
   * @returns Active app chain slug
   */
  getChainSlug(): string {
    return DEFAULT_CHAIN.slug;
  },
};
