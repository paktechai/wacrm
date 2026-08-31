import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiProvider, AiUsage } from './types'

export interface LogAiUsageArgs {
  /** Stable UUID for one logical provider call. Reusing it on a transport
   *  retry makes the primary-key insert idempotent. */
  requestId: string
  accountId: string
  /** Null for a draft not tied to one thread, or when the row was
   *  deleted between generation and logging. */
  conversationId: string | null
  mode: 'auto_reply' | 'draft'
  provider: AiProvider
  model: string
  /** Provider usage. Calls are still recorded with zero tokens when null. */
  usage: AiUsage | null
}

/**
 * Best-effort append to `ai_usage_log` — one row per logical LLM call, for cost
 * visibility on the account's BYO key. NEVER throws: usage accounting
 * must not fail a reply the customer is waiting on, so any DB error is
 * logged and swallowed. The caller-provided request UUID becomes the row ID,
 * so Supabase/PostgREST retries cannot create a second usage row.
 *
 * Pass the service-role admin client from the webhook, or the RLS-scoped
 * SSR client from a route — writes land either way (there's no
 * `authenticated` INSERT policy, so an SSR write relies on the service
 * role; callers that must persist from a route should pass the admin
 * client).
 */
export async function logAiUsage(
  db: SupabaseClient,
  args: LogAiUsageArgs,
): Promise<boolean> {
  try {
    const usage = args.usage ?? {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    }
    const { data, error } = await db
      .from('ai_usage_log')
      .upsert(
        {
          id: args.requestId,
          account_id: args.accountId,
          conversation_id: args.conversationId,
          mode: args.mode,
          provider: args.provider,
          model: args.model,
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          total_tokens: usage.totalTokens,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )
      .select('id')

    if (error) {
      console.error('[ai usage] log insert failed:', error)
      return false
    }

    // An ignored duplicate returns no representation. Meter only a newly
    // inserted logical call so an HTTP/PostgREST retry cannot double-count.
    const inserted = Array.isArray(data) && data.length === 1
    if (!inserted) return false

    const { error: meterError } = await db.rpc('increment_account_usage', {
      p_account_id: args.accountId,
      p_metric: 'ai_requests',
      p_quantity: 1,
    })
    if (meterError) {
      console.error('[ai usage] monthly increment failed:', meterError)
    }
    return true
  } catch (err) {
    console.error('[ai usage] log insert threw:', err)
    return false
  }
}
