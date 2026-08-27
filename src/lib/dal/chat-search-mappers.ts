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
  /** The curated, client-scoped person identity (trajectory person_key). */
  person_key: string | null
  campaigns: {
    id: string
    title: string | null
    client_id: string | null
    clients: { id: string; name: string | null } | null
  } | null
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
  personKey: string | null
  clientId: string | null
  clientName: string | null
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
    personKey: row.person_key,
    clientId: row.campaigns?.client_id ?? null,
    clientName: row.campaigns?.clients?.name ?? null,
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

/**
 * Split a search phrase into the tokens that must EACH match somewhere.
 *
 * Names are stored split across first_name and last_name, so matching the whole
 * phrase against each column in turn finds nothing for "Jason Hunt" — the very
 * first thing anyone types. Tokenising and requiring every token to match some
 * column makes the natural query work, while still narrowing rather than
 * widening the result set as more words are added.
 */
export function searchTokens(term: string, max = 4): string[] {
  return term
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
}

export interface PersonSearchResult {
  /** Stable key for the person within this result set. */
  personKey: string
  name: string
  email: string | null
  /** Which client this person record belongs to, when it is scoped to one. */
  clientName: string | null
  /** Every campaign_participants row this person has, newest campaign first. */
  participantIds: string[]
  participationCount: number
  campaigns: Array<{ campaignId: string; title: string | null }>
  /** Deep link to their most recent participation. */
  href: string
}

/**
 * The identity a participation row belongs to.
 *
 * person_key is the curated, CLIENT-SCOPED person identity established by
 * 20260512140000_trajectory_person_key.sql: the same email under two clients is
 * deliberately two people, and an admin can merge or split records. Grouping on
 * email alone would override both of those decisions — fusing people the
 * platform considers distinct, and splitting ones an admin has linked.
 *
 * That matters beyond tidiness: the grouped participant ids are handed to
 * getLatestScoredSession, so a wrong grouping shows the wrong person's scores.
 *
 * Falls back to email scoped by client, then to the row itself, so a row with
 * no person_key is never merged with an unrelated one.
 */
export function personIdentityKey(row: ParticipantSearchResult): string {
  if (row.personKey) return `pk:${row.personKey}`
  const email = row.email?.trim().toLowerCase()
  if (email) return `em:${row.clientId ?? 'none'}:${email}`
  return `row:${row.participantId}`
}

/**
 * Collapse participation rows into PEOPLE.
 *
 * campaign_participants holds one row per person per campaign, and re-invites
 * create more. Returning those rows raw means asking for one person yields a
 * wall of near-identical entries — 37 rows for one human in production.
 * Grouping by the canonical identity restores the unit the question was asked
 * in without merging records the platform treats as different people.
 */
export function groupParticipantsByPerson(
  rows: ParticipantSearchResult[],
): PersonSearchResult[] {
  const byPerson = new Map<string, PersonSearchResult>()

  for (const row of rows) {
    const key = personIdentityKey(row)
    const existing = byPerson.get(key)
    if (!existing) {
      byPerson.set(key, {
        personKey: key,
        name: row.name,
        email: row.email,
        clientName: row.clientName,
        participantIds: [row.participantId],
        participationCount: 1,
        campaigns: [{ campaignId: row.campaignId, title: row.campaignTitle }],
        href: row.href,
      })
      continue
    }
    existing.participantIds.push(row.participantId)
    existing.participationCount += 1
    if (!existing.campaigns.some((c) => c.campaignId === row.campaignId)) {
      existing.campaigns.push({
        campaignId: row.campaignId,
        title: row.campaignTitle,
      })
    }
  }

  return Array.from(byPerson.values())
}
