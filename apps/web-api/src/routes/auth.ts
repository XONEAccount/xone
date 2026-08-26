import { Hono } from "hono";
import { linkWalletSchema } from "@xone/schemas";
import { getSupabaseAdmin } from "../lib/supabase.js";

const auth = new Hono();

/**
 * Links a Privy-connected wallet to the application profile.
 * Uses public.profiles (wallet_address PK) which exists in the current Supabase project.
 */
auth.post("/link-wallet", async (c) => {
  const body = await c.req.json();
  const parsed = linkWalletSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid wallet payload", details: parsed.error.flatten() }, 400);
  }

  const input = parsed.data;
  const address = input.address.toLowerCase();
  const admin = getSupabaseAdmin();

  if (!admin) {
    return c.json(localLinkResponse(address, input.email, input.provider, input.chainType));
  }

  const now = new Date().toISOString();
  const displayName = input.displayName ?? shortLabel(address);

  // Current remote schema: profiles.wallet_address (PK), not public.users.
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        wallet_address: address,
        display_name: displayName,
        updated_at: now,
      },
      { onConflict: "wallet_address" },
    )
    .select("wallet_address, display_name, created_at, updated_at")
    .maybeSingle();

  if (profileError) {
    console.error("[auth/link-wallet] profile", profileError);
    // Do not block the wallet UI if schema is still migrating.
    return c.json({
      ...localLinkResponse(address, input.email, input.provider, input.chainType),
      warning: profileError.message,
    });
  }

  return c.json({
    ok: true,
    mode: "supabase",
    user: {
      id: address,
      email: input.email ?? null,
      displayName: profile?.display_name ?? displayName,
      primaryWalletAddress: address,
    },
    wallet: {
      address,
      provider: input.provider,
      chainType: input.chainType,
      isPrimary: true,
      createdAt: profile?.created_at ?? now,
    },
  });
});

/**
 * Local/demo response when Supabase profile tables are unavailable.
 */
function localLinkResponse(
  address: string,
  email: string | undefined,
  provider: string,
  chainType: string,
) {
  return {
    ok: true,
    mode: "local" as const,
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      email: email ?? null,
      primaryWalletAddress: address,
    },
    wallet: {
      address,
      provider,
      chainType,
      isPrimary: true,
    },
  };
}

/**
 * Compact address label for display_name fallback.
 * @param address - EVM address
 */
function shortLabel(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export { auth };
