import { NextResponse } from "next/server";

import { ForbiddenError, requireRole, toErrorResponse } from "@/lib/auth/account";
import { hasMinRole } from "@/lib/auth/roles";

export async function GET(request: Request) {
  try {
    const ctx = await requireRole("viewer");
    if (!hasMinRole(ctx.role, "admin")) {
      throw new ForbiddenError("Admin access is required");
    }

    const url = new URL(request.url);
    const requested = Number(url.searchParams.get("limit") || 100);
    const limit = Number.isInteger(requested) ? Math.max(1, Math.min(250, requested)) : 100;

    const { data, error } = await ctx.supabase
      .from("tenant_audit_log")
      .select("id, actor_user_id, event, object_type, object_id, metadata, created_at")
      .eq("account_id", ctx.accountId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    return NextResponse.json({ events: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}
