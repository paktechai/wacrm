import { after, NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { loadAiConfig } from '@/lib/ai/config'
import { buildConversationContext } from '@/lib/ai/context'
import { buildRelationshipContext } from '@/lib/ai/relationship-context'
import { retrieveKnowledge } from '@/lib/ai/knowledge'
import { generateReply } from '@/lib/ai/generate'
import { buildSystemPrompt } from '@/lib/ai/defaults'
import { latestUserMessage } from '@/lib/ai/query'
import { logAiUsage } from '@/lib/ai/usage'
import { recordAiDecisionTrace } from '@/lib/ai/decision-trace'
import { supabaseAdmin } from '@/lib/ai/admin-client'
import { AiError } from '@/lib/ai/types'
import {
  requireAccountService,
  requireFeature,
  requireUsageAvailable,
} from '@/lib/billing/entitlements'
import { WOVA8_FEATURES, WOVA8_METRICS } from '@/lib/billing/catalog'

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent')

    const entitlements = await requireAccountService(supabase, accountId)
    requireFeature(entitlements, WOVA8_FEATURES.aiAssistant)
    await requireUsageAvailable(
      supabase,
      entitlements,
      WOVA8_METRICS.aiRequests,
      1,
    )

    const userLimit = checkRateLimit(`ai-draft:${userId}`, RATE_LIMITS.aiDraft)
    if (!userLimit.success) return rateLimitResponse(userLimit)
    const accountLimit = checkRateLimit(
      `ai-draft-acct:${accountId}`,
      RATE_LIMITS.aiDraftAccount,
    )
    if (!accountLimit.success) return rateLimitResponse(accountLimit)

    const body = await request.json().catch(() => null)
    const conversationId =
      body && typeof body.conversation_id === 'string' ? body.conversation_id : ''
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversation_id is required' },
        { status: 400 },
      )
    }

    // RLS scopes the SSR client to the caller's account, so a missing
    // row means "not yours / not found" either way. We also retain the
    // contact id so the model can receive bounded relationship context.
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('id, contact_id')
      .eq('id', conversationId)
      .maybeSingle()
    if (convErr) {
      console.error('[ai/draft] conversation lookup error:', convErr)
      return NextResponse.json({ error: 'Failed to load conversation' }, { status: 500 })
    }
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const config = await loadAiConfig(supabase, accountId).catch((err) => {
      console.error('[ai/draft] loadAiConfig error:', err)
      throw new AiError('Stored API key could not be decrypted.', {
        code: 'key_decrypt_failed',
        status: 400,
      })
    })
    if (!config) {
      return NextResponse.json(
        {
          error: 'AI assistant is not set up. Enable it in Settings → AI Assistant.',
          code: 'ai_not_configured',
        },
        { status: 400 },
      )
    }

    const messages = await buildConversationContext(supabase, conversationId)
    if (messages.length === 0) {
      return NextResponse.json(
        {
          error: 'No messages to draft from yet.',
          code: 'no_messages',
        },
        { status: 400 },
      )
    }

    // Knowledge retrieval and CRM-context lookup are independent, so run
    // them in parallel. Both are best-effort grounding layers.
    const [knowledge, relationshipContext] = await Promise.all([
      retrieveKnowledge(
        supabase,
        accountId,
        config,
        latestUserMessage(messages),
      ),
      buildRelationshipContext(supabase, conversation.contact_id),
    ])

    const systemPrompt = buildSystemPrompt({
      userPrompt: config.systemPrompt,
      mode: 'draft',
      knowledge,
      relationshipContext,
    })

    const { text, usage } = await generateReply({ config, systemPrompt, messages })
    const requestId = crypto.randomUUID()

    try {
      const admin = supabaseAdmin()
      after(async () => {
        await Promise.all([
          logAiUsage(admin, {
            requestId,
            accountId,
            conversationId,
            mode: 'draft',
            provider: config.provider,
            model: config.model,
            usage,
          }),
          recordAiDecisionTrace(admin, {
            accountId,
            contactId: conversation.contact_id,
            conversationId,
            operation: 'draft',
            outcome: 'draft_generated',
            decisionSummary:
              'Generated an agent-review draft using bounded conversation context, optional durable relationship context and approved knowledge when available.',
            conversationContextUsed: messages.length > 0,
            relationshipContextUsed: Boolean(relationshipContext),
            approvedKnowledgeUsed: knowledge.length > 0,
            policyChecks: [
              { name: 'authenticated_agent', result: 'pass' },
              { name: 'account_ai_entitlement', result: 'pass' },
              { name: 'human_review_before_send', result: 'pass' },
            ],
            modelProvider: config.provider,
            modelName: config.model,
            correlationId: requestId,
            createdBy: userId,
          }),
        ])
      })
    } catch (logErr) {
      console.error('[ai/draft] post-response logging skipped:', logErr)
    }

    return NextResponse.json({ draft: text })
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      )
    }
    return toErrorResponse(err)
  }
}
