import Link from "next/link";
import {
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import {
  AccountAdminControls,
  CreatePlanForm,
  PlanVisibilityControls,
  type AdminPlanOption,
} from "./admin-controls";

export default async function PlatformAdminPage() {
  const platformAdmin = await requirePlatformAdmin();
  const admin = createAdminClient();

  const [
    { count: accountCount },
    { count: activeCount },
    { count: trialCount },
    { count: suspendedCount },
    { data: accounts, error: accountsError },
    { data: subscriptions, error: subscriptionsError },
    { data: plans, error: plansError },
  ] = await Promise.all([
    admin.from("accounts").select("id", { count: "exact", head: true }),
    admin
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("lifecycle_status", "active"),
    admin
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("lifecycle_status", "trial"),
    admin
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("lifecycle_status", "suspended"),
    admin
      .from("accounts")
      .select("id, name, lifecycle_status, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("account_subscriptions")
      .select("account_id, plan_id, status, current_period_end"),
    admin
      .from("saas_plans")
      .select("id, code, name, description, is_active, is_public")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (accountsError || subscriptionsError || plansError) {
    console.error("[PlatformAdminPage] overview query failed", {
      accountsError,
      subscriptionsError,
      plansError,
    });
  }

  const planOptions = (plans ?? []) as AdminPlanOption[];
  const planById = new Map(planOptions.map((plan) => [plan.id, plan] as const));
  const subscriptionByAccount = new Map(
    (subscriptions ?? []).map(
      (subscription) => [subscription.account_id, subscription] as const,
    ),
  );
  const canManageBilling = platformAdmin.role !== "support";
  const canChangeLifecycle = platformAdmin.role === "super_admin";

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-7 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <ShieldCheck className="size-4" />
            SBYT Platform Control
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
            Super Admin
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage tenant lifecycle, subscriptions, plans, metering and
            platform-level operations from one isolated control surface.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin/usage"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <BarChart3 className="size-4" />
              Usage metering
            </Link>
            <Link
              href="/admin/audit"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <ClipboardList className="size-4" />
              Audit log
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
          Signed in as{" "}
          <span className="font-medium text-foreground">
            {platformAdmin.email ?? platformAdmin.userId}
          </span>
          <span className="mx-2 text-border">•</span>
          {platformAdmin.role.replaceAll("_", " ")}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Building2 className="size-4" />}
          label="Total accounts"
          value={accountCount ?? 0}
        />
        <MetricCard
          icon={<UsersRound className="size-4" />}
          label="Active"
          value={activeCount ?? 0}
        />
        <MetricCard
          icon={<CreditCard className="size-4" />}
          label="Trial"
          value={trialCount ?? 0}
        />
        <MetricCard
          icon={<ShieldCheck className="size-4" />}
          label="Suspended"
          value={suspendedCount ?? 0}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">SaaS plans</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Create private plans, configure capabilities and apply hard
                limits without tying the platform to a payment gateway.
              </p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {planOptions.length} plan{planOptions.length === 1 ? "" : "s"}
            </span>
          </div>
          {canManageBilling ? (
            <div className="mt-4">
              <CreatePlanForm />
            </div>
          ) : null}
        </div>

        <div className="divide-y divide-border">
          {planOptions.map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{plan.name}</span>
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
                    {plan.code}
                  </span>
                  <StatusBadge value={plan.is_active ? "active" : "inactive"} />
                  <StatusBadge value={plan.is_public ? "public" : "private"} />
                </div>
                {plan.description ? (
                  <p className="mt-1.5 max-w-3xl text-xs leading-5 text-muted-foreground">
                    {plan.description}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/plans/${plan.id}`}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  <Settings2 className="size-4" />
                  Configure
                </Link>
                {canManageBilling ? <PlanVisibilityControls plan={plan} /> : null}
              </div>
            </div>
          ))}
          {planOptions.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No plans yet. Create the first SBYT CRM plan above.
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Tenant accounts</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Latest 50 workspaces with lifecycle and subscription controls.
            </p>
          </div>
          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Platform view
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Account</th>
                <th className="px-5 py-3 font-semibold">Lifecycle</th>
                <th className="px-5 py-3 font-semibold">Plan</th>
                <th className="px-5 py-3 font-semibold">Subscription</th>
                <th className="px-5 py-3 font-semibold">Created</th>
                <th className="px-5 py-3 font-semibold">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(accounts ?? []).map((account) => {
                const subscription = subscriptionByAccount.get(account.id);
                const plan = subscription?.plan_id
                  ? planById.get(subscription.plan_id)
                  : null;
                const lifecycleStatus = account.lifecycle_status ?? "active";
                const subscriptionStatus = subscription?.status ?? "active";

                return (
                  <tr key={account.id} className="align-top hover:bg-muted/25">
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">{account.name}</div>
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {account.id}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge value={lifecycleStatus} />
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {plan?.name ?? "Unassigned"}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge value={subscription?.status ?? "none"} />
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {account.created_at
                        ? new Intl.DateTimeFormat("en", {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                          }).format(new Date(account.created_at))
                        : "—"}
                    </td>
                    <td className="px-5 py-4">
                      {canManageBilling ? (
                        <AccountAdminControls
                          accountId={account.id}
                          lifecycleStatus={lifecycleStatus}
                          planId={subscription?.plan_id ?? null}
                          subscriptionStatus={subscriptionStatus}
                          plans={planOptions}
                          canChangeLifecycle={canChangeLifecycle}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Read only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(accounts ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No tenant accounts found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
      <div className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-foreground">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const positive = ["active", "trial", "trialing", "public"].includes(normalized);
  const warning = ["past_due", "paused"].includes(normalized);

  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
        positive
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
          : warning
            ? "border-amber-500/25 bg-amber-500/10 text-amber-400"
            : "border-border bg-muted text-muted-foreground",
      ].join(" ")}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
