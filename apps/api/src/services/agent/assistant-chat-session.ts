import type { SupabaseClient } from "@supabase/supabase-js";
import type { UIMessage } from "ai";

export type AssistantChatSession = {
  id: string;
  ownerWallet: string;
  title: string;
  messages: UIMessage[];
  createdAt: string;
  updatedAt: string;
};

/**
 * Ensures a profiles row exists for FK inserts.
 * @param admin - Supabase admin
 * @param address - Wallet address
 */
async function ensureProfile(admin: SupabaseClient, address: string): Promise<void> {
  const now = new Date().toISOString();
  const owner = address.toLowerCase();
  const { error } = await admin.from("profiles").upsert(
    {
      wallet_address: owner,
      display_name: `${owner.slice(0, 6)}…${owner.slice(-4)}`,
      updated_at: now,
    },
    { onConflict: "wallet_address" },
  );
  if (error) throw new Error(`Failed to ensure profile: ${error.message}`);
}

/**
 * Loads the assistant chat session for an owner wallet (one session per wallet).
 * @param admin - Supabase admin
 * @param ownerAddress - Owner wallet
 */
export async function getAssistantChatSession(
  admin: SupabaseClient,
  ownerAddress: string,
): Promise<AssistantChatSession | null> {
  const owner = ownerAddress.toLowerCase();
  const { data, error } = await admin
    .from("assistant_chat_sessions")
    .select("*")
    .eq("owner_wallet", owner)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as {
    id: string;
    owner_wallet: string;
    title: string;
    messages: unknown;
    created_at: string;
    updated_at: string;
  };

  return {
    id: row.id,
    ownerWallet: row.owner_wallet,
    title: row.title,
    messages: Array.isArray(row.messages) ? (row.messages as UIMessage[]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Upserts the assistant chat messages for an owner wallet.
 * @param admin - Supabase admin
 * @param ownerAddress - Owner wallet
 * @param messages - AI SDK UI messages
 * @param title - Optional session title
 */
export async function saveAssistantChatSession(
  admin: SupabaseClient,
  ownerAddress: string,
  messages: UIMessage[],
  title?: string,
): Promise<AssistantChatSession> {
  const owner = ownerAddress.toLowerCase();
  await ensureProfile(admin, owner);

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("assistant_chat_sessions")
    .upsert(
      {
        owner_wallet: owner,
        title: title?.trim() || "对话",
        messages,
        updated_at: now,
      },
      { onConflict: "owner_wallet" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save chat session");
  }

  const row = data as {
    id: string;
    owner_wallet: string;
    title: string;
    messages: unknown;
    created_at: string;
    updated_at: string;
  };

  return {
    id: row.id,
    ownerWallet: row.owner_wallet,
    title: row.title,
    messages: Array.isArray(row.messages) ? (row.messages as UIMessage[]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Clears the assistant chat session for an owner (resets to empty).
 * @param admin - Supabase admin
 * @param ownerAddress - Owner wallet
 */
export async function clearAssistantChatSession(
  admin: SupabaseClient,
  ownerAddress: string,
): Promise<void> {
  const owner = ownerAddress.toLowerCase();
  const { error } = await admin
    .from("assistant_chat_sessions")
    .delete()
    .eq("owner_wallet", owner);
  if (error) throw new Error(error.message);
}
