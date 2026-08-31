import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/auth/account";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { createAdminClient } from "@/lib/supabase/admin";

type CreatePlanBody = {
  code?: string;
  name?: string;
  description?: string | null;
  isPublic?: boolean;
  isActive?: boolean;
};

export async function POST(request: Request) {
  try {
    const actor = await requirePlatformAdmin(["super_admin", "billing_admin"]);
    const body = (await request.json()) as CreatePlanBody;

    const code = body.code?.trim().toLowerCase();
    const name = body.name?.trim();
    const description = body.description?.trim() || null;

    if (!code || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(code)) {
      return NextResponse.json(
        { error: "Plan code must be 2-64 lowercase letters, numbers, - or _" },
        { status: 400 },
      );
    }
    if (!name || name.length > 80) {
      return NextResponse.json(
        { error: "Plan name is required and must be 80 characters or less" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: plan, error } = await admin
      .from("saas_plans")
      .insert({
        code,
        name,
        description,
        is_public: body.isPublic ?? false,
        is_active: body.isActive ?? true,
      })
      .select("id, code, name, description, is_public, is_active")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Plan code already exists" }, { status: 409 });
      }
      throw error;
    }

    const { error: auditError } = await admin.from("platform_audit_log").insert({
      actor_user_id: actor.userId,
      action: "plan.created",
      target_type: "saas_plan",
      target_id: plan.id,
      metadata: { code: plan.code, name: plan.name },
    });
    if (auditError) {
      console.error("[platform plans POST] audit log failed", auditError);
    }

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
