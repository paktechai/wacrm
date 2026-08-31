import { describe, expect, it, vi } from 'vitest'
import { logAiUsage } from './usage'
import type { SupabaseClient } from '@supabase/supabase-js'

function fakeDb({ inserted = true }: { inserted?: boolean } = {}) {
  const select = vi.fn().mockResolvedValue({
    data: inserted ? [{ id: '11111111-1111-4111-8111-111111111111' }] : [],
    error: null,
  })
  const upsert = vi.fn(() => ({ select }))
  const rpc = vi.fn().mockResolvedValue({ data: 1, error: null })
  const db = { from: vi.fn(() => ({ upsert })), rpc }
  return {
    db: db as unknown as SupabaseClient,
    upsert,
    from: db.from,
    rpc,
  }
}

const baseArgs = {
  requestId: '11111111-1111-4111-8111-111111111111',
  accountId: 'acct-1',
  conversationId: 'conv-1',
  mode: 'auto_reply' as const,
  provider: 'anthropic' as const,
  model: 'claude-x',
  usage: { promptTokens: 30, completionTokens: 6, totalTokens: 36 },
}

describe('logAiUsage', () => {
  it('records one provider call and increments monthly usage exactly once', async () => {
    const { db, upsert, from, rpc } = fakeDb()

    await expect(logAiUsage(db, baseArgs)).resolves.toBe(true)

    expect(from).toHaveBeenCalledWith('ai_usage_log')
    expect(upsert).toHaveBeenCalledWith(
      {
        id: baseArgs.requestId,
        account_id: 'acct-1',
        conversation_id: 'conv-1',
        mode: 'auto_reply',
        provider: 'anthropic',
        model: 'claude-x',
        prompt_tokens: 30,
        completion_tokens: 6,
        total_tokens: 36,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('increment_account_usage', {
      p_account_id: 'acct-1',
      p_metric: 'ai_requests',
      p_quantity: 1,
    })
  })

  it('does not double-count a retry with the same request ID', async () => {
    const { db, rpc } = fakeDb({ inserted: false })

    await expect(logAiUsage(db, baseArgs)).resolves.toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('still counts a provider call when token usage is unavailable', async () => {
    const { db, upsert } = fakeDb()

    await expect(
      logAiUsage(db, { ...baseArgs, usage: null }),
    ).resolves.toBe(true)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      }),
      expect.any(Object),
    )
  })

  it('never throws when persistence fails', async () => {
    const select = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    })
    const db = {
      from: vi.fn(() => ({ upsert: vi.fn(() => ({ select })) })),
      rpc: vi.fn(),
    } as unknown as SupabaseClient

    await expect(logAiUsage(db, baseArgs)).resolves.toBe(false)
  })
})
