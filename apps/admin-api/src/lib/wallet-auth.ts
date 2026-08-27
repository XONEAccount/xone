import { verifyMessage } from "viem";
import { getAddress, isAddress } from "viem/utils";
import { getEnv } from "./env.js";
import { getSupabaseAdmin } from "./supabase.js";

const usedNonces = new Map<string, number>();

/**
 * Parses ADMIN_WALLETS env allowlist (comma-separated bootstrap).
 * @returns Lowercased addresses
 */
function envAllowlist(): Set<string> {
  const raw = getEnv().adminWallets;
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (trimmed && isAddress(trimmed)) {
      set.add(trimmed.toLowerCase());
    }
  }
  return set;
}

/**
 * Loads active admin wallets from DB ∪ env bootstrap.
 * Env alone works before the table is migrated.
 * @returns Lowercased allowlisted addresses
 */
export async function getAdminWalletAllowlist(): Promise<Set<string>> {
  const set = envAllowlist();
  const admin = getSupabaseAdmin();
  if (!admin) return set;

  const { data, error } = await admin
    .from("admin_wallets")
    .select("address")
    .eq("status", "active");

  if (error) {
    // Table may not exist yet — fall back to env.
    if (!/admin_wallets|schema cache/i.test(error.message)) {
      console.error("[admin-wallets]", error.message);
    }
    return set;
  }

  for (const row of data ?? []) {
    const addr = String(row.address ?? "").trim();
    if (addr && isAddress(addr)) set.add(addr.toLowerCase());
  }
  return set;
}

/**
 * Whether any allowlist source is configured.
 * @returns True when env or DB has at least one wallet
 */
export async function hasAdminAllowlist(): Promise<boolean> {
  const set = await getAdminWalletAllowlist();
  return set.size > 0;
}

/**
 * Builds a SIWE-lite challenge (Gemini-style challenge-response).
 * @param address - Checksum or hex address
 * @returns Message + nonce metadata
 */
export function createWalletChallenge(address: string): {
  message: string;
  nonce: string;
  expiresAt: string;
} {
  const checksum = getAddress(address);
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const message = [
    "Welcome to XOne Admin System!",
    "",
    "Sign this message to prove you own this wallet.",
    "This request will not trigger a blockchain transaction or cost any gas fees.",
    "",
    `Address: ${checksum}`,
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt}`,
    `Expires at: ${expiresAt}`,
  ].join("\n");

  return { message, nonce, expiresAt };
}

/**
 * Verifies signature, nonce freshness, and allowlist membership.
 * @param input - Address, message, signature
 * @returns Checksum address when valid
 * @throws Error with user-facing message when invalid
 */
export async function verifyWalletLogin(input: {
  address: string;
  message: string;
  signature: `0x${string}`;
}): Promise<string> {
  if (!isAddress(input.address)) {
    throw new Error("Invalid wallet address");
  }

  const allowlist = await getAdminWalletAllowlist();
  if (allowlist.size === 0) {
    throw new Error("Admin wallet allowlist is empty (ADMIN_WALLETS / admin_wallets)");
  }

  const checksum = getAddress(input.address);
  if (!allowlist.has(checksum.toLowerCase())) {
    throw new Error("Wallet is not authorized for admin access");
  }

  const nonceMatch = /^Nonce: ([a-f0-9]+)$/m.exec(input.message);
  const expiresMatch = /^Expires at: (.+)$/m.exec(input.message);
  const addressMatch = /^Address: (.+)$/m.exec(input.message);

  if (!nonceMatch?.[1] || !expiresMatch?.[1] || !addressMatch?.[1]) {
    throw new Error("Invalid challenge message");
  }

  if (getAddress(addressMatch[1]) !== checksum) {
    throw new Error("Message address mismatch");
  }

  const expiresAt = Date.parse(expiresMatch[1]);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    throw new Error("Challenge expired — request a new one");
  }

  const nonce = nonceMatch[1];
  pruneNonces();
  if (usedNonces.has(nonce)) {
    throw new Error("Challenge already used");
  }

  const ok = await verifyMessage({
    address: checksum,
    message: input.message,
    signature: input.signature,
  });
  if (!ok) {
    throw new Error("Invalid signature");
  }

  usedNonces.set(nonce, Date.now() + 15 * 60 * 1000);
  return checksum;
}

/**
 * Drops expired nonce entries.
 */
function pruneNonces(): void {
  const now = Date.now();
  for (const [nonce, until] of usedNonces) {
    if (until <= now) usedNonces.delete(nonce);
  }
}
