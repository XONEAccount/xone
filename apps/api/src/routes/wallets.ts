import { DEFAULT_CHAIN, SUPPORTED_ASSETS } from "@wallet/config";
import { createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { getWalletBalance } from "thirdweb/wallets";
import { Hono } from "hono";
import { getEnv } from "../lib/env.js";
import type { AuthVariables } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { getSupabaseAdmin } from "../lib/supabase.js";

const wallets = new Hono<{ Variables: AuthVariables }>();

wallets.use("*", requireAuth);

/**
 * Lists wallets for the authenticated (or demo) user.
 */
wallets.get("/", async (c) => {
  const userId = c.get("userId");
  const env = getEnv();
  const admin = getSupabaseAdmin();

  if (admin) {
    const { data, error } = await admin
      .from("wallets")
      .select("id, user_id, provider, provider_wallet_id, address, chain_type, is_primary, created_at")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false });

    if (!error && data && data.length > 0) {
      return c.json({
        wallets: data.map((row) => ({
          id: row.id,
          userId: row.user_id,
          provider: row.provider,
          providerWalletId: row.provider_wallet_id,
          address: row.address,
          chainType: row.chain_type,
          isPrimary: row.is_primary,
          createdAt: row.created_at,
        })),
      });
    }
  }

  const address = env.custodyAddress || "0x0000000000000000000000000000000000000000";
  return c.json({
    wallets: [
      {
        id: "00000000-0000-4000-8000-000000000010",
        userId,
        provider: env.thirdwebClientId ? "thirdweb" : env.custodyAddress ? "custody" : "demo",
        providerWalletId: null,
        address,
        chainType: "evm",
        isPrimary: true,
        createdAt: new Date().toISOString(),
      },
    ],
  });
});

/**
 * Returns balances for a wallet (live via thirdweb when possible).
 */
wallets.get("/:id/balances", async (c) => {
  const env = getEnv();
  const addressParam = c.req.query("address");
  const admin = getSupabaseAdmin();
  let address = addressParam?.toLowerCase() ?? "";

  if (!address && admin) {
    const { data } = await admin
      .from("wallets")
      .select("address")
      .eq("id", c.req.param("id"))
      .maybeSingle();
    address = data?.address?.toLowerCase() ?? "";
  }

  if (!address) {
    address = env.custodyAddress?.toLowerCase() ?? "";
  }

  if (!address || !env.thirdwebClientId) {
    return c.json({
      balances: SUPPORTED_ASSETS.map((asset) => ({
        symbol: asset.symbol,
        name: asset.name,
        address: asset.address,
        decimals: asset.decimals,
        balance: "0",
        balanceUsd: "0",
        chainId: DEFAULT_CHAIN.id,
      })),
    });
  }

  const client = createThirdwebClient({
    clientId: env.thirdwebClientId,
    secretKey: env.thirdwebSecretKey || undefined,
  });

  const balances = await Promise.all(
    SUPPORTED_ASSETS.map(async (asset) => {
      try {
        const balance = await getWalletBalance({
          address,
          client,
          chain: baseSepolia,
          ...(asset.address ? { tokenAddress: asset.address } : {}),
        });
        return {
          symbol: asset.symbol,
          name: asset.name,
          address: asset.address,
          decimals: asset.decimals,
          balance: balance.displayValue,
          balanceUsd: null,
          chainId: DEFAULT_CHAIN.id,
        };
      } catch {
        return {
          symbol: asset.symbol,
          name: asset.name,
          address: asset.address,
          decimals: asset.decimals,
          balance: "0",
          balanceUsd: null,
          chainId: DEFAULT_CHAIN.id,
        };
      }
    }),
  );

  return c.json({ balances });
});

/**
 * Returns recent transactions for a wallet.
 */
wallets.get("/:id/transactions", async (c) => {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return c.json({ transactions: [] });
  }

  const { data } = await admin
    .from("transactions")
    .select("*")
    .eq("wallet_id", c.req.param("id"))
    .order("created_at", { ascending: false })
    .limit(50);

  return c.json({ transactions: data ?? [] });
});

export { wallets };
