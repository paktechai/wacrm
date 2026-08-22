import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/auth/account";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { createAdminClient } from "@/lib/supabase/admin";

type PatchPlanBody = {
  name?: string;
  description?: string | null;
  isPublic?: boolean;
  isActive?: boolean;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  try {
    const actor = await requirePlatformAdmin(["super_admin", "billing_admin"]);
    const { planId } = await params;
    const body = (await request.json()) as PatchPlanBody;

    if (!planId) {
      return NextResponse.json({ error: "Plan id is required" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name || name.length > 80) {
        return NextResponse.json(
          { error: "Plan name must be 1-80 characters" },
          { status: 400 },
        );
      }
      patch.name = name;
    }

    if (body.description !== undefined) {
      patch.description = body.description?.trim() || null;
    }
    if (body.isPublic !== undefined) patch.is_public = body.isPublic;
    if (body.isActive !== undefined) patch.is_active = body.isActive;

    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ error: "No changes supplied" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: plan, error } = await admin
      .from("saas_plans")
      .update(patch)
      .eq("id", planId)
      .select("id, code, name, description, is_public, is_active")
      .maybeSingle();

    if (error) throw error;
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const { error: auditError } = await admin.from("platform_audit_log").insert({
      actor_user_id: actor.userId,
      action: "plan.updated",
      target_type: "saas_plan",
      target_id: plan.id,
      metadata: patch,
    });
    if (auditError) {
      console.error("[platform plan PATCH] audit log failed", auditError);
    }

    return NextResponse.json({ plan });
  } catch (error) {
    return toErrorResponse(error);
  }
}
