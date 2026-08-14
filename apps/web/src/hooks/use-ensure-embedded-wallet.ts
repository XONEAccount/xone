import { useRef } from "react";
import { useCreateWallet, useWallets } from "@privy-io/react-auth";
import { parseEvmAddress } from "@/lib/address";
import { useWalletAccount } from "@/hooks/use-wallet-account";

const WAIT_MS = 15_000;
const POLL_MS = 250;

/**
 * Creates a Privy embedded EVM wallet on demand if the current user has none.
 * @returns Helper that resolves to a valid `0x` address
 */
export function useEnsureEmbeddedWallet() {
  const { address } = useWalletAccount();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const addressRef = useRef(address);
  const walletsRef = useRef(wallets);
  addressRef.current = address;
  walletsRef.current = wallets;

  /**
   * Returns the user's EVM address, creating an embedded wallet when missing.
   * @returns Lowercased `0x` address
   * @throws When Privy cannot create a wallet or the address never appears
   */
  async function ensureEmbeddedWalletAddress(): Promise<`0x${string}`> {
    const existing = readEvmAddress(addressRef.current, walletsRef.current);
    if (existing) return existing;

    try {
      const wallet = await createWallet();
      const created = parseEvmAddress(wallet.address);
      if (created) return created;
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("already")) {
        throw error instanceof Error ? error : new Error("创建钱包失败");
      }
    }

    const deadline = Date.now() + WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, POLL_MS));
      const next = readEvmAddress(addressRef.current, walletsRef.current);
      if (next) return next;
    }
    throw new Error("钱包创建超时，请刷新后重试");
  }

  return { ensureEmbeddedWalletAddress };
}

/**
 * Picks the first valid EVM address from the connected account or connectors.
 * @param address - Address from `useWalletAccount`
 * @param wallets - Privy connected wallets
 */
function readEvmAddress(
  address: string | undefined,
  wallets: Array<{ address: string }>,
): `0x${string}` | undefined {
  const fromAccount = parseEvmAddress(address);
  if (fromAccount) return fromAccount;
  for (const wallet of wallets) {
    const parsed = parseEvmAddress(wallet.address);
    if (parsed) return parsed;
  }
  return undefined;
}
