import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";

type UsageMetric = { metric: string; quantity: number };
type TenantUsage = {
  accountId: string;
  accountName: string;
  metrics: UsageMetric[];
};

export default async function PlatformUsagePage() {
  const admin = createAdminClient();
  const now = new Date();
  const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const { data: usage, error: usageError } = await admin
    .from("account_usage_monthly")
    .select("account_id, metric, quantity, updated_at")
    .eq("period_start", periodStart)
    .order("account_id")
    .order("metric");

  if (usageError) throw usageError;

  const accountIds = [...new Set((usage ?? []).map((row) => row.account_id))];
  const { data: accounts, error: accountsError } = accountIds.length
    ? await admin.from("accounts").select("id, name").in("id", accountIds)
    : { data: [], error: null };
  if (accountsError) throw accountsError;

  const accountName = new Map((accounts ?? []).map((row) => [row.id, row.name] as const));
  const grouped = new Map<string, TenantUsage>();

  for (const row of usage ?? []) {
    const current: TenantUsage = grouped.get(row.account_id) ?? {
      accountId: row.account_id,
      accountName: accountName.get(row.account_id) ?? "Unknown account",
      metrics: [],
    };
    current.metrics.push({ metric: row.metric, quantity: Number(row.quantity ?? 0) });
    grouped.set(row.account_id, current);
  }

  const rows = [...grouped.values()].sort((a, b) =>
    a.accountName.localeCompare(b.accountName),
  );

  const totals = new Map<string, number>();
  for (const row of usage ?? []) {
    totals.set(row.metric, (totals.get(row.metric) ?? 0) + Number(row.quantity ?? 0));
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Super Admin
      </Link>

      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
          <BarChart3 className="size-4" />
          Platform usage
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
          Current month metering
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Period starting {periodStart}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[...totals.entries()].slice(0, 8).map(([metric, total]) => (
          <div key={metric} className="rounded-2xl border border-border bg-card p-5">
            <div className="text-xs text-muted-foreground">{formatLabel(metric)}</div>
            <div className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-foreground">
              {total.toLocaleString()}
            </div>
          </div>
        ))}
        {totals.size === 0 ? (
          <div className="col-span-full rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No usage has been metered yet this month.
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Usage by tenant</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Server- and database-recorded SaaS counters grouped by workspace.
          </p>
        </div>
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <div key={row.accountId} className="px-5 py-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">{row.accountName}</div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">{row.accountId}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
                  {row.metrics.map((metric) => (
                    <span
                      key={metric.metric}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {formatLabel(metric.metric)}: {metric.quantity.toLocaleString()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No tenant usage rows for this period.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
