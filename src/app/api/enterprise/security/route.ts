import { NextResponse } from "next/server";

import { ForbiddenError, requireRole, toErrorResponse } from "@/lib/auth/account";
import { hasMinRole } from "@/lib/auth/roles";
import { writeTenantAudit } from "@/lib/audit/tenant";

const DEFAULTS = {
  require_mfa: false,
  session_timeout_minutes: 480,
  data_retention_days: 365,
  audit_retention_days: 730,
  allow_data_export: true,
  allowed_ip_cidrs: [] as string[],
};

function integerInRange(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export async function GET() {
  try {
    const ctx = await requireRole("viewer");
    if (!hasMinRole(ctx.role, "admin")) {
      throw new ForbiddenError("Admin access is required");
    }

    const { data, error } = await ctx.supabase
      .from("account_security_settings")
      .select("require_mfa, session_timeout_minutes, data_retention_days, audit_retention_days, allow_data_export, allowed_ip_cidrs, updated_at")
      .eq("account_id", ctx.accountId)
      .maybeSingle();
    if (error) throw error;

    const { data: aal, error: aalError } =
      await ctx.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) console.error("[enterprise/security] AAL check failed", aalError);

    return NextResponse.json({
      settings: data ?? DEFAULTS,
      mfa: {
        currentLevel: aal?.currentLevel ?? null,
        nextLevel: aal?.nextLevel ?? null,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json();
    const settings = {
      require_mfa: body?.requireMfa === true,
      session_timeout_minutes: integerInRange(body?.sessionTimeoutMinutes, 15, 43200, 480),
      data_retention_days: integerInRange(body?.dataRetentionDays, 30, 3650, 365),
      audit_retention_days: integerInRange(body?.auditRetentionDays, 30, 3650, 730),
      allow_data_export: body?.allowDataExport !== false,
      allowed_ip_cidrs: Array.isArray(body?.allowedIpCidrs)
        ? body.allowedIpCidrs
            .filter((value: unknown): value is string => typeof value === "string")
            .map((value: string) => value.trim())
            .filter(Boolean)
            .slice(0, 100)
        : [],
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await ctx.supabase
      .from("account_security_settings")
      .upsert({ account_id: ctx.accountId, ...settings }, { onConflict: "account_id" })
      .select("require_mfa, session_timeout_minutes, data_retention_days, audit_retention_days, allow_data_export, allowed_ip_cidrs, updated_at")
      .single();
    if (error) throw error;

    void writeTenantAudit({
      accountId: ctx.accountId,
      actorUserId: ctx.userId,
      event: "enterprise.security.updated",
      objectType: "account_security_settings",
      objectId: ctx.accountId,
      metadata: {
        require_mfa: data.require_mfa,
        session_timeout_minutes: data.session_timeout_minutes,
        data_retention_days: data.data_retention_days,
        audit_retention_days: data.audit_retention_days,
        allow_data_export: data.allow_data_export,
      },
    });

    return NextResponse.json({ settings: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
