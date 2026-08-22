import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/auth/account";
import { SBYT_FEATURES, SBYT_METRICS } from "@/lib/billing/catalog";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { createAdminClient } from "@/lib/supabase/admin";

type PatchPlanBody = {
  name?: string;
  description?: string | null;
  isPublic?: boolean;
  isActive?: boolean;
  features?: Record<string, boolean>;
  limits?: Record<string, number | null>;
};

const ALLOWED_FEATURES = new Set<string>(Object.values(SBYT_FEATURES));
const ALLOWED_LIMITS = new Set<string>(Object.values(SBYT_METRICS));

function normalizeFeatures(
  value: Record<string, boolean> | undefined,
): Record<string, boolean> | null {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_FEATURES");
  }

  const output: Record<string, boolean> = {};
  for (const [key, enabled] of Object.entries(value)) {
    if (!ALLOWED_FEATURES.has(key) || typeof enabled !== "boolean") {
      throw new Error("INVALID_FEATURES");
    }
    output[key] = enabled;
  }
  return output;
}

function normalizeLimits(
  value: Record<string, number | null> | undefined,
): Record<string, number | null> | null {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_LIMITS");
  }

  const output: Record<string, number | null> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!ALLOWED_LIMITS.has(key)) throw new Error("INVALID_LIMITS");
    if (raw === null) {
      output[key] = null;
      continue;
    }
    if (!Number.isSafeInteger(raw) || raw < 0) {
      throw new Error("INVALID_LIMITS");
    }
    output[key] = raw;
  }
  return output;
}

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

    let features: Record<string, boolean> | null;
    let limits: Record<string, number | null> | null;
    try {
      features = normalizeFeatures(body.features);
      limits = normalizeLimits(body.limits);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      return NextResponse.json(
        {
          error:
            message === "INVALID_FEATURES"
              ? "Features contain an unsupported key or value"
              : "Limits must use supported metric keys with non-negative integer or null values",
        },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: current, error: currentError } = await admin
      .from("saas_plans")
      .select("id, code")
      .eq("id", planId)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (
      current.code === "foundation" &&
      (body.isActive === false ||
        body.isPublic === true ||
        features !== null ||
        limits !== null)
    ) {
      return NextResponse.json(
        { error: "The SBYT Foundation plan is system-managed" },
        { status: 400 },
      );
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
    if (features !== null) patch.features = features;
    if (limits !== null) patch.limits = limits;

    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ error: "No changes supplied" }, { status: 400 });
    }

    const { data: plan, error } = await admin
      .from("saas_plans")
      .update(patch)
      .eq("id", planId)
      .select("id, code, name, description, is_public, is_active, features, limits")
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
