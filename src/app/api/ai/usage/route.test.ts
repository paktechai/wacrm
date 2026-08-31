import { describe, expect, it, vi } from 'vitest'

const usageRows = vi.hoisted(() => [
  {
    created_at: new Date().toISOString(),
    mode: 'draft',
    provider: 'openai',
    model: 'gpt-test',
    prompt_tokens: 12,
    completion_tokens: 4,
    total_tokens: 16,
  },
])

vi.mock('@/lib/auth/account', () => ({
  requireRole: vi.fn(async () => {
    const chain: Record<string, unknown> = {}
    const next = () => chain
    for (const method of ['select', 'eq', 'gte', 'order']) {
      chain[method] = vi.fn(next)
    }
    chain.limit = vi.fn(async () => ({ data: usageRows, error: null }))
    return {
      accountId: 'acct-1',
      supabase: { from: vi.fn(() => chain) },
    }
  }),
  toErrorResponse: vi.fn(() => Response.json({ error: 'failed' }, { status: 500 })),
}))

import { GET } from './route'

describe('GET /api/ai/usage', () => {
  it('includes a recorded Playground call in totals and per-model breakdown', async () => {
    const response = await GET(
      new Request('http://localhost/api/ai/usage?days=30'),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.totals).toEqual({
      calls: 1,
      prompt_tokens: 12,
      completion_tokens: 4,
      total_tokens: 16,
    })
    expect(body.by_model).toEqual([
      {
        provider: 'openai',
        model: 'gpt-test',
        calls: 1,
        tokens: 16,
      },
    ])
    expect(body.by_mode.draft).toEqual({ calls: 1, tokens: 16 })
  })
})
