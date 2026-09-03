import { describe, expect, it } from 'vitest'
import { formatRelationshipContext } from './relationship-context'

describe('formatRelationshipContext', () => {
  it('returns null when no useful relationship context exists', () => {
    expect(
      formatRelationshipContext({
        tags: [],
        deals: [],
        notes: [],
      }),
    ).toBeNull()
  })

  it('formats identity, tags, opportunities and internal notes compactly', () => {
    const output = formatRelationshipContext({
      name: 'Aisha Khan',
      company: 'Example Foundation',
      tags: ['Sponsor', 'High intent'],
      deals: [
        {
          title: 'Annual sponsorship renewal',
          status: 'open',
          stage: 'Renewal',
          expectedCloseDate: '2026-09-15',
        },
      ],
      notes: [
        {
          text: 'Prefers a concise WhatsApp follow-up after a call.',
          createdAt: '2026-08-30T10:00:00.000Z',
        },
      ],
    })

    expect(output).toContain('Name: Aisha Khan')
    expect(output).toContain('Organization: Example Foundation')
    expect(output).toContain('Relationship tags: Sponsor, High intent')
    expect(output).toContain('Annual sponsorship renewal')
    expect(output).toContain('Renewal · open · expected 2026-09-15')
    expect(output).toContain('Recent internal relationship notes:')
    expect(output).toContain('Prefers a concise WhatsApp follow-up after a call.')
  })

  it('includes durable memory, commitments and active signals with provenance-friendly confidence', () => {
    const output = formatRelationshipContext({
      tags: [],
      deals: [],
      notes: [],
      memories: [
        {
          type: 'preference',
          summary: 'Prefers a call before a written proposal.',
          confidence: 0.82,
          observedAt: '2026-08-25T12:00:00.000Z',
        },
      ],
      commitments: [
        {
          title: 'Send revised proposal',
          direction: 'our_commitment',
          dueAt: '2026-09-03T09:00:00.000Z',
          confidence: 0.9,
        },
      ],
      signals: [
        {
          type: 'relationship_decay',
          summary: 'Engagement has dropped despite an open opportunity.',
          severity: 'high',
          confidence: 0.77,
        },
      ],
    })

    expect(output).toContain('Durable relationship memory (internal):')
    expect(output).toContain('preference: Prefers a call before a written proposal.')
    expect(output).toContain('observed 2026-08-25')
    expect(output).toContain('confidence 82%')
    expect(output).toContain('Open commitments / promises (internal):')
    expect(output).toContain('Send revised proposal')
    expect(output).toContain('due 2026-09-03')
    expect(output).toContain('Active relationship signals (internal):')
    expect(output).toContain('relationship_decay · high')
  })

  it('bounds oversized relationship context collections', () => {
    const output = formatRelationshipContext({
      tags: Array.from({ length: 20 }, (_, index) => `tag-${index + 1}`),
      deals: Array.from({ length: 8 }, (_, index) => ({
        title: `deal-${index + 1}`,
      })),
      notes: Array.from({ length: 5 }, (_, index) => ({
        text: `note-${index + 1} ${'x'.repeat(700)}`,
      })),
      memories: Array.from({ length: 8 }, (_, index) => ({
        summary: `memory-${index + 1}`,
      })),
      commitments: Array.from({ length: 7 }, (_, index) => ({
        title: `commitment-${index + 1}`,
      })),
      signals: Array.from({ length: 7 }, (_, index) => ({
        summary: `signal-${index + 1}`,
      })),
    })

    expect(output).toContain('tag-12')
    expect(output).not.toContain('tag-13')
    expect(output).toContain('deal-5')
    expect(output).not.toContain('deal-6')
    expect(output).toContain('note-3')
    expect(output).not.toContain('note-4')
    expect(output).toContain('memory-5')
    expect(output).not.toContain('memory-6')
    expect(output).toContain('commitment-4')
    expect(output).not.toContain('commitment-5')
    expect(output).toContain('signal-4')
    expect(output).not.toContain('signal-5')
  })
})
