import { supabaseAdmin } from './admin-client'
import { loadAiConfig } from './config'
import { buildConversationContext } from './context'
import { retrieveKnowledge } from './knowledge'
import { generateReply } from './generate'
import { buildSystemPrompt } from './defaults'
import { buildHandoffSummary } from './handoff'
import { logAiUsage } from './usage'
import { latestUserMessage } from './query'
import {
  executeAutonomousAgentActions,
  runAutonomousAgent,
  type PlannedAction,
} from './autonomous-agent'
import { engineSendText } from '@/lib/flows/meta-send'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import {
  requireAccountService,
  requireFeature,
  requireUsageAvailable,
} from '@/lib/billing/entitlements'
import { SBYT_FEATURES, SBYT_METRICS } from '@/lib/billing/catalog'
import { incrementUsageBestEffort } from '@/lib/billing/metering'

interface DispatchArgs {
  accountId: string
  conversationId: string
  contactId: string
  configOwnerUserId: string
}

export async function dispatchInboundToAiReply(
  args: DispatchArgs,
): Promise<void> {
  const { accountId, conversationId, contactId, configOwnerUserId } = args

  try {
    const db = supabaseAdmin()

    // This path runs with service-role privileges and therefore bypasses
    // tenant RLS. Explicit plan/lifecycle checks are mandatory before an
    // LLM or Meta side effect.
    const entitlements = await requireAccountService(db, accountId)
    requireFeature(entitlements, SBYT_FEATURES.aiAssistant)
    requireFeature(entitlements, SBYT_FEATURES.whatsappMessaging)
    await requireUsageAvailable(db, entitlements, SBYT_METRICS.aiRequests, 1)
    await requireUsageAvailable(db, entitlements, SBYT_METRICS.messagesSent, 1)

    const config = await loadAiConfig(db, accountId)
    if (!config || !config.autoReplyEnabled) return

    // Deterministic automations take precedence. Running both an automation
    // responder and an AI responder against the same inbound message would
    // create duplicate customer replies.
    const { data: autoResponders } = await db
      .from('automations')
      .select('id')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .in('trigger_type', ['new_message_received', 'keyword_match'])
      .limit(1)
    if (autoResponders && autoResponders.length > 0) return

    const { data: conv, error: convErr } = await db
      .from('conversations')
      .select('assigned_agent_id, ai_autoreply_disabled, ai_reply_count')
      .eq('id', conversationId)
      .eq('account_id', accountId)
      .maybeSingle()
    if (convErr || !conv) return
    if (conv.assigned_agent_id) return
    if (conv.ai_autoreply_disabled) return
    if ((conv.ai_reply_count ?? 0) >= config.autoReplyMaxPerConversation) return

    const messages = await buildConversationContext(db, conversationId)
    if (messages.length === 0) return

    const acctLimit = checkRateLimit(
      `ai-autoreply:${accountId}`,
      RATE_LIMITS.aiAutoReplyAccount,
    )
    if (!acctLimit.success) {
      console.warn(
        `[ai auto-reply] account ${accountId} hit the per-account rate limit — skipping this inbound.`,
      )
      return
    }

    const knowledge = await retrieveKnowledge(
      db,
      accountId,
      config,
      latestUserMessage(messages),
    )

    // Prefer the configured autonomous SBYT agent. If no active default
    // persona is configured, preserve the proven legacy auto-reply behaviour.
    const autonomous = await runAutonomousAgent({
      db,
      accountId,
      config,
      messages,
      knowledge,
    })

    let text: string
    let handoff: boolean
    let usage = autonomous?.usage ?? null
    let agentId: string | null = autonomous?.agentId ?? null
    let plannedActions: PlannedAction[] = autonomous?.plannedActions ?? []

    if (autonomous) {
      text = autonomous.text
      handoff = autonomous.handoff
    } else {
      const systemPrompt = buildSystemPrompt({
        userPrompt: config.systemPrompt,
        mode: 'auto_reply',
        knowledge,
      })
      const legacy = await generateReply({ config, systemPrompt, messages })
      text = legacy.text
      handoff = legacy.handoff
      usage = legacy.usage
      agentId = null
      plannedActions = []
    }

    // Provider usage happened even when the model requests a handoff.
    await logAiUsage(db, {
      requestId: crypto.randomUUID(),
      accountId,
      conversationId,
      mode: 'auto_reply',
      provider: config.provider,
      model: config.model,
      usage,
    })

    if (handoff || !text) {
      const summary = buildHandoffSummary({
        messages,
        replyCount: conv.ai_reply_count ?? 0,
      })
      const update: Record<string, unknown> = {
        ai_autoreply_disabled: true,
        ai_handoff_summary: summary,
      }
      if (config.handoffAgentId && !conv.assigned_agent_id) {
        update.assigned_agent_id = config.handoffAgentId
      }
      await db
        .from('conversations')
        .update(update)
        .eq('id', conversationId)
        .eq('account_id', accountId)

      if (agentId) {
        await db.from('ai_copilot_events').insert({
          account_id: accountId,
          user_id: configOwnerUserId,
          conversation_id: conversationId,
          agent_profile_id: agentId,
          action: 'agent_run',
          metadata: { handoff: true, actions_executed: [] },
        })
      }
      return
    }

    // Atomically claim the reply slot before any customer-visible send or CRM
    // tool side effect. Concurrent webhook deliveries may both generate, but
    // only one is allowed to send and execute the action plan.
    const { data: claimed, error: claimErr } = await db.rpc(
      'claim_ai_reply_slot',
      {
        conversation_id: conversationId,
        max_replies: config.autoReplyMaxPerConversation,
      },
    )
    if (claimErr) {
      console.error('[ai auto-reply] claim_ai_reply_slot failed:', claimErr)
      return
    }
    if (claimed !== true) return

    await engineSendText({
      accountId,
      userId: configOwnerUserId,
      conversationId,
      contactId,
      text,
      aiGenerated: true,
    })

    let actionsExecuted: string[] = []
    if (agentId && plannedActions.length > 0) {
      actionsExecuted = await executeAutonomousAgentActions({
        db,
        accountId,
        conversationId,
        contactId,
        configOwnerUserId,
        agentId,
        actions: plannedActions,
      })
    }

    if (agentId) {
      await db.from('ai_copilot_events').insert({
        account_id: accountId,
        user_id: configOwnerUserId,
        conversation_id: conversationId,
        agent_profile_id: agentId,
        action: 'agent_run',
        metadata: { handoff: false, actions_executed: actionsExecuted },
      })
    }

    incrementUsageBestEffort(accountId, SBYT_METRICS.messagesSent, 1)
  } catch (err) {
    console.error('[ai auto-reply] dispatch failed:', err)
  }
}
