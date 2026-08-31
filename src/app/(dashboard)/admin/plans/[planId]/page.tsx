import Link from "next/link";
import { ArrowLeft, Layers3 } from "lucide-react";
import { notFound } from "next/navigation";

import { requirePlatformAdmin } from "@/lib/platform/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlanEditor, type EditablePlan } from "./plan-editor";

export default async function AdminPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const actor = await requirePlatformAdmin();
  const { planId } = await params;
  const admin = createAdminClient();

  const { data: plan, error } = await admin
    .from("saas_plans")
    .select("id, code, name, description, features, limits, is_active, is_public")
    .eq("id", planId)
    .maybeSingle();

  if (error) throw error;
  if (!plan) notFound();

  const editablePlan: EditablePlan = {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    features:
      plan.features && typeof plan.features === "object" && !Array.isArray(plan.features)
        ? (plan.features as Record<string, boolean>)
        : {},
    limits:
      plan.limits && typeof plan.limits === "object" && !Array.isArray(plan.limits)
        ? (plan.limits as Record<string, number | null>)
        : {},
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Super Admin
      </Link>

      <header className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            <Layers3 className="size-4" />
            Plan configuration
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            {plan.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Configure capabilities and authoritative usage limits for plan code{" "}
            <span className="font-mono text-foreground">{plan.code}</span>.
          </p>
        </div>
        <div className="flex gap-2 text-[10px] font-semibold uppercase tracking-wider">
          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-muted-foreground">
            {plan.is_active ? "Active" : "Inactive"}
          </span>
          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-muted-foreground">
            {plan.is_public ? "Public" : "Private"}
          </span>
        </div>
      </header>

      <PlanEditor
        plan={editablePlan}
        canEdit={actor.role === "super_admin" || actor.role === "billing_admin"}
      />
    </div>
  );
}
