// =============================================================================
// src/lib/dal/chat-scores-mappers.ts
//
// Pure row→DTO mappers for chat score reads, split from chat-scores.ts so they
// are unit-testable without a database (src/lib/dal/README.md).
//
// toFactorScore takes the RESOLVED CompetencyScoreDisplay, never the raw row's
// norm columns. That is what keeps the rank-claim fields absent rather than
// null: the uncalibrated branch of the union has no percentile to copy, so
// there is nothing here for one to leak through.
// =============================================================================

import type { CompetencyScoreDisplay } from '@/lib/reports/competency-claims'

export interface SessionIdentityRow {
  id: string
  status: string | null
  completed_at: string | null
  campaign_id: string | null
  assessments: { id: string; title: string | null } | null
  campaign_participants: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
}

export interface RawScoreRow {
  factor_id: string
  metric: string
  scaled_score: number
  raw_score: number | null
  percentile: number | null
  confidence_interval_lower: number | null
  confidence_interval_upper: number | null
  norm_group_id: string | null
  norm_version: string | null
  provisional: boolean
  scoring_variant: string | null
  factors: { id: string; name: string | null } | null
}

export interface SessionIdentity {
  sessionId: string
  status: string | null
  completedAt: string | null
  campaignId: string | null
  participantId: string | null
  participantName: string
  assessmentTitle: string | null
  href: string | null
}

export interface FactorScore {
  factorId: string
  name: string
  scaledScore: number
  provisional: boolean
  /** Present only for a norm-referenced score. Absent, not null, otherwise. */
  percentile?: number
  confidenceIntervalLower?: number | null
  confidenceIntervalUpper?: number | null
  normVersion?: string
}

export function participantNameFrom(
  row: SessionIdentityRow['campaign_participants'],
): string {
  if (!row) return 'Unknown participant'
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
  return name || row.email || 'Unnamed participant'
}

export function toSessionIdentity(row: SessionIdentityRow): SessionIdentity {
  const participantId = row.campaign_participants?.id ?? null
  return {
    sessionId: row.id,
    status: row.status,
    completedAt: row.completed_at,
    campaignId: row.campaign_id,
    participantId,
    participantName: participantNameFrom(row.campaign_participants),
    assessmentTitle: row.assessments?.title ?? null,
    href:
      row.campaign_id && participantId
        ? `/campaigns/${row.campaign_id}/participants/${participantId}/sessions/${row.id}`
        : row.campaign_id
          ? `/campaigns/${row.campaign_id}/sessions/${row.id}`
          : null,
  }
}

/**
 * Build the display DTO from the RESOLVED score. The calibrated branch is the
 * only path that can produce a percentile, so an uncalibrated row cannot carry
 * one no matter what its raw columns hold.
 */
export function toFactorScore(
  row: RawScoreRow,
  display: CompetencyScoreDisplay,
): FactorScore {
  const base = {
    factorId: row.factor_id,
    name: row.factors?.name ?? 'Unnamed factor',
    scaledScore: display.scaledScore,
    provisional: display.provisional,
  }

  if (display.kind === 'calibrated') {
    return {
      ...base,
      percentile: display.percentile,
      confidenceIntervalLower: display.confidenceIntervalLower,
      confidenceIntervalUpper: display.confidenceIntervalUpper,
      normVersion: display.normVersion,
    }
  }

  return base
}
