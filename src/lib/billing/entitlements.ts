import type { SupabaseClient } from '@supabase/supabase-js';
import { ForbiddenError } from '@/lib/auth/account';

export type EntitlementMap = Record<string, boolean>;
export type LimitMap = Record<string, number | null>;

export interface AccountEntitlements {
  accountId: string;
  lifecycleStatus: string | null;
  subscriptionStatus: string | null;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  features: EntitlementMap;
  limits: LimitMap;
}

interface EntitlementOptions {
  lifecycleStatus?: string | null;
}

interface EmbeddedPlan {
  id: string;
  code: string;
  name: string;
  features: unknown;
  limits: unknown;
}

function normalizePlanName(
  code: string | null,
  name: string | null
): string | null {
  if (code === 'foundation' || name === 'SBYT Foundation') return 'Wova8';
  return name;
}

function normalizeFeatures(value: unknown): EntitlementMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, enabled]) => [
      key,
      enabled === true,
    ])
  );
}

function normalizeLimits(value: unknown): LimitMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const result: LimitMap = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === null) {
      result[key] = null;
      continue;
    }
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
      result[key] = raw;
    }
  }
  return result;
}

export async function getAccountEntitlements(
  supabase: SupabaseClient,
  accountId: string,
  options: EntitlementOptions = {}
): Promise<AccountEntitlements> {
  const accountPromise =
    options.lifecycleStatus === undefined
      ? supabase
          .from('accounts')
          .select('lifecycle_status')
          .eq('id', accountId)
          .maybeSingle()
      : Promise.resolve({
          data: { lifecycle_status: options.lifecycleStatus },
          error: null,
        });

  const [
    { data: account, error: accountError },
    { data: subscription, error: subscriptionError },
  ] = await Promise.all([
    accountPromise,
    supabase
      .from('account_subscriptions')
      .select(
        'plan_id, status, plan:saas_plans!account_subscriptions_plan_id_fkey(id, code, name, features, limits)'
      )
      .eq('account_id', accountId)
      .maybeSingle(),
  ]);

  if (accountError) {
    throw new Error(
      `Could not load account lifecycle: ${accountError.message}`
    );
  }
  if (subscriptionError) {
    throw new Error(
      `Could not load subscription: ${subscriptionError.message}`
    );
  }

  if (!subscription?.plan_id) {
    return {
      accountId,
      lifecycleStatus: account?.lifecycle_status ?? null,
      subscriptionStatus: subscription?.status ?? null,
      planId: null,
      planCode: null,
      planName: null,
      features: {},
      limits: {},
    };
  }

  const embeddedPlan = subscription.plan as
    EmbeddedPlan | EmbeddedPlan[] | null;
  const plan = Array.isArray(embeddedPlan)
    ? (embeddedPlan[0] ?? null)
    : embeddedPlan;

  return {
    accountId,
    lifecycleStatus: account?.lifecycle_status ?? null,
    subscriptionStatus: subscription.status ?? null,
    planId: plan?.id ?? subscription.plan_id,
    planCode: plan?.code ?? null,
    planName: normalizePlanName(plan?.code ?? null, plan?.name ?? null),
    features: normalizeFeatures(plan?.features),
    limits: normalizeLimits(plan?.limits),
  };
}

export async function requireAccountService(
  supabase: SupabaseClient,
  accountId: string
): Promise<AccountEntitlements> {
  const entitlements = await getAccountEntitlements(supabase, accountId);

  if (
    entitlements.lifecycleStatus === 'suspended' ||
    entitlements.lifecycleStatus === 'cancelled'
  ) {
    throw new ForbiddenError('This workspace is not currently active');
  }

  if (
    entitlements.subscriptionStatus === 'paused' ||
    entitlements.subscriptionStatus === 'cancelled'
  ) {
    throw new ForbiddenError('This subscription is not currently active');
  }

  return entitlements;
}

export function requireFeature(
  entitlements: AccountEntitlements,
  feature: string
): void {
  // Backwards-compatible escape hatch for an installation that has not yet
  // applied migration 041. Once a subscription row exists, plan feature
  // enforcement is strict — including an intentionally unassigned plan.
  if (
    entitlements.subscriptionStatus === null &&
    entitlements.planId === null
  ) {
    return;
  }

  if (entitlements.features[feature] !== true) {
    throw new ForbiddenError(`Your current plan does not include '${feature}'`);
  }
}

export async function getCurrentMonthUsage(
  supabase: SupabaseClient,
  accountId: string,
  metric: string
): Promise<number> {
  const now = new Date();
  const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('account_usage_monthly')
    .select('quantity')
    .eq('account_id', accountId)
    .eq('period_start', periodStart)
    .eq('metric', metric)
    .maybeSingle();

  if (error) throw new Error(`Could not load usage: ${error.message}`);
  return Number(data?.quantity ?? 0);
}

export async function requireUsageAvailable(
  supabase: SupabaseClient,
  entitlements: AccountEntitlements,
  metric: string,
  additional = 1
): Promise<void> {
  const limit = entitlements.limits[metric];
  if (limit === null || limit === undefined) return;

  const current = await getCurrentMonthUsage(
    supabase,
    entitlements.accountId,
    metric
  );

  if (current + additional > limit) {
    throw new ForbiddenError(
      `Plan limit reached for '${metric}' (${current}/${limit})`
    );
  }
}
