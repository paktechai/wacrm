import { createAdminClient } from "@/lib/supabase/admin";

export async function writeTenantAudit(input: {
  accountId: string;
  actorUserId?: string | null;
  event: string;
  objectType?: string | null;
  objectId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("tenant_audit_log").insert({
      account_id: input.accountId,
      actor_user_id: input.actorUserId ?? null,
      event: input.event,
      object_type: input.objectType ?? null,
      object_id: input.objectId ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) console.error("[tenant-audit] write failed", error);
  } catch (error) {
    console.error("[tenant-audit] unavailable", error);
  }
}
