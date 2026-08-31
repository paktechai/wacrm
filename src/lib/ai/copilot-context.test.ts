import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadCopilotConversationContext } from './copilot-context';

function fakeDb(row: unknown) {
  const filters: Array<[string, unknown]> = [];
  const chain = {
    from: () => chain,
    select: () => chain,
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  };
  return { db: chain as unknown as SupabaseClient, filters };
}

describe('loadCopilotConversationContext', () => {
  it('uses one tenant-filtered query and returns chronological messages', async () => {
    const { db, filters } = fakeDb({
      id: 'conv-1',
      contact_id: 'contact-1',
      messages: [
        { sender_type: 'customer', content_text: 'latest', created_at: '3' },
        { sender_type: 'agent', content_text: 'middle', created_at: '2' },
        { sender_type: 'customer', content_text: 'first', created_at: '1' },
      ],
    });

    const result = await loadCopilotConversationContext(db, 'acct-1', 'conv-1');

    expect(filters).toContainEqual(['account_id', 'acct-1']);
    expect(filters).toContainEqual(['id', 'conv-1']);
    expect(result).toEqual({
      conversation: { id: 'conv-1', contact_id: 'contact-1' },
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'middle' },
        { role: 'user', content: 'latest' },
      ],
    });
  });

  it('returns null without leaking messages for an unknown conversation', async () => {
    const { db } = fakeDb(null);
    await expect(
      loadCopilotConversationContext(db, 'acct-1', 'other-tenant-conv')
    ).resolves.toBeNull();
  });
});
