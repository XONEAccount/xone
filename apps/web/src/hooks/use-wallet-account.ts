import { useMemo } from "react";
import {
  getEmbeddedConnectedWallet,
  usePrivy,
  useWallets,
  type ConnectedWallet,
  type User,
} from "@privy-io/react-auth";
import { parseEvmAddress } from "@/lib/address";

export interface WalletAccount {
  ready: boolean;
  authenticated: boolean;
  address: `0x${string}` | undefined;
  account: { address: `0x${string}` } | undefined;
  wallet: ConnectedWallet | null;
  user: User | null;
  loginMethod: string;
  logout: () => Promise<void>;
}

/**
 * App-level connected EVM account. Prefers the current Privy user's embedded wallet.
 * Ignores leftover connectors from a previous session after logout / account switch.
 * @returns Connection state plus the active address
 */
export function useWalletAccount(): WalletAccount {
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();

  const wallet = useMemo(() => {
    if (!authenticated || !user) return null;
    return pickUserWallet(user, wallets);
  }, [authenticated, user, wallets]);

  const address = parseEvmAddress(wallet?.address) ?? userWalletAddresses(user)[0];

  return {
    ready: ready && (!authenticated || walletsReady),
    authenticated,
    address,
    account: address ? { address } : undefined,
    wallet,
    user: user ?? null,
    loginMethod: describeLoginMethod(user ?? null, wallet),
    logout,
  };
}

/**
 * Picks the connected wallet that belongs to this Privy user.
 * @param user - Authenticated Privy user
 * @param wallets - Connectors currently in the browser
 */
function pickUserWallet(user: User, wallets: ConnectedWallet[]): ConnectedWallet | null {
  const evmWallets = wallets.filter((item) => Boolean(parseEvmAddress(item.address)));
  if (!evmWallets.length) return null;

  const allowed = addressesForUser(user);
  const owned = allowed.size
    ? evmWallets.filter((item) => {
        const address = parseEvmAddress(item.address);
        return address ? allowed.has(address) : false;
      })
    : evmWallets;

  if (!owned.length) {
    return getEmbeddedConnectedWallet(evmWallets) ?? evmWallets[0] ?? null;
  }
  return getEmbeddedConnectedWallet(owned) ?? owned[0] ?? null;
}

/**
 * Ethereum addresses on the Privy user. Ignores email/phone `address` fields
 * and other non-EVM identifiers that happen to share the same property name.
 * @param user - Privy user, or null when logged out
 */
export function userWalletAddresses(user: User | null): `0x${string}`[] {
  if (!user) return [];
  const addresses = new Set<`0x${string}`>();
  const add = (value: string | undefined) => {
    const parsed = parseEvmAddress(value);
    if (parsed) addresses.add(parsed);
  };
  add(user.wallet?.address);
  for (const account of user.linkedAccounts ?? []) {
    if ("address" in account && typeof account.address === "string") {
      add(account.address);
    }
  }
  return [...addresses];
}

/**
 * Ethereum addresses linked to the Privy user (embedded + external).
 * @param user - Privy user
 */
function addressesForUser(user: User): Set<string> {
  return new Set(userWalletAddresses(user));
}

/**
 * Human-readable login method for settings.
 * @param user - Privy user
 * @param wallet - Active wallet
 */
function describeLoginMethod(user: User | null, wallet: ConnectedWallet | null): string {
  if (user?.email?.address) return user.email.address;
  if (user?.google?.email) return `Google · ${user.google.email}`;
  if (user?.github?.username) return `GitHub · ${user.github.username}`;
  if (user?.github) return "GitHub";
  if (user?.apple?.email) return `Apple · ${user.apple.email}`;
  if (user?.discord?.username) return `Discord · ${user.discord.username}`;
  if (user?.twitter?.username) return `X · ${user.twitter.username}`;
  if (user?.phone?.number) return user.phone.number;
  if (wallet?.walletClientType === "privy") return "Privy embedded wallet";
  if (wallet?.walletClientType) return wallet.walletClientType;
  return "Privy";
}
