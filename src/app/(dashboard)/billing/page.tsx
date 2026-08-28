import { CreditCard, Gauge, Layers3, ShieldCheck } from 'lucide-react'

import { getCurrentAccount } from '@/lib/auth/account'
import { getAccountEntitlements } from '@/lib/billing/entitlements'

export default async function BillingPage() {
  const ctx = await getCurrentAccount()
  const entitlements = await getAccountEntitlements(ctx.supabase, ctx.accountId)

  const now = new Date()
  const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
  const { data: usageRows, error: usageError } = await ctx.supabase
    .from('account_usage_monthly')
    .select('metric, quantity, updated_at')
    .eq('account_id', ctx.accountId)
    .eq('period_start', periodStart)
    .order('metric')

  if (usageError) {
    console.error('[billing page] usage load failed:', usageError)
  }

  const enabledFeatures = Object.entries(entitlements.features)
    .filter(([, enabled]) => enabled)
    .map(([feature]) => feature)
    .sort()

  const limits = Object.entries(entitlements.limits).sort(([a], [b]) =>
    a.localeCompare(b),
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7">
      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
          <CreditCard className="size-4" />
          Wova8 subscription
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
          Plan & usage
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Review your workspace service status, included capabilities and current-month usage.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<Layers3 className="size-4" />}
          label="Current plan"
          value={entitlements.planName ?? 'No plan assigned'}
          detail={entitlements.planCode ? `Code: ${entitlements.planCode}` : 'Contact Wova8 for plan assignment'}
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
          value={formatLabel(entitlements.subscriptionStatus ?? 'not configured')}
          detail="Provider-neutral subscription state"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Included capabilities</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Features currently enabled by your Wova8 plan.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {enabledFeatures.length > 0 ? (
              enabledFeatures.map((feature) => (
                <span
                  key={feature}
                  className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                >
                  {formatLabel(feature)}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No plan capabilities are currently assigned.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Plan limits</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Missing limits are treated as uncapped for this plan.
          </p>
          <div className="mt-4 space-y-2">
            {limits.length > 0 ? (
              limits.map(([metric, value]) => (
                <div
                  key={metric}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/40 px-3 py-2.5"
                >
                  <span className="text-xs text-muted-foreground">{formatLabel(metric)}</span>
                  <span className="text-xs font-semibold text-foreground">
                    {value === null ? 'Unlimited' : value.toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No hard limits are configured.</p>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">This month&apos;s usage</h2>
          <p className="mt-1 text-xs text-muted-foreground">Period starting {periodStart}</p>
        </div>
        <div className="divide-y divide-border">
          {(usageRows ?? []).length > 0 ? (
            (usageRows ?? []).map((row) => {
              const limit = entitlements.limits[row.metric]
              const quantity = Number(row.quantity ?? 0)
              return (
                <div key={row.metric} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <div className="text-sm font-medium text-foreground">{formatLabel(row.metric)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Monthly metered usage</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">
                      {quantity.toLocaleString()}
                      {typeof limit === 'number' ? ` / ${limit.toLocaleString()}` : ''}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {limit === null || limit === undefined ? 'Uncapped' : 'Plan limit'}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No metered usage recorded yet this month.
            </div>
          )}
        </div>
      </section>

      <div className="rounded-2xl border border-border bg-muted/30 px-5 py-4 text-xs leading-5 text-muted-foreground">
        Commercial checkout is intentionally provider-neutral for now. Wova8 can assign plans from Super Admin; payment-gateway activation can be connected later without changing the entitlement model.
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      </div>
      <div className="mt-4 text-lg font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}

function formatLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
