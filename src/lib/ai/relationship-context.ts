import type { SupabaseClient } from '@supabase/supabase-js'

interface RelationshipContextData {
  name?: string | null
  company?: string | null
  tags: string[]
  deals: Array<{
    title: string
    status?: string | null
    stage?: string | null
    expectedCloseDate?: string | null
  }>
  notes: Array<{
    text: string
    createdAt?: string | null
  }>
}

const MAX_NOTE_CHARS = 500
const MAX_TAGS = 12
const MAX_DEALS = 5
const MAX_NOTES = 3

/**
 * Turns CRM relationship data into a compact, provider-neutral reference
 * block. This is deliberately bounded: the AI needs useful continuity, not a
 * dump of the entire CRM record.
 */
export function formatRelationshipContext(
  data: RelationshipContextData,
): string | null {
  const lines: string[] = []

  if (data.name?.trim()) lines.push(`Name: ${data.name.trim()}`)
  if (data.company?.trim()) lines.push(`Organization: ${data.company.trim()}`)

  const tags = data.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, MAX_TAGS)
  if (tags.length > 0) lines.push(`Relationship tags: ${tags.join(', ')}`)

  const deals = data.deals.slice(0, MAX_DEALS)
  if (deals.length > 0) {
    lines.push('Related opportunities / commitments:')
    for (const deal of deals) {
      const meta = [deal.stage, deal.status, deal.expectedCloseDate ? `expected ${deal.expectedCloseDate}` : null]
        .filter(Boolean)
        .join(' · ')
      lines.push(`- ${deal.title}${meta ? ` (${meta})` : ''}`)
    }
  }

  const notes = data.notes
    .filter((note) => note.text.trim())
    .slice(0, MAX_NOTES)
  if (notes.length > 0) {
    lines.push('Recent internal relationship notes:')
    for (const note of notes) {
      const compact = note.text.replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE_CHARS)
      const date = note.createdAt ? ` (${note.createdAt.slice(0, 10)})` : ''
      lines.push(`- ${compact}${date}`)
    }
  }

  return lines.length > 0 ? lines.join('\n') : null
}

/**
 * Fetch the smallest useful relationship snapshot for an AI draft/auto-reply.
 * Errors are best-effort: a temporary CRM-context failure must never break the
 * inbox draft button or automatic reply path.
 */
export async function buildRelationshipContext(
  db: SupabaseClient,
  contactId: string,
): Promise<string | null> {
  try {
    const [contactRes, tagsRes, dealsRes, notesRes] = await Promise.all([
      db
        .from('contacts')
        .select('name, company')
        .eq('id', contactId)
        .maybeSingle(),
      db
        .from('contact_tags')
        .select('tags(name)')
        .eq('contact_id', contactId),
      db
        .from('deals')
        .select('title, status, expected_close_date, stage:pipeline_stages(name)')
        .eq('contact_id', contactId)
        .order('updated_at', { ascending: false })
        .limit(MAX_DEALS),
      db
        .from('contact_notes')
        .select('note_text, created_at')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(MAX_NOTES),
    ])

    if (contactRes.error) return null

    const contact = contactRes.data as
      | { name?: string | null; company?: string | null }
      | null

    const tagRows = (tagsRes.data ?? []) as unknown as Array<{
      tags?: { name?: string | null } | Array<{ name?: string | null }> | null
    }>
    const tags = tagRows.flatMap((row) => {
      if (Array.isArray(row.tags)) {
        return row.tags.map((tag) => tag.name).filter((name): name is string => !!name)
      }
      return row.tags?.name ? [row.tags.name] : []
    })

    const dealRows = (dealsRes.data ?? []) as unknown as Array<{
      title: string
      status?: string | null
      expected_close_date?: string | null
      stage?: { name?: string | null } | Array<{ name?: string | null }> | null
    }>
    const deals = dealRows
      .filter((deal) => deal.status !== 'lost')
      .map((deal) => ({
        title: deal.title,
        status: deal.status,
        stage: Array.isArray(deal.stage) ? deal.stage[0]?.name : deal.stage?.name,
        expectedCloseDate: deal.expected_close_date,
      }))

    const noteRows = (notesRes.data ?? []) as unknown as Array<{
      note_text?: string | null
      created_at?: string | null
    }>
    const notes = noteRows
      .filter((note) => !!note.note_text)
      .map((note) => ({
        text: note.note_text as string,
        createdAt: note.created_at,
      }))

    return formatRelationshipContext({
      name: contact?.name,
      company: contact?.company,
      tags,
      deals,
      notes,
    })
  } catch (err) {
    console.error('[ai relationship context] failed:', err)
    return null
  }
}
