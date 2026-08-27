import { createWalletClient, custom, type Address, type WalletClient } from "viem";
import { mainnet } from "viem/chains";

/**
 * Minimal EIP-1193 provider shape.
 */
export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/**
 * Returns the injected browser wallet provider when present.
 * @returns Provider or null
 */
export function getInjectedProvider(): Eip1193Provider | null {
  const eth = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  return eth ?? null;
}

/**
 * Builds a viem wallet client over the injected provider.
 * @returns Wallet client
 * @throws When no injected wallet
 */
export function createInjectedWalletClient(): WalletClient {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error("No browser wallet found. Install MetaMask, OKX, or another injected wallet.");
  }
  return createWalletClient({
    chain: mainnet,
    transport: custom(provider),
  });
}

/**
 * Requests the active account (challenge-response step 1).
 * @returns Connected address
 */
export async function connectWallet(): Promise<Address> {
  const client = createInjectedWalletClient();
  const addresses = await client.requestAddresses();
  const address = addresses[0];
  if (!address) throw new Error("No account returned from wallet");
  return address;
}

/**
 * Signs the server challenge with personal_sign (no gas).
 * @param address - Active account
 * @param message - Challenge text from /api/auth/challenge
 * @returns Hex signature
 */
export async function signChallenge(
  address: Address,
  message: string,
): Promise<`0x${string}`> {
  const client = createInjectedWalletClient();
  return client.signMessage({ account: address, message });
}
