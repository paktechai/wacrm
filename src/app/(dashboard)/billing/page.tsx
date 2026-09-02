import { CreditCard, Gauge, Layers3, ShieldCheck } from 'lucide-react';

import { getCurrentAccount } from '@/lib/auth/account';
import { getAccountEntitlements } from '@/lib/billing/entitlements';

export default async function BillingPage() {
  const ctx = await getCurrentAccount();
  const now = new Date();
  const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const [entitlements, { data: usageRows, error: usageError }] =
    await Promise.all([
      getAccountEntitlements(ctx.supabase, ctx.accountId, {
        lifecycleStatus: ctx.account.lifecycleStatus,
      }),
      ctx.supabase
        .from('account_usage_monthly')
        .select('metric, quantity, updated_at')
        .eq('account_id', ctx.accountId)
        .eq('period_start', periodStart)
        .order('metric'),
    ]);

  if (usageError) {
    console.error('[billing page] usage load failed:', usageError);
  }

  const enabledFeatures = Object.entries(entitlements.features)
    .filter(([, enabled]) => enabled)
    .map(([feature]) => feature)
    .sort();

  const limits = Object.entries(entitlements.limits).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7">
      <header>
        <div className="text-primary flex items-center gap-2 text-xs font-semibold tracking-[0.15em] uppercase">
          <CreditCard className="size-4" />
          Wova8 subscription
        </div>
        <h1 className="text-foreground mt-2 text-3xl font-semibold tracking-[-0.04em]">
          Plan & usage
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
          Review your workspace service status, included capabilities and
          current-month usage.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<Layers3 className="size-4" />}
          label="Current plan"
          value={entitlements.planName ?? 'No plan assigned'}
          detail={
            entitlements.planCode
              ? `Code: ${entitlements.planCode}`
              : 'Contact Wova8 for plan assignment'
          }
        />
        <SummaryCard
          icon={<ShieldCheck className="size-4" />}
          label="Workspace status"
          value={formatLabel(entitlements.lifecycleStatus ?? 'active')}
          detail="Controlled by Wova8 account lifecycle"
        />
        <SummaryCard
          icon={<Gauge className="size-4" />}
          label="Subscription"
          value={formatLabel(
            entitlements.subscriptionStatus ?? 'not configured'
          )}
          detail="Provider-neutral subscription state"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="border-border bg-card rounded-2xl border p-5">
          <h2 className="text-foreground text-sm font-semibold">
            Included capabilities
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Features currently enabled by your Wova8 plan.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {enabledFeatures.length > 0 ? (
              enabledFeatures.map((feature) => (
                <span
                  key={feature}
                  className="border-primary/20 bg-primary/10 text-primary rounded-full border px-3 py-1.5 text-xs font-medium"
                >
                  {formatLabel(feature)}
                </span>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                No plan capabilities are currently assigned.
              </p>
            )}
          </div>
        </div>

        <div className="border-border bg-card rounded-2xl border p-5">
          <h2 className="text-foreground text-sm font-semibold">Plan limits</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Missing limits are treated as uncapped for this plan.
          </p>
          <div className="mt-4 space-y-2">
            {limits.length > 0 ? (
              limits.map(([metric, value]) => (
                <div
                  key={metric}
                  className="border-border/70 bg-background/40 flex items-center justify-between gap-4 rounded-xl border px-3 py-2.5"
                >
                  <span className="text-muted-foreground text-xs">
                    {formatLabel(metric)}
                  </span>
                  <span className="text-foreground text-xs font-semibold">
                    {value === null ? 'Unlimited' : value.toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                No hard limits are configured.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="border-border bg-card overflow-hidden rounded-2xl border">
        <div className="border-border border-b px-5 py-4">
          <h2 className="text-foreground text-sm font-semibold">
            This month&apos;s usage
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Period starting {periodStart}
          </p>
        </div>
        <div className="divide-border divide-y">
          {(usageRows ?? []).length > 0 ? (
            (usageRows ?? []).map((row) => {
              const limit = entitlements.limits[row.metric];
              const quantity = Number(row.quantity ?? 0);
              return (
                <div
                  key={row.metric}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div>
                    <div className="text-foreground text-sm font-medium">
                      {formatLabel(row.metric)}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      Monthly metered usage
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-foreground text-sm font-semibold">
                      {quantity.toLocaleString()}
                      {typeof limit === 'number'
                        ? ` / ${limit.toLocaleString()}`
                        : ''}
                    </div>
                    <div className="text-muted-foreground mt-1 text-[10px] tracking-wider uppercase">
                      {limit === null || limit === undefined
                        ? 'Uncapped'
                        : 'Plan limit'}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-muted-foreground px-5 py-10 text-center text-sm">
              No metered usage recorded yet this month.
            </div>
          )}
        </div>
      </section>

      <div className="border-border bg-muted/30 text-muted-foreground rounded-2xl border px-5 py-4 text-xs leading-5">
        Commercial checkout is intentionally provider-neutral for now. Wova8 can
        assign plans from Super Admin; payment-gateway activation can be
        connected later without changing the entitlement model.
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-border bg-card rounded-2xl border p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs font-medium">
          {label}
        </span>
        <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
          {icon}
        </span>
      </div>
      <div className="text-foreground mt-4 text-lg font-semibold">{value}</div>
      <div className="text-muted-foreground mt-1 text-xs">{detail}</div>
    </div>
  );
}

function formatLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
