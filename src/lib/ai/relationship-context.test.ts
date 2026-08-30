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

  it('bounds oversized tags, opportunities and notes', () => {
    const output = formatRelationshipContext({
      tags: Array.from({ length: 20 }, (_, index) => `tag-${index + 1}`),
      deals: Array.from({ length: 8 }, (_, index) => ({
        title: `deal-${index + 1}`,
      })),
      notes: Array.from({ length: 5 }, (_, index) => ({
        text: `note-${index + 1} ${'x'.repeat(700)}`,
      })),
    })

    expect(output).toContain('tag-12')
    expect(output).not.toContain('tag-13')
    expect(output).toContain('deal-5')
    expect(output).not.toContain('deal-6')
    expect(output).toContain('note-3')
    expect(output).not.toContain('note-4')
  })
})
