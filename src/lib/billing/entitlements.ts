import type { SupabaseClient } from "@supabase/supabase-js";
import { ForbiddenError } from "@/lib/auth/account";

export type EntitlementMap = Record<string, boolean>;
export type LimitMap = Record<string, number | null>;

export interface AccountEntitlements {
  accountId: string;
  subscriptionStatus: string | null;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  features: EntitlementMap;
  limits: LimitMap;
}

function normalizeFeatures(value: unknown): EntitlementMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, enabled]) => [
      key,
      enabled === true,
    ]),
  );
}

function normalizeLimits(value: unknown): LimitMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const result: LimitMap = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === null) {
      result[key] = null;
      continue;
    }
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
      result[key] = raw;
    }
  }
  return result;
}

/**
 * Load the account's current plan without relying on PostgREST embedded
 * relationship inference. The app has previously seen schema-cache drift,
 * so subscription and plan are intentionally fetched as two point queries.
 */
export async function getAccountEntitlements(
  supabase: SupabaseClient,
  accountId: string,
): Promise<AccountEntitlements> {
  const { data: subscription, error: subscriptionError } = await supabase
    .from("account_subscriptions")
    .select("plan_id, status")
    .eq("account_id", accountId)
    .maybeSingle();

  if (subscriptionError) {
    throw new Error(`Could not load subscription: ${subscriptionError.message}`);
  }

  if (!subscription?.plan_id) {
    return {
      accountId,
      subscriptionStatus: subscription?.status ?? null,
      planId: null,
      planCode: null,
      planName: null,
      features: {},
      limits: {},
    };
  }

  const { data: plan, error: planError } = await supabase
    .from("saas_plans")
    .select("id, code, name, features, limits")
    .eq("id", subscription.plan_id)
    .maybeSingle();

  if (planError) {
    throw new Error(`Could not load plan: ${planError.message}`);
  }

  return {
    accountId,
    subscriptionStatus: subscription.status ?? null,
    planId: plan?.id ?? subscription.plan_id,
    planCode: plan?.code ?? null,
    planName: plan?.name ?? null,
    features: normalizeFeatures(plan?.features),
    limits: normalizeLimits(plan?.limits),
  };
}

export function requireFeature(
  entitlements: AccountEntitlements,
  feature: string,
): void {
  if (entitlements.features[feature] !== true) {
    throw new ForbiddenError(`Your current plan does not include '${feature}'`);
  }
}

export async function getCurrentMonthUsage(
  supabase: SupabaseClient,
  accountId: string,
  metric: string,
): Promise<number> {
  const now = new Date();
  const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("account_usage_monthly")
    .select("quantity")
    .eq("account_id", accountId)
    .eq("period_start", periodStart)
    .eq("metric", metric)
    .maybeSingle();

  if (error) throw new Error(`Could not load usage: ${error.message}`);
  return Number(data?.quantity ?? 0);
}

/**
 * Server-side guard for metered features.
 * A null/missing limit means "not capped by this plan record".
 */
export async function requireUsageAvailable(
  supabase: SupabaseClient,
  entitlements: AccountEntitlements,
  metric: string,
  additional = 1,
): Promise<void> {
  const limit = entitlements.limits[metric];
  if (limit === null || limit === undefined) return;

  const current = await getCurrentMonthUsage(
    supabase,
    entitlements.accountId,
    metric,
  );

  if (current + additional > limit) {
    throw new ForbiddenError(
      `Plan limit reached for '${metric}' (${current}/${limit})`,
    );
  }
}
