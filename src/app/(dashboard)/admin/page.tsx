import { Building2, CreditCard, ShieldCheck, UsersRound } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/platform/admin";

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
    admin.from("saas_plans").select("id, code, name, is_active"),
  ]);

  if (accountsError || subscriptionsError || plansError) {
    console.error("[PlatformAdminPage] overview query failed", {
      accountsError,
      subscriptionsError,
      plansError,
    });
  }

  const planById = new Map((plans ?? []).map((plan) => [plan.id, plan]));
  const subscriptionByAccount = new Map(
    (subscriptions ?? []).map((subscription) => [
      subscription.account_id,
      subscription,
    ]),
  );

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
            Manage tenant lifecycle, subscriptions, plans and platform-level
            operations from one isolated control surface.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{platformAdmin.email ?? platformAdmin.userId}</span>
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

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Tenant accounts</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Latest 50 workspaces with lifecycle and subscription state.
            </p>
          </div>
          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Platform view
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Account</th>
                <th className="px-5 py-3 font-semibold">Lifecycle</th>
                <th className="px-5 py-3 font-semibold">Plan</th>
                <th className="px-5 py-3 font-semibold">Subscription</th>
                <th className="px-5 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(accounts ?? []).map((account) => {
                const subscription = subscriptionByAccount.get(account.id);
                const plan = subscription?.plan_id
                  ? planById.get(subscription.plan_id)
                  : null;

                return (
                  <tr key={account.id} className="hover:bg-muted/25">
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">{account.name}</div>
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">{account.id}</div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge value={account.lifecycle_status ?? "active"} />
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
                  </tr>
                );
              })}
              {(accounts ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
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
  const positive = ["active", "trial", "trialing"].includes(normalized);
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
