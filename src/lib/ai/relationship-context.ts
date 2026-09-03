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
  memories?: Array<{
    type?: string | null
    summary: string
    confidence?: number | null
    observedAt?: string | null
  }>
  commitments?: Array<{
    title: string
    direction?: string | null
    dueAt?: string | null
    confidence?: number | null
  }>
  signals?: Array<{
    type?: string | null
    summary: string
    severity?: string | null
    confidence?: number | null
  }>
}

const MAX_NOTE_CHARS = 500
const MAX_TAGS = 12
const MAX_DEALS = 5
const MAX_NOTES = 3
const MAX_MEMORIES = 5
const MAX_COMMITMENTS = 4
const MAX_SIGNALS = 4

function confidenceLabel(confidence?: number | null): string {
  if (confidence == null || confidence >= 0.95) return ''
  return ` · confidence ${Math.round(confidence * 100)}%`
}

/**
 * Turns CRM relationship data into a compact, provider-neutral reference
 * block. This is deliberately bounded: the AI needs useful continuity, not a
 * dump of the entire CRM record.
 *
 * Everything in this block is internal reference data. The system prompt is
 * responsible for preventing internal labels, notes, signals and provenance
 * from being exposed verbatim to a customer.
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
    lines.push('Related opportunities:')
    for (const deal of deals) {
      const meta = [
        deal.stage,
        deal.status,
        deal.expectedCloseDate ? `expected ${deal.expectedCloseDate}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      lines.push(`- ${deal.title}${meta ? ` (${meta})` : ''}`)
    }
  }

  const memories = (data.memories ?? [])
    .filter((memory) => memory.summary.trim())
    .slice(0, MAX_MEMORIES)
  if (memories.length > 0) {
    lines.push('Durable relationship memory (internal):')
    for (const memory of memories) {
      const type = memory.type ? `${memory.type}: ` : ''
      const date = memory.observedAt ? ` · observed ${memory.observedAt.slice(0, 10)}` : ''
      lines.push(
        `- ${type}${memory.summary.replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE_CHARS)}${date}${confidenceLabel(memory.confidence)}`,
      )
    }
  }

  const commitments = (data.commitments ?? [])
    .filter((commitment) => commitment.title.trim())
    .slice(0, MAX_COMMITMENTS)
  if (commitments.length > 0) {
    lines.push('Open commitments / promises (internal):')
    for (const commitment of commitments) {
      const meta = [
        commitment.direction,
        commitment.dueAt ? `due ${commitment.dueAt.slice(0, 10)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      lines.push(
        `- ${commitment.title}${meta ? ` (${meta}${confidenceLabel(commitment.confidence)})` : confidenceLabel(commitment.confidence)}`,
      )
    }
  }

  const signals = (data.signals ?? [])
    .filter((signal) => signal.summary.trim())
    .slice(0, MAX_SIGNALS)
  if (signals.length > 0) {
    lines.push('Active relationship signals (internal):')
    for (const signal of signals) {
      const meta = [signal.type, signal.severity].filter(Boolean).join(' · ')
      lines.push(
        `- ${signal.summary.replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE_CHARS)}${meta ? ` (${meta}${confidenceLabel(signal.confidence)})` : confidenceLabel(signal.confidence)}`,
      )
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
 * Errors are best-effort: a temporary CRM-context failure — including a
 * partially rolled-out Relationship OS migration — must never break the inbox
 * draft button or automatic reply path.
 */
export async function buildRelationshipContext(
  db: SupabaseClient,
  contactId: string,
): Promise<string | null> {
  try {
    const [
      contactRes,
      tagsRes,
      dealsRes,
      notesRes,
      memoriesRes,
      commitmentsRes,
      signalsRes,
    ] = await Promise.all([
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
      db
        .from('relationship_memory_entries')
        .select('memory_type, summary, confidence, observed_at')
        .eq('contact_id', contactId)
        .eq('state', 'active')
        .order('observed_at', { ascending: false })
        .limit(MAX_MEMORIES),
      db
        .from('relationship_commitments')
        .select('title, commitment_direction, due_at, confidence')
        .eq('contact_id', contactId)
        .eq('status', 'open')
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(MAX_COMMITMENTS),
      db
        .from('relationship_signals')
        .select('signal_type, summary, severity, confidence')
        .eq('contact_id', contactId)
        .eq('status', 'active')
        .order('observed_at', { ascending: false })
        .limit(MAX_SIGNALS),
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

    const memoryRows = memoriesRes.error
      ? []
      : ((memoriesRes.data ?? []) as unknown as Array<{
          memory_type?: string | null
          summary: string
          confidence?: number | null
          observed_at?: string | null
        }>)
    const memories = memoryRows.map((memory) => ({
      type: memory.memory_type,
      summary: memory.summary,
      confidence: memory.confidence,
      observedAt: memory.observed_at,
    }))

    const commitmentRows = commitmentsRes.error
      ? []
      : ((commitmentsRes.data ?? []) as unknown as Array<{
          title: string
          commitment_direction?: string | null
          due_at?: string | null
          confidence?: number | null
        }>)
    const commitments = commitmentRows.map((commitment) => ({
      title: commitment.title,
      direction: commitment.commitment_direction,
      dueAt: commitment.due_at,
      confidence: commitment.confidence,
    }))

    const signalRows = signalsRes.error
      ? []
      : ((signalsRes.data ?? []) as unknown as Array<{
          signal_type?: string | null
          summary: string
          severity?: string | null
          confidence?: number | null
        }>)
    const signals = signalRows.map((signal) => ({
      type: signal.signal_type,
      summary: signal.summary,
      severity: signal.severity,
      confidence: signal.confidence,
    }))

    return formatRelationshipContext({
      name: contact?.name,
      company: contact?.company,
      tags,
      deals,
      notes,
      memories,
      commitments,
      signals,
    })
  } catch (err) {
    console.error('[ai relationship context] failed:', err)
    return null
  }
}
