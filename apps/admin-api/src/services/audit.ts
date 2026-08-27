import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConsole, getSupabaseWallet } from "../lib/supabase.js";

/**
 * Picks a Supabase client that has admin_audit_logs (console first, then wallet).
 * @returns Client or null
 */
export function getSupabaseAudit(): SupabaseClient | null {
  return getSupabaseConsole() ?? getSupabaseWallet();
}

/**
 * Writes an admin audit log row. Failures are logged but do not fail the request.
 * Tries console project first, then wallet project (dual-Supabase setups).
 * @param input - Audit payload
 * @param preferred - Optional preferred client (tried first)
 */
export async function writeAdminAudit(
  input: {
    actor: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  },
  preferred?: SupabaseClient | null,
): Promise<void> {
  const clients = [preferred, getSupabaseConsole(), getSupabaseWallet()].filter(
    (c, i, arr): c is SupabaseClient => Boolean(c) && arr.indexOf(c) === i,
  );

  const row = {
    actor: input.actor,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    metadata: input.metadata ?? {},
  };

  for (const admin of clients) {
    const { error } = await admin.from("admin_audit_logs").insert(row);
    if (!error) return;
    if (/admin_audit_logs|schema cache/i.test(error.message)) continue;
    console.error("[admin-audit]", error.message);
    return;
  }

  console.error("[admin-audit] no project has public.admin_audit_logs");
}
