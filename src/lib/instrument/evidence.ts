/**
 * Append-only evidence ledger for instrument quality and validity claims.
 *
 * Tracks the provenance (a priori, synthetic, empirical) of evidence backing
 * item parameters and construct properties. Supports supersession when newer
 * evidence invalidates prior claims, and provides honesty affordances to prevent
 * forecasts from rendering as observations.
 *
 * @module
 */

import type { EvidenceRecord, EvidenceClass } from './types'

export const EVIDENCE_CLASS_RANK: Record<EvidenceClass, number> = {
  a_priori: 0,
  synthetic: 1,
  empirical: 2
}

// ---------------------------------------------------------------------------
// Supersession logic
// ---------------------------------------------------------------------------

export function isSupersededBy(existing: EvidenceRecord, incoming: EvidenceRecord): boolean {
  // Supersession requires same target and claim
  if (
    existing.targetType !== incoming.targetType ||
    existing.targetId !== incoming.targetId ||
    existing.claim !== incoming.claim
  ) {
    return false
  }

  const existingRank = EVIDENCE_CLASS_RANK[existing.evidenceClass]
  const incomingRank = EVIDENCE_CLASS_RANK[incoming.evidenceClass]

  // Incoming supersedes if higher class
  if (incomingRank > existingRank) {
    return true
  }

  // If same class, newer date supersedes
  if (incomingRank === existingRank) {
    return incoming.producedAt > existing.producedAt
  }

  return false
}

// ---------------------------------------------------------------------------
// Evidence resolution
// ---------------------------------------------------------------------------

export function resolveCurrentEvidence(records: EvidenceRecord[]): EvidenceRecord[] {
  // Build a map of (targetType, targetId, claim) -> list of records
  const grouped: Record<string, EvidenceRecord[]> = {}

  for (const record of records) {
    const key = `${record.targetType}|${record.targetId}|${record.claim}`
    if (!grouped[key]) {
      grouped[key] = []
    }
    grouped[key].push(record)
  }

  // For each group, select the one with highest evidence class, then newest date
  const current: EvidenceRecord[] = []

  for (const records_ of Object.values(grouped)) {
    // Sort by evidence class rank (desc) then producedAt (desc)
    const sorted = records_.sort((a, b) => {
      const aRank = EVIDENCE_CLASS_RANK[a.evidenceClass]
      const bRank = EVIDENCE_CLASS_RANK[b.evidenceClass]
      if (aRank !== bRank) {
        return bRank - aRank // Higher rank first
      }
      return b.producedAt.getTime() - a.producedAt.getTime() // Newer first
    })

    current.push(sorted[0])
  }

  return current
}

// ---------------------------------------------------------------------------
// Provenance labeling (honesty affordance)
// ---------------------------------------------------------------------------

export function formatEvidenceLabel(record: EvidenceRecord): string {
  const n = record.sampleSize ?? record.detail?.n

  switch (record.evidenceClass) {
    case 'a_priori':
      return 'forecast (no data)'
    case 'synthetic':
      return n !== undefined ? `simulated (n=${n})` : 'simulated (n=?)'
    case 'empirical':
      return n !== undefined ? `observed (n=${n})` : 'observed'
    default:
      return 'unknown'
  }
}

// ---------------------------------------------------------------------------
// Confidence description
// ---------------------------------------------------------------------------

export function describeConfidence(
  record: EvidenceRecord
): 'none' | 'low' | 'moderate' | 'high' {
  if (record.evidenceClass === 'a_priori') {
    return 'none'
  }

  if (record.evidenceClass === 'synthetic') {
    return 'low'
  }

  // empirical
  const n = record.sampleSize ?? record.detail?.n ?? 0
  if (n < 50) {
    return 'low'
  }
  if (n < 150) {
    return 'moderate'
  }
  return 'high'
}
