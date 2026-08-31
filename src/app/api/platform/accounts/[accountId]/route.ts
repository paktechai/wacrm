import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/platform/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { toErrorResponse } from "@/lib/auth/account";

const lifecycleStatuses = new Set([
  "trial",
  "active",
  "past_due",
  "suspended",
  "cancelled",
]);

const subscriptionStatuses = new Set([
  "trialing",
  "active",
  "past_due",
  "paused",
  "cancelled",
]);

type PatchBody = {
  lifecycleStatus?: string;
  planId?: string | null;
  subscriptionStatus?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const actor = await requirePlatformAdmin(["super_admin", "billing_admin"]);
    const { accountId } = await params;
    const body = (await request.json()) as PatchBody;
    const admin = createAdminClient();

    if (!accountId) {
      return NextResponse.json({ error: "Account id is required" }, { status: 400 });
    }

    const { data: account, error: accountError } = await admin
      .from("accounts")
      .select("id, lifecycle_status")
      .eq("id", accountId)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const auditMetadata: Record<string, unknown> = {};

    if (body.lifecycleStatus !== undefined) {
      if (actor.role !== "super_admin") {
        return NextResponse.json(
          { error: "Only a super admin can change account lifecycle" },
          { status: 403 },
        );
      }
      if (!lifecycleStatuses.has(body.lifecycleStatus)) {
        return NextResponse.json(
          { error: "Invalid lifecycle status" },
          { status: 400 },
        );
      }

      const { error } = await admin
        .from("accounts")
        .update({ lifecycle_status: body.lifecycleStatus })
        .eq("id", accountId);
      if (error) throw error;
      auditMetadata.lifecycle_status = body.lifecycleStatus;
    }

    const touchesSubscription =
      body.planId !== undefined || body.subscriptionStatus !== undefined;

    if (touchesSubscription) {
      if (
        body.subscriptionStatus !== undefined &&
        !subscriptionStatuses.has(body.subscriptionStatus)
      ) {
        return NextResponse.json(
          { error: "Invalid subscription status" },
          { status: 400 },
        );
      }

      if (body.planId) {
        const { data: plan, error: planError } = await admin
          .from("saas_plans")
          .select("id")
          .eq("id", body.planId)
          .maybeSingle();
        if (planError) throw planError;
        if (!plan) {
          return NextResponse.json({ error: "Plan not found" }, { status: 404 });
        }
      }

      const { data: existing, error: existingError } = await admin
        .from("account_subscriptions")
        .select("account_id, plan_id, status")
        .eq("account_id", accountId)
        .maybeSingle();
      if (existingError) throw existingError;

      const subscription = {
        account_id: accountId,
        plan_id: body.planId !== undefined ? body.planId : existing?.plan_id ?? null,
        status:
          body.subscriptionStatus ??
          existing?.status ??
          (account.lifecycle_status === "trial" ? "trialing" : "active"),
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await admin
        .from("account_subscriptions")
        .upsert(subscription, { onConflict: "account_id" });
      if (upsertError) throw upsertError;

      auditMetadata.plan_id = subscription.plan_id;
      auditMetadata.subscription_status = subscription.status;
    }

    if (Object.keys(auditMetadata).length === 0) {
      return NextResponse.json({ error: "No changes supplied" }, { status: 400 });
    }

    const { error: auditError } = await admin.from("platform_audit_log").insert({
      actor_user_id: actor.userId,
      action: "account.updated",
      target_type: "account",
      target_id: accountId,
      metadata: auditMetadata,
    });

    if (auditError) {
      console.error("[platform account PATCH] audit log failed", auditError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
