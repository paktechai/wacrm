import type { SupabaseClient } from '@supabase/supabase-js'

type TraceOperation =
  | 'draft'
  | 'auto_reply'
  | 'next_best_action'
  | 'signal_detection'
  | 'memory_extraction'
  | 'commitment_detection'
  | 'routing'
  | 'summary'
  | 'automation'
  | 'other'

interface RecordAiDecisionTraceInput {
  accountId: string
  contactId?: string | null
  conversationId?: string | null
  operation: TraceOperation
  outcome: string
  decisionSummary: string
  confidence?: number | null
  conversationContextUsed?: boolean
  relationshipContextUsed?: boolean
  approvedKnowledgeUsed?: boolean
  policyChecks?: Array<{
    name: string
    result: 'pass' | 'review' | 'block' | 'not_applicable'
  }>
  modelProvider?: string | null
  modelName?: string | null
  correlationId?: string | null
  createdBy?: string | null
}

/**
 * Best-effort explainability ledger for AI/system decisions.
 *
 * Important: callers pass only booleans/references and a bounded summary.
 * Never put API keys, credentials, raw system prompts or full customer message
 * bodies in this trace. A tracing failure must never fail a customer action.
 */
export async function recordAiDecisionTrace(
  db: SupabaseClient,
  input: RecordAiDecisionTraceInput,
): Promise<void> {
  try {
    const contextSources: Array<Record<string, unknown>> = []
    if (input.conversationContextUsed) {
      contextSources.push({ source: 'conversation_history', used: true })
    }
    if (input.relationshipContextUsed) {
      contextSources.push({ source: 'relationship_context', used: true })
    }
    if (input.approvedKnowledgeUsed) {
      contextSources.push({ source: 'approved_knowledge', used: true })
    }

    const { error } = await db.from('ai_decision_traces').insert({
      account_id: input.accountId,
      contact_id: input.contactId ?? null,
      conversation_id: input.conversationId ?? null,
      operation: input.operation,
      outcome: input.outcome.slice(0, 200),
      decision_summary: input.decisionSummary.slice(0, 3000),
      confidence: input.confidence ?? null,
      context_sources: contextSources,
      knowledge_refs: input.approvedKnowledgeUsed
        ? [{ source: 'approved_knowledge', used: true }]
        : [],
      policy_checks: input.policyChecks ?? [],
      model_provider: input.modelProvider ?? null,
      model_name: input.modelName ?? null,
      correlation_id: input.correlationId ?? null,
      created_by: input.createdBy ?? null,
    })

    if (error) {
      // This also makes mixed-version deployments safe while the migration is
      // rolling out: no tracing table must never become a messaging outage.
      console.warn('[ai decision trace] insert skipped:', error.message)
    }
  } catch (err) {
    console.warn('[ai decision trace] recording skipped:', err)
  }
}
