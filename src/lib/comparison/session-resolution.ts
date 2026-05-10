/**
 * Pure helpers for resolving the right session per (participant, assessment)
 * and computing per-pair attempt ordinals. Extracted so they're unit-testable
 * without touching Supabase.
 */

export type SessionRow = {
  id: string
  campaign_participant_id: string
  assessment_id: string
  status: string
  started_at: string | null
  completed_at: string | null
}

/**
 * Pick the most recent completed session for a (cp, assessment) tuple.
 * Tiebreaker: completed_at desc, started_at desc, id desc — fully deterministic.
 * Returns null if no completed session exists.
 */
export function pickMostRecentCompleted(
  rows: SessionRow[],
  campaignParticipantId: string,
  assessmentId: string,
): SessionRow | null {
  const candidates = rows.filter(
    (r) =>
      r.campaign_participant_id === campaignParticipantId &&
      r.assessment_id === assessmentId &&
      r.status === 'completed',
  )
  if (candidates.length === 0) return null
  return candidates.slice().sort((a, b) => {
    const c = (b.completed_at ?? '').localeCompare(a.completed_at ?? '')
    if (c !== 0) return c
    const s = (b.started_at ?? '').localeCompare(a.started_at ?? '')
    if (s !== 0) return s
    return b.id.localeCompare(a.id)
  })[0]
}

/**
 * Compute attempt ordinals: for every (cp, assessment) pair, rank sessions by
 * started_at ascending and assign 1-based attempt numbers. Returns a Map keyed
 * by `${cpId}:${assessmentId}:${sessionId}`.
 */
export function computeAttemptOrdinals(rows: SessionRow[]): Map<string, number> {
  const out = new Map<string, number>()
  const orderedAsc = rows.slice().sort((a, b) =>
    (a.started_at ?? '').localeCompare(b.started_at ?? ''),
  )
  const counter = new Map<string, number>()
  for (const r of orderedAsc) {
    const k = `${r.campaign_participant_id}:${r.assessment_id}`
    const next = (counter.get(k) ?? 0) + 1
    counter.set(k, next)
    out.set(`${k}:${r.id}`, next)
  }
  return out
}
