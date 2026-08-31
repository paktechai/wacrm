import type { SupabaseClient } from '@supabase/supabase-js';
import { aiContextMessageLimit } from './defaults';
import type { ChatMessage } from './types';

type ConversationMessage = {
  sender_type: 'customer' | 'agent' | 'bot';
  content_text: string | null;
  created_at: string;
};

type CopilotConversationRow = {
  id: string;
  contact_id: string | null;
  messages: ConversationMessage[] | null;
};

export type CopilotConversationContext = {
  conversation: { id: string; contact_id: string | null };
  messages: ChatMessage[];
};

/**
 * Loads the tenant-owned conversation and its recent text messages in one
 * PostgREST request. The account predicate remains explicit in addition to
 * RLS, so reducing round trips does not weaken tenant isolation.
 */
export async function loadCopilotConversationContext(
  db: SupabaseClient,
  accountId: string,
  conversationId: string,
  limit: number = aiContextMessageLimit()
): Promise<CopilotConversationContext | null> {
  const { data, error } = await db
    .from('conversations')
    .select('id, contact_id, messages(sender_type, content_text, created_at)')
    .eq('id', conversationId)
    .eq('account_id', accountId)
    .eq('messages.content_type', 'text')
    .order('created_at', { ascending: false, referencedTable: 'messages' })
    .limit(limit, { referencedTable: 'messages' })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as CopilotConversationRow;
  const messages = [...(row.messages ?? [])]
    .reverse()
    .filter((message) => message.content_text?.trim())
    .map<ChatMessage>((message) => ({
      role: message.sender_type === 'customer' ? 'user' : 'assistant',
      content: message.content_text!.trim(),
    }));

  return {
    conversation: { id: row.id, contact_id: row.contact_id },
    messages,
  };
}
