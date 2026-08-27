// =============================================================================
// src/lib/dal/chat-search-mappers.ts
//
// Pure row→DTO mappers for chat entity search. Split from chat-search.ts so
// they are unit-testable without a database, per src/lib/dal/README.md.
// =============================================================================

export interface ParticipantSearchRow {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  status: string | null
  campaign_id: string
  campaigns: { id: string; title: string | null } | null
}

export interface CampaignSearchRow {
  id: string
  title: string | null
  status: string | null
  kind: string | null
  opens_at: string | null
  closes_at: string | null
  clients: { id: string; name: string | null } | null
}

export interface AssessmentSearchRow {
  id: string
  title: string | null
  slug: string | null
  status: string | null
  scoring_method: string | null
  clients: { id: string; name: string | null } | null
}

export interface ParticipantSearchResult {
  participantId: string
  name: string
  email: string | null
  status: string | null
  campaignId: string
  campaignTitle: string | null
  href: string
}

export interface CampaignSearchResult {
  campaignId: string
  title: string | null
  status: string | null
  kind: string | null
  clientName: string | null
  opensAt: string | null
  closesAt: string | null
  href: string
}

export interface AssessmentSearchResult {
  assessmentId: string
  title: string | null
  status: string | null
  scoringMethod: string | null
  clientName: string | null
  href: string
}

export function participantDisplayName(row: ParticipantSearchRow): string {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
  return name || row.email || 'Unnamed participant'
}

export function toParticipantSearchResult(
  row: ParticipantSearchRow,
): ParticipantSearchResult {
  return {
    participantId: row.id,
    name: participantDisplayName(row),
    email: row.email,
    status: row.status,
    campaignId: row.campaign_id,
    campaignTitle: row.campaigns?.title ?? null,
    href: `/campaigns/${row.campaign_id}/participants/${row.id}`,
  }
}

export function toCampaignSearchResult(row: CampaignSearchRow): CampaignSearchResult {
  return {
    campaignId: row.id,
    title: row.title,
    status: row.status,
    kind: row.kind,
    clientName: row.clients?.name ?? null,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    href: `/campaigns/${row.id}`,
  }
}

export function toAssessmentSearchResult(
  row: AssessmentSearchRow,
): AssessmentSearchResult {
  return {
    assessmentId: row.id,
    title: row.title,
    status: row.status,
    scoringMethod: row.scoring_method,
    clientName: row.clients?.name ?? null,
    href: `/assessments/${row.id}/edit/overview`,
  }
}

/**
 * Neutralise LIKE wildcards in user-supplied search text so a query of "100%"
 * matches the literal string rather than everything.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * PostgREST's `or=` filter is comma-and-parenthesis delimited, so those
 * characters in a search term would otherwise be read as filter syntax rather
 * than as data.
 */
export function sanitiseOrTerm(value: string): string {
  return value.replace(/[,()]/g, ' ')
}

/**
 * Build the ILIKE pattern for a user-supplied term. Order matters: strip
 * PostgREST delimiters first, then escape LIKE wildcards, so neither layer can
 * be steered by the search text.
 */
export function buildSearchPattern(term: string): string {
  return `%${escapeLikePattern(sanitiseOrTerm(term))}%`
}
