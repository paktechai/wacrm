import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import {
  requireAccountService,
  requireFeature,
  requireUsageAvailable,
} from '@/lib/billing/entitlements';
import { loadAiConfig } from '@/lib/ai/config';
import { loadCopilotConversationContext } from '@/lib/ai/copilot-context';
import { generateReply } from '@/lib/ai/generate';
import { ServerTiming } from '@/lib/ai/server-timing';
import { logAiUsage } from '@/lib/ai/usage';
import { supabaseAdmin } from '@/lib/ai/admin-client';
import { AiError, type ChatMessage } from '@/lib/ai/types';
import { writeTenantAudit } from '@/lib/audit/tenant';

type CopilotAction =
  'summary' | 'translate' | 'analyze' | 'rewrite' | 'next_action';

function userMessage(content: string): ChatMessage[] {
  return [{ role: 'user', content }];
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[0]);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const timing = new ServerTiming();
  const json = (body: unknown, init?: ResponseInit) =>
    timing.apply(NextResponse.json(body, init));

  try {
    // Parsing the request body does not depend on authentication. Starting both
    // together removes one round trip from every action while all protected DB
    // work remains strictly after requireRole succeeds.
    const [{ supabase, accountId, userId }, body] = await Promise.all([
      timing.measure('auth', () => requireRole('agent')),
      timing.measure('body', () => request.json()),
    ]);
    const action = body?.action as CopilotAction;
    if (
      !['summary', 'translate', 'analyze', 'rewrite', 'next_action'].includes(
        action
      )
    ) {
      return json({ error: 'Unsupported Copilot action' }, { status: 400 });
    }

    const conversationId =
      typeof body?.conversationId === 'string' ? body.conversationId : null;
    const input = typeof body?.input === 'string' ? body.input.trim() : '';
    const targetLanguage =
      typeof body?.targetLanguage === 'string'
        ? body.targetLanguage.trim().slice(0, 80)
        : '';

    // Entitlements, provider configuration, and the tenant-owned conversation
    // are independent reads. The conversation query embeds recent messages, so
    // conversation actions use one DB round trip instead of two sequential ones.
    const [entitlements, config, context] = await Promise.all([
      timing.measure('entitlements', () =>
        requireAccountService(supabase, accountId)
      ),
      timing.measure('config', () => loadAiConfig(supabase, accountId)),
      conversationId
        ? timing.measure('context', () =>
            loadCopilotConversationContext(supabase, accountId, conversationId)
          )
        : Promise.resolve(null),
    ]);

    requireFeature(entitlements, 'ai_assistant');
    await timing.measure('usage', () =>
      requireUsageAvailable(supabase, entitlements, 'ai_requests', 1)
    );

    if (!config) {
      return json(
        {
          error:
            'AI assistant is not configured. Add a provider key in AI Agents → Setup.',
        },
        { status: 400 }
      );
    }

    if (conversationId && !context) {
      return json({ error: 'Conversation not found' }, { status: 404 });
    }

    let systemPrompt = '';
    let messages: ChatMessage[] = context?.messages ?? [];

    switch (action) {
      case 'summary':
        if (!conversationId || messages.length === 0) {
          return json(
            { error: 'A conversation with messages is required' },
            { status: 400 }
          );
        }
        systemPrompt =
          'You are SBYT CRM Copilot. Summarize this customer conversation for a busy human agent. Return concise plain text with: customer need, key facts, decisions/commitments, unresolved items, and recommended next step. Do not invent facts.';
        break;
      case 'translate':
        if (!targetLanguage) {
          return json({ error: 'targetLanguage is required' }, { status: 400 });
        }
        if (!input && messages.length === 0) {
          return json(
            { error: 'Text or a conversation is required' },
            { status: 400 }
          );
        }
        systemPrompt = `You are SBYT CRM Translator. Translate faithfully into ${targetLanguage}. Preserve names, numbers, links and business meaning. Return only the translation.`;
        if (input) messages = userMessage(input);
        break;
      case 'rewrite':
        if (!input)
          return json({ error: 'input is required' }, { status: 400 });
        systemPrompt =
          'You are SBYT CRM Copilot. Rewrite the supplied draft to be clear, concise, professional and natural for customer messaging. Preserve facts and intent. Return only the improved message.';
        messages = userMessage(input);
        break;
      case 'next_action':
        if (!conversationId || messages.length === 0) {
          return json(
            { error: 'A conversation with messages is required' },
            { status: 400 }
          );
        }
        systemPrompt =
          'You are SBYT CRM Copilot. Recommend exactly one practical next action for the human agent based only on the conversation. Keep it under 30 words.';
        break;
      case 'analyze':
        if (!conversationId || messages.length === 0) {
          return json(
            { error: 'A conversation with messages is required' },
            { status: 400 }
          );
        }
        systemPrompt =
          'You are SBYT CRM Conversation Intelligence. Analyze the conversation and return ONLY valid JSON with keys: "sentiment" (positive|neutral|negative|unknown), "intent" (short phrase), "next_action" (short practical action), "lead_score" (integer 0-100). Do not add markdown.';
        break;
    }

    const { text, usage } = await timing.measure('provider', () =>
      generateReply({ config, systemPrompt, messages })
    );

    try {
      const admin = supabaseAdmin();
      void logAiUsage(admin, {
        accountId,
        conversationId,
        mode: 'draft',
        provider: config.provider,
        model: config.model,
        usage,
      });
      void admin.rpc('increment_account_usage', {
        p_account_id: accountId,
        p_metric: 'ai_requests',
        p_quantity: 1,
      });
    } catch (usageError) {
      console.error('[ai/copilot] usage logging skipped', usageError);
    }

    const updates: Record<string, unknown> = {};
    let result: unknown = text;

    if (conversationId && action === 'summary')
      updates.ai_summary = text.slice(0, 4000);
    if (conversationId && action === 'next_action')
      updates.next_action = text.slice(0, 1000);

    if (conversationId && action === 'analyze') {
      const parsed = parseJsonObject(text);
      if (!parsed) {
        return json(
          { error: 'AI returned an invalid analysis payload' },
          { status: 502 }
        );
      }
      const sentiment = ['positive', 'neutral', 'negative', 'unknown'].includes(
        String(parsed.sentiment)
      )
        ? String(parsed.sentiment)
        : 'unknown';
      const intent =
        typeof parsed.intent === 'string' ? parsed.intent.slice(0, 240) : null;
      const nextAction =
        typeof parsed.next_action === 'string'
          ? parsed.next_action.slice(0, 1000)
          : null;
      const rawScore = Number(parsed.lead_score);
      const leadScore = Number.isFinite(rawScore)
        ? Math.max(0, Math.min(100, Math.round(rawScore)))
        : 0;
      updates.customer_sentiment = sentiment;
      updates.detected_intent = intent;
      updates.next_action = nextAction;
      result = {
        sentiment,
        intent,
        next_action: nextAction,
        lead_score: leadScore,
      };
    }

    await timing.measure('persist', async () => {
      const writes: PromiseLike<unknown>[] = [];

      if (
        conversationId &&
        action === 'analyze' &&
        context?.conversation.contact_id
      ) {
        writes.push(
          supabase
            .from('contacts')
            .update({
              lead_score: (result as { lead_score: number }).lead_score,
              last_engaged_at: new Date().toISOString(),
            })
            .eq('id', context.conversation.contact_id)
            .eq('account_id', accountId)
            .then(({ error }) => {
              if (error)
                console.error(
                  '[ai/copilot] contact analysis update failed',
                  error
                );
            })
        );
      }

      if (conversationId && Object.keys(updates).length > 0) {
        writes.push(
          supabase
            .from('conversations')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', conversationId)
            .eq('account_id', accountId)
            .then(({ error }) => {
              if (error) throw error;
            })
        );
      }

      writes.push(
        supabase
          .from('ai_copilot_events')
          .insert({
            account_id: accountId,
            user_id: userId,
            conversation_id: conversationId,
            action,
            output_language: action === 'translate' ? targetLanguage : null,
            metadata: { persisted: Object.keys(updates).length > 0 },
          })
          .then(({ error }) => {
            if (error)
              console.error('[ai/copilot] event logging failed', error);
          })
      );

      await Promise.all(writes);
    });

    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: `ai.copilot.${action}`,
      objectType: conversationId ? 'conversation' : 'copilot',
      objectId: conversationId,
    });

    return json({ action, result, persisted: updates });
  } catch (error) {
    if (error instanceof AiError) {
      return json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    return timing.apply(toErrorResponse(error));
  }
}
