import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  generateReply: vi.fn(),
  logAiUsage: vi.fn(),
}))

vi.mock('@/lib/auth/account', () => ({
  requireRole: vi.fn(async () => ({
    supabase: {},
    accountId: 'acct-1',
    userId: 'user-1',
  })),
  toErrorResponse: vi.fn(() => Response.json({ error: 'failed' }, { status: 500 })),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ success: true })),
  rateLimitResponse: vi.fn(),
  RATE_LIMITS: { aiDraft: {} },
}))

vi.mock('@/lib/ai/config', () => ({
  loadAiConfig: vi.fn(async () => ({
    provider: 'openai',
    model: 'gpt-test',
    systemPrompt: 'Be helpful',
  })),
}))

vi.mock('@/lib/ai/knowledge', () => ({
  retrieveKnowledge: vi.fn(async () => []),
}))

vi.mock('@/lib/ai/generate', () => ({
  generateReply: mocks.generateReply,
}))

vi.mock('@/lib/ai/usage', () => ({
  logAiUsage: mocks.logAiUsage,
}))

vi.mock('@/lib/ai/admin-client', () => ({
  supabaseAdmin: vi.fn(() => ({ serviceRole: true })),
}))

import { POST } from './route'

const REQUEST_ID = '11111111-1111-4111-8111-111111111111'

function playgroundRequest(requestId = REQUEST_ID) {
  return new Request('http://localhost/api/ai/playground', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId,
      messages: [{ role: 'user', content: 'Hello' }],
    }),
  })
}

describe('POST /api/ai/playground usage accounting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.generateReply.mockResolvedValue({
      text: 'Hi there',
      handoff: false,
      usage: { promptTokens: 12, completionTokens: 4, totalTokens: 16 },
    })
    mocks.logAiUsage.mockResolvedValue(true)
  })

  it('records one successful Playground provider call exactly once', async () => {
    const response = await POST(playgroundRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      reply: 'Hi there',
      handoff: false,
    })
    expect(mocks.generateReply).toHaveBeenCalledOnce()
    expect(mocks.logAiUsage).toHaveBeenCalledOnce()
    expect(mocks.logAiUsage).toHaveBeenCalledWith(
      { serviceRole: true },
      {
        requestId: REQUEST_ID,
        accountId: 'acct-1',
        conversationId: null,
        mode: 'draft',
        provider: 'openai',
        model: 'gpt-test',
        usage: { promptTokens: 12, completionTokens: 4, totalTokens: 16 },
      },
    )
  })

  it('rejects an invalid idempotency key before the provider call', async () => {
    const response = await POST(playgroundRequest('not-a-uuid'))

    expect(response.status).toBe(400)
    expect(mocks.generateReply).not.toHaveBeenCalled()
    expect(mocks.logAiUsage).not.toHaveBeenCalled()
  })
})
