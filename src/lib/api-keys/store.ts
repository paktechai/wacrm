// ============================================================
// API key store — auth-path data access for public API keys.
// Service-role access is deliberately contained in this module.
// ============================================================

import { supabaseAdmin } from '@/lib/flows/admin-client';

export interface ApiKeyRow {
  id: string;
  account_id: string;
  created_by: string | null;
  name: string;
  scopes: string[];
  expires_at: string | null;
  revoked_at: string | null;
}

export interface ApiAccessState {
  allowed: boolean;
  reason?: 'workspace_inactive' | 'subscription_inactive' | 'feature_disabled' | 'limit_reached';
  current?: number;
  limit?: number;
}

export async function findActiveKeyByHash(
  hash: string
): Promise<ApiKeyRow | null> {
  const { data, error } = await supabaseAdmin()
    .from('api_keys')
    .select('id, account_id, created_by, name, scopes, expires_at, revoked_at')
    .eq('key_hash', hash)
    .maybeSingle();

  if (error) {
    console.error('[api-keys/store] lookup error:', error.message);
    return null;
  }
  if (!data) return null;

  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return data as ApiKeyRow;
}

/**
 * Resolve workspace lifecycle, subscription, API entitlement and monthly API
 * quota for a machine-to-machine caller. Public API calls run through a
 * service-role client, so this explicit guard is the SaaS boundary that RLS
 * cannot provide on its own.
 */
export async function getApiAccessState(accountId: string): Promise<ApiAccessState> {
  const db = supabaseAdmin();

  const [{ data: account, error: accountError }, { data: subscription, error: subError }] =
    await Promise.all([
      db
        .from('accounts')
        .select('lifecycle_status')
        .eq('id', accountId)
        .maybeSingle(),
      db
        .from('account_subscriptions')
        .select('plan_id, status')
        .eq('account_id', accountId)
        .maybeSingle(),
    ]);

  if (accountError || subError) {
    console.error('[api-keys/store] SaaS access lookup failed', {
      accountError,
      subError,
    });
    return { allowed: false, reason: 'workspace_inactive' };
  }

  if (
    account?.lifecycle_status === 'suspended' ||
    account?.lifecycle_status === 'cancelled'
  ) {
    return { allowed: false, reason: 'workspace_inactive' };
  }

  // Backwards compatibility for installations that have not introduced
  // subscriptions yet. On SBYT production migration 041 guarantees a row.
  if (!subscription) return { allowed: true };

  if (subscription.status === 'paused' || subscription.status === 'cancelled') {
    return { allowed: false, reason: 'subscription_inactive' };
  }

  if (!subscription.plan_id) {
    return { allowed: false, reason: 'feature_disabled' };
  }

  const { data: plan, error: planError } = await db
    .from('saas_plans')
    .select('features, limits, is_active')
    .eq('id', subscription.plan_id)
    .maybeSingle();

  if (planError || !plan || plan.is_active !== true) {
    return { allowed: false, reason: 'feature_disabled' };
  }

  const features =
    plan.features && typeof plan.features === 'object' && !Array.isArray(plan.features)
      ? (plan.features as Record<string, unknown>)
      : {};
  if (features.api !== true) {
    return { allowed: false, reason: 'feature_disabled' };
  }

  const limits =
    plan.limits && typeof plan.limits === 'object' && !Array.isArray(plan.limits)
      ? (plan.limits as Record<string, unknown>)
      : {};
  const apiLimit = limits.api_requests;
  if (typeof apiLimit !== 'number' || !Number.isFinite(apiLimit) || apiLimit < 0) {
    return { allowed: true };
  }

  const now = new Date();
  const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const { data: usage, error: usageError } = await db
    .from('account_usage_monthly')
    .select('quantity')
    .eq('account_id', accountId)
    .eq('period_start', periodStart)
    .eq('metric', 'api_requests')
    .maybeSingle();

  if (usageError) {
    console.error('[api-keys/store] API usage lookup failed:', usageError.message);
    return { allowed: false, reason: 'limit_reached' };
  }

  const current = Number(usage?.quantity ?? 0);
  if (current + 1 > apiLimit) {
    return { allowed: false, reason: 'limit_reached', current, limit: apiLimit };
  }

  return { allowed: true, current, limit: apiLimit };
}

export async function getAccountName(
  accountId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from('accounts')
    .select('name')
    .eq('id', accountId)
    .maybeSingle();
  if (error || !data) return null;
  return (data.name as string) ?? null;
}

export function touchLastUsed(id: string): void {
  void supabaseAdmin()
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', id)
    .then(({ error }) => {
      if (error) {
        console.warn(
          '[api-keys/store] last_used_at bump failed:',
          error.message
        );
      }
    });
}
