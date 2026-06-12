import type { ComparisonRow } from './types'

export function getInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

/**
 * Longitudinal mode is when every row in the comparison resolves to the same
 * underlying person. The matrix and header treat this as "one person across N
 * sessions" rather than "N people".
 *
 * person_key (the auto-linked, admin-curated identity) is the source of truth;
 * email equality is only the fallback for rows whose person_key is missing.
 */
export function isLongitudinal(rows: ComparisonRow[]): boolean {
  if (rows.length < 2) return false
  if (rows.every((r) => r.personKey)) {
    return rows.every((r) => r.personKey === rows[0].personKey)
  }
  const first = rows[0].participantEmail?.toLowerCase().trim()
  if (!first) return false
  return rows.every((r) => r.participantEmail?.toLowerCase().trim() === first)
}

export function representativeSession(row: ComparisonRow) {
  return [...row.perAssessment].sort((a, b) =>
    (b.sessionStartedAt ?? '').localeCompare(a.sessionStartedAt ?? ''),
  )[0]
}
