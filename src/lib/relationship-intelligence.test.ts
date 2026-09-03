import { describe, expect, it } from 'vitest'
import {
  calculateRelationshipPulse,
  chooseExplainableRelationshipAction,
} from './relationship-intelligence'

const NOW = new Date('2026-09-01T12:00:00.000Z')

describe('chooseExplainableRelationshipAction', () => {
  it('prefers the highest urgency policy-permitted recommendation', () => {
    const action = chooseExplainableRelationshipAction({
      recommendations: [
        {
          title: 'Blocked action',
          rationale: 'Must not win.',
          urgency: 'urgent',
          policyStatus: 'blocked',
        },
        {
          title: 'Call the decision maker',
          rationale: 'A high-intent signal appeared after the proposal.',
          urgency: 'high',
          policyStatus: 'review',
          requiresApproval: true,
        },
      ],
      commitments: [],
      signals: [],
      fallback: 'Keep context current.',
      now: NOW,
    })

    expect(action.title).toBe('Call the decision maker')
    expect(action.source).toBe('recommendation')
    expect(action.requiresApproval).toBe(true)
  })

  it('surfaces overdue commitments before generic signals', () => {
    const action = chooseExplainableRelationshipAction({
      recommendations: [],
      commitments: [
        {
          title: 'Send revised proposal',
          dueAt: '2026-08-31T12:00:00.000Z',
          status: 'open',
          direction: 'our_commitment',
        },
      ],
      signals: [
        {
          type: 'relationship_decay',
          summary: 'Engagement is falling.',
          severity: 'critical',
          status: 'active',
        },
      ],
      fallback: 'Keep context current.',
      now: NOW,
    })

    expect(action.source).toBe('commitment')
    expect(action.urgency).toBe('urgent')
    expect(action.reason).toContain('We made this promise')
  })

  it('turns relationship decay into a revival action', () => {
    const action = chooseExplainableRelationshipAction({
      recommendations: [],
      commitments: [],
      signals: [
        {
          type: 'relationship_decay',
          summary: 'No response after three previously active conversations.',
          severity: 'high',
          status: 'active',
        },
      ],
      fallback: 'Keep context current.',
      now: NOW,
    })

    expect(action.title).toBe('Revive this relationship')
    expect(action.source).toBe('signal')
    expect(action.urgency).toBe('high')
  })
})

describe('calculateRelationshipPulse', () => {
  it('explains why a relationship moved into the at-risk band', () => {
    const pulse = calculateRelationshipPulse({
      contextCompleteness: 70,
      commitments: [
        {
          title: 'Follow up',
          dueAt: '2026-08-20T12:00:00.000Z',
          status: 'open',
        },
      ],
      signals: [
        {
          type: 'relationship_decay',
          summary: 'Response frequency dropped sharply.',
          severity: 'critical',
          status: 'active',
        },
      ],
      lastEngagedAt: '2026-05-01T12:00:00.000Z',
      now: NOW,
    })

    expect(pulse.band).toBe('at_risk')
    expect(pulse.reasons).toContain('Response frequency dropped sharply.')
    expect(pulse.reasons.some((reason) => reason.includes('overdue commitment'))).toBe(true)
    expect(pulse.reasons.some((reason) => reason.includes('No recorded engagement'))).toBe(true)
  })

  it('rewards recent engagement and positive intent transparently', () => {
    const pulse = calculateRelationshipPulse({
      contextCompleteness: 100,
      commitments: [],
      signals: [
        {
          type: 'high_intent',
          summary: 'Asked for pricing and implementation timing.',
          severity: 'high',
          status: 'active',
        },
      ],
      lastEngagedAt: '2026-08-31T12:00:00.000Z',
      now: NOW,
    })

    expect(pulse.score).toBeGreaterThanOrEqual(80)
    expect(pulse.band).toBe('strong')
    expect(pulse.reasons).toContain('Recently engaged')
  })
})
