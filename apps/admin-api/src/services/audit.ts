import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Writes an admin audit log row. Failures are logged but do not fail the request.
 * @param admin - Supabase service client
 * @param input - Audit payload
 */
export async function writeAdminAudit(
  admin: SupabaseClient,
  input: {
    actor: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await admin.from("admin_audit_logs").insert({
    actor: input.actor,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("[admin-audit]", error.message);
  }
}
