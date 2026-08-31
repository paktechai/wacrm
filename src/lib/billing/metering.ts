import { createAdminClient } from '@/lib/supabase/admin'
import type { Wova8Metric } from './catalog'

export async function incrementUsage(
  accountId: string,
  metric: Wova8Metric | string,
  quantity = 1,
): Promise<number> {
  if (!accountId) throw new Error('accountId is required')
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error('Usage quantity must be a positive integer')
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('increment_account_usage', {
    p_account_id: accountId,
    p_metric: metric,
    p_quantity: quantity,
  })

  if (error) {
    throw new Error(`Could not increment usage metric '${metric}': ${error.message}`)
  }

  return Number(data ?? 0)
}

/**
 * Usage accounting should never turn a successful customer action into a
 * 500 response. Use this after the external/action side effect succeeded.
 * Limit checks still happen before the action through requireUsageAvailable.
 */
export function incrementUsageBestEffort(
  accountId: string,
  metric: Wova8Metric | string,
  quantity = 1,
): void {
  void incrementUsage(accountId, metric, quantity).catch((error) => {
    console.error('[billing/metering] usage increment failed', {
      accountId,
      metric,
      quantity,
      error,
    })
  })
}
