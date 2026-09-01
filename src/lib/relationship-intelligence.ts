export type RelationshipUrgency = 'low' | 'normal' | 'high' | 'urgent'

export interface RelationshipCommitmentSummary {
  title: string
  dueAt?: string | null
  status?: string | null
  direction?: string | null
}

export interface RelationshipSignalSummary {
  type?: string | null
  summary: string
  severity?: string | null
  score?: number | null
  status?: string | null
}

export interface RelationshipRecommendationSummary {
  title: string
  rationale: string
  urgency?: RelationshipUrgency | null
  policyStatus?: 'allowed' | 'review' | 'blocked' | null
  requiresApproval?: boolean | null
  status?: string | null
}

export interface ExplainableRelationshipAction {
  title: string
  reason: string
  urgency: RelationshipUrgency
  source: 'recommendation' | 'commitment' | 'signal' | 'fallback'
  requiresApproval: boolean
}

export interface RelationshipPulse {
  score: number
  band: 'strong' | 'stable' | 'watch' | 'at_risk'
  reasons: string[]
}

const URGENCY_WEIGHT: Record<RelationshipUrgency, number> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
}

const SEVERITY_WEIGHT: Record<string, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

function isPast(date: string | null | undefined, now: Date): boolean {
  if (!date) return false
  const timestamp = new Date(date).getTime()
  return Number.isFinite(timestamp) && timestamp < now.getTime()
}

function normalizeUrgency(value?: string | null): RelationshipUrgency {
  return value === 'low' || value === 'high' || value === 'urgent'
    ? value
    : 'normal'
}

/**
 * Picks a next action without hiding why it was chosen. Persisted
 * recommendations win when policy permits them, followed by overdue promises
 * and then active risk/opportunity signals. This is deterministic by design so
 * it remains useful even when an AI provider is unavailable.
 */
export function chooseExplainableRelationshipAction({
  recommendations,
  commitments,
  signals,
  fallback,
  now = new Date(),
}: {
  recommendations: RelationshipRecommendationSummary[]
  commitments: RelationshipCommitmentSummary[]
  signals: RelationshipSignalSummary[]
  fallback: string
  now?: Date
}): ExplainableRelationshipAction {
  const recommendation = recommendations
    .filter(
      (item) =>
        (item.status == null || item.status === 'pending') &&
        item.policyStatus !== 'blocked',
    )
    .sort(
      (a, b) =>
        URGENCY_WEIGHT[normalizeUrgency(b.urgency)] -
        URGENCY_WEIGHT[normalizeUrgency(a.urgency)],
    )[0]

  if (recommendation) {
    return {
      title: recommendation.title,
      reason: recommendation.rationale,
      urgency: normalizeUrgency(recommendation.urgency),
      source: 'recommendation',
      requiresApproval:
        recommendation.requiresApproval ?? recommendation.policyStatus !== 'allowed',
    }
  }

  const overdue = commitments
    .filter(
      (item) =>
        (item.status == null || item.status === 'open') && isPast(item.dueAt, now),
    )
    .sort((a, b) => {
      const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY
      const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY
      return aTime - bTime
    })[0]

  if (overdue) {
    const direction =
      overdue.direction === 'our_commitment'
        ? 'We made this promise and it is overdue.'
        : overdue.direction === 'their_commitment'
          ? 'Their promised follow-up is overdue.'
          : 'This relationship commitment is overdue.'

    return {
      title: `Recover commitment: ${overdue.title}`,
      reason: direction,
      urgency: 'urgent',
      source: 'commitment',
      requiresApproval: false,
    }
  }

  const signal = signals
    .filter((item) => item.status == null || item.status === 'active')
    .sort(
      (a, b) =>
        (SEVERITY_WEIGHT[b.severity ?? 'medium'] ?? 2) -
        (SEVERITY_WEIGHT[a.severity ?? 'medium'] ?? 2),
    )[0]

  if (signal) {
    const urgent = signal.severity === 'critical'
    const high = signal.severity === 'high'
    return {
      title:
        signal.type === 'relationship_decay'
          ? 'Revive this relationship'
          : signal.type === 'revival_opportunity'
            ? 'Act on revival opportunity'
            : signal.type === 'high_intent'
              ? 'Respond to high-intent signal'
              : 'Review relationship signal',
      reason: signal.summary,
      urgency: urgent ? 'urgent' : high ? 'high' : 'normal',
      source: 'signal',
      requiresApproval: false,
    }
  }

  return {
    title: 'Continue relationship intentionally',
    reason: fallback,
    urgency: 'normal',
    source: 'fallback',
    requiresApproval: false,
  }
}

/**
 * A transparent pulse indicator, not a machine-learned or financial score.
 * Every adjustment is returned as a human-readable reason.
 */
export function calculateRelationshipPulse({
  contextCompleteness,
  commitments,
  signals,
  lastEngagedAt,
  now = new Date(),
}: {
  contextCompleteness: number
  commitments: RelationshipCommitmentSummary[]
  signals: RelationshipSignalSummary[]
  lastEngagedAt?: string | null
  now?: Date
}): RelationshipPulse {
  let score = Math.round(35 + Math.min(100, Math.max(0, contextCompleteness)) * 0.35)
  const reasons: string[] = []

  const activeSignals = signals.filter(
    (signal) => signal.status == null || signal.status === 'active',
  )

  for (const signal of activeSignals) {
    if (signal.type === 'rising_engagement' || signal.type === 'high_intent') {
      score += signal.severity === 'high' || signal.severity === 'critical' ? 12 : 7
      reasons.push(signal.summary)
    } else if (
      signal.type === 'relationship_decay' ||
      signal.type === 'negative_sentiment' ||
      signal.type === 'silent_risk'
    ) {
      score -= signal.severity === 'critical' ? 25 : signal.severity === 'high' ? 18 : 10
      reasons.push(signal.summary)
    }
  }

  const overdueCount = commitments.filter(
    (item) =>
      (item.status == null || item.status === 'open') && isPast(item.dueAt, now),
  ).length
  if (overdueCount > 0) {
    score -= Math.min(25, overdueCount * 10)
    reasons.push(`${overdueCount} overdue commitment${overdueCount === 1 ? '' : 's'}`)
  }

  if (lastEngagedAt) {
    const last = new Date(lastEngagedAt).getTime()
    if (Number.isFinite(last)) {
      const days = Math.floor((now.getTime() - last) / 86_400_000)
      if (days >= 90) {
        score -= 20
        reasons.push(`No recorded engagement for ${days} days`)
      } else if (days >= 45) {
        score -= 10
        reasons.push(`No recorded engagement for ${days} days`)
      } else if (days <= 7) {
        score += 5
        reasons.push('Recently engaged')
      }
    }
  }

  score = Math.max(0, Math.min(100, score))

  return {
    score,
    band:
      score >= 80 ? 'strong' : score >= 60 ? 'stable' : score >= 40 ? 'watch' : 'at_risk',
    reasons: reasons.slice(0, 4),
  }
}
