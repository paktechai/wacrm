import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AiConfig } from './types'

// Shared, hoisted mock state so the module mocks can close over it.
const h = vi.hoisted(() => ({
  loadAiConfig: vi.fn(),
  buildConversationContext: vi.fn(),
  retrieveKnowledge: vi.fn(),
  generateReply: vi.fn(),
  engineSendText: vi.fn(),
  requireAccountService: vi.fn(),
  requireFeature: vi.fn(),
  requireUsageAvailable: vi.fn(),
  incrementUsageBestEffort: vi.fn(),
  runAutonomousAgent: vi.fn(),
  executeAutonomousAgentActions: vi.fn(),
  state: {
    conv: null as Record<string, unknown> | null,
    autoResponders: [] as { id: string }[],
    claim: true as boolean,
    updatePayload: null as Record<string, unknown> | null,
    rpcCalls: [] as { name: string; args: unknown }[],
    copilotEvents: [] as Record<string, unknown>[],
  },
}))

vi.mock('./config', () => ({ loadAiConfig: h.loadAiConfig }))
vi.mock('./context', () => ({ buildConversationContext: h.buildConversationContext }))
vi.mock('./knowledge', () => ({ retrieveKnowledge: h.retrieveKnowledge }))
vi.mock('./generate', () => ({ generateReply: h.generateReply }))
vi.mock('@/lib/flows/meta-send', () => ({ engineSendText: h.engineSendText }))
vi.mock('@/lib/billing/entitlements', () => ({
  requireAccountService: h.requireAccountService,
  requireFeature: h.requireFeature,
  requireUsageAvailable: h.requireUsageAvailable,
}))
vi.mock('@/lib/billing/metering', () => ({
  incrementUsageBestEffort: h.incrementUsageBestEffort,
}))
vi.mock('./autonomous-agent', () => ({
  runAutonomousAgent: h.runAutonomousAgent,
  executeAutonomousAgentActions: h.executeAutonomousAgentActions,
}))
vi.mock('./admin-client', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'automations') {
        // .select().eq().eq().in().limit() → active auto-responders
        const chain = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          limit: () =>
            Promise.resolve({ data: h.state.autoResponders, error: null }),
        }
        return chain
      }

      if (table === 'ai_copilot_events') {
        return {
          insert: (payload: Record<string, unknown>) => {
            h.state.copilotEvents.push(payload)
            return Promise.resolve({ data: null, error: null })
          },
        }
      }

      // conversations
      const selectChain = {
        eq: () => selectChain,
        maybeSingle: () =>
          Promise.resolve({ data: h.state.conv, error: null }),
      }
      return {
        select: () => selectChain,
        update: (payload: Record<string, unknown>) => {
          h.state.updatePayload = payload
          let eqCount = 0
          const updateChain = {
            eq: () => {
              eqCount += 1
              return eqCount >= 2
                ? Promise.resolve({ error: null })
                : updateChain
            },
          }
          return updateChain
        },
      }
    },
    rpc: (name: string, args: unknown) => {
      h.state.rpcCalls.push({ name, args })
      return Promise.resolve({ data: h.state.claim, error: null })
    },
  }),
}))

import { dispatchInboundToAiReply } from './auto-reply'

const ARGS = {
  accountId: 'acct-1',
  conversationId: 'conv-1',
  contactId: 'contact-1',
  configOwnerUserId: 'user-1',
}

function aiConfig(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    provider: 'openai',
    model: 'gpt-test',
    apiKey: 'sk-test',
    systemPrompt: null,
    isActive: true,
    autoReplyEnabled: true,
    autoReplyMaxPerConversation: 3,
    handoffAgentId: null,
    embeddingsApiKey: null,
    defaultAgentId: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.state.conv = {
    assigned_agent_id: null,
    ai_autoreply_disabled: false,
    ai_reply_count: 0,
  }
  h.state.autoResponders = []
  h.state.claim = true
  h.state.updatePayload = null
  h.state.rpcCalls = []
  h.state.copilotEvents = []
  h.requireAccountService.mockResolvedValue({})
  h.requireFeature.mockReturnValue(undefined)
  h.requireUsageAvailable.mockResolvedValue(undefined)
  h.loadAiConfig.mockResolvedValue(aiConfig())
  h.buildConversationContext.mockResolvedValue([{ role: 'user', content: 'hi' }])
  h.retrieveKnowledge.mockResolvedValue([])
  h.runAutonomousAgent.mockResolvedValue(null)
  h.executeAutonomousAgentActions.mockResolvedValue([])
  h.generateReply.mockResolvedValue({ text: 'Hello!', handoff: false, usage: null })
  h.engineSendText.mockResolvedValue({ whatsapp_message_id: 'm1' })
})

describe('dispatchInboundToAiReply — eligibility gates', () => {
  it('checks account service entitlements before customer-visible side effects', async () => {
    await dispatchInboundToAiReply(ARGS)
    expect(h.requireAccountService).toHaveBeenCalled()
    expect(h.requireFeature).toHaveBeenCalledTimes(2)
    expect(h.requireUsageAvailable).toHaveBeenCalledTimes(2)
  })

  it('claims a slot and sends on the happy path', async () => {
    await dispatchInboundToAiReply(ARGS)
    expect(h.state.rpcCalls).toEqual([
      {
        name: 'claim_ai_reply_slot',
        args: { conversation_id: 'conv-1', max_replies: 3 },
      },
    ])
    expect(h.engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1', text: 'Hello!' }),
    )
  })

  it('grounds the legacy fallback reply in retrieved knowledge', async () => {
    h.retrieveKnowledge.mockResolvedValue(['Returns accepted within 30 days.'])
    await dispatchInboundToAiReply(ARGS)
    expect(h.retrieveKnowledge).toHaveBeenCalled()
    const systemPrompt = h.generateReply.mock.calls[0][0].systemPrompt as string
    expect(systemPrompt).toContain('Returns accepted within 30 days.')
  })

  it('uses the autonomous default agent and executes tools only after send', async () => {
    const actions = [{ type: 'update_lead', lead_score: 80 }]
    h.runAutonomousAgent.mockResolvedValue({
      text: 'Agent hello',
      handoff: false,
      usage: null,
      agentId: 'agent-profile-1',
      plannedActions: actions,
    })
    h.executeAutonomousAgentActions.mockResolvedValue(['update_lead'])

    await dispatchInboundToAiReply(ARGS)

    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Agent hello' }),
    )
    expect(h.executeAutonomousAgentActions).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acct-1',
        conversationId: 'conv-1',
        contactId: 'contact-1',
        agentId: 'agent-profile-1',
        actions,
      }),
    )
    expect(h.engineSendText.mock.invocationCallOrder[0]).toBeLessThan(
      h.executeAutonomousAgentActions.mock.invocationCallOrder[0],
    )
    expect(h.state.copilotEvents[0]).toMatchObject({
      action: 'agent_run',
      agent_profile_id: 'agent-profile-1',
    })
  })

  it('stands down when an active message-level automation exists', async () => {
    h.state.autoResponders = [{ id: 'auto-1' }]
    await dispatchInboundToAiReply(ARGS)
    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.runAutonomousAgent).not.toHaveBeenCalled()
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('does not send or execute agent tools when the atomic slot claim loses the race', async () => {
    h.state.claim = false
    h.runAutonomousAgent.mockResolvedValue({
      text: 'Agent hello',
      handoff: false,
      usage: null,
      agentId: 'agent-profile-1',
      plannedActions: [{ type: 'create_task', title: 'Follow up' }],
    })
    await dispatchInboundToAiReply(ARGS)
    expect(h.state.rpcCalls).toHaveLength(1)
    expect(h.engineSendText).not.toHaveBeenCalled()
    expect(h.executeAutonomousAgentActions).not.toHaveBeenCalled()
  })

  it('skips when AI is off / not configured', async () => {
    h.loadAiConfig.mockResolvedValue(null)
    await dispatchInboundToAiReply(ARGS)
    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when auto-reply is disabled for the account', async () => {
    h.loadAiConfig.mockResolvedValue(aiConfig({ autoReplyEnabled: false }))
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when a human agent is assigned', async () => {
    h.state.conv = {
      assigned_agent_id: 'agent-9',
      ai_autoreply_disabled: false,
      ai_reply_count: 0,
    }
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when auto-reply was disabled on this conversation', async () => {
    h.state.conv = {
      assigned_agent_id: null,
      ai_autoreply_disabled: true,
      ai_reply_count: 0,
    }
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when the per-conversation cap is reached', async () => {
    h.state.conv = {
      assigned_agent_id: null,
      ai_autoreply_disabled: false,
      ai_reply_count: 3,
    }
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
  })

  it('skips when there is nothing to reply to', async () => {
    h.buildConversationContext.mockResolvedValue([])
    await dispatchInboundToAiReply(ARGS)
    expect(h.generateReply).not.toHaveBeenCalled()
    expect(h.engineSendText).not.toHaveBeenCalled()
  })
})

describe('dispatchInboundToAiReply — handoff', () => {
  it('disables auto-reply, writes a summary, and does not send on handoff', async () => {
    h.generateReply.mockResolvedValue({ text: '', handoff: true, usage: null })
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
    expect(h.state.rpcCalls).toHaveLength(0)
    expect(h.state.updatePayload).toMatchObject({ ai_autoreply_disabled: true })
    expect(h.state.updatePayload?.ai_handoff_summary).toContain(
      'AI agent handed off',
    )
    expect(h.state.updatePayload).not.toHaveProperty('assigned_agent_id')
  })

  it('routes to the configured handoff agent on handoff', async () => {
    h.loadAiConfig.mockResolvedValue(aiConfig({ handoffAgentId: 'agent-7' }))
    h.generateReply.mockResolvedValue({ text: '', handoff: true, usage: null })
    await dispatchInboundToAiReply(ARGS)
    expect(h.state.updatePayload).toMatchObject({
      ai_autoreply_disabled: true,
      assigned_agent_id: 'agent-7',
    })
  })

  it('does not execute autonomous CRM tools on agent handoff', async () => {
    h.runAutonomousAgent.mockResolvedValue({
      text: '',
      handoff: true,
      usage: null,
      agentId: 'agent-profile-1',
      plannedActions: [{ type: 'create_task', title: 'Should not run' }],
    })
    await dispatchInboundToAiReply(ARGS)
    expect(h.engineSendText).not.toHaveBeenCalled()
    expect(h.executeAutonomousAgentActions).not.toHaveBeenCalled()
  })
})
