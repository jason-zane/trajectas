// =============================================================================
// src/lib/dal/chat-search.ts
//
// Entity lookups for grounded chat. These are ordinary DAL reads with one
// deliberate difference from most of the module: the Supabase client is
// INJECTED rather than opened here, and callers pass the requesting user's
// RLS-scoped client (createServerSupabaseClient()), never the admin client.
//
// That is the whole isolation model for chat. None of these queries carries a
// tenant predicate because none needs one — the SELECT policies on campaigns,
// campaign_participants and assessments already scope through
// auth_user_client_ids(), with is_platform_admin() short-circuiting to
// everything. One query therefore serves a platform admin broadly and a client
// member narrowly, and the narrow path cannot be forgotten because it is the
// default.
//
// Client injection follows the established pattern here (see careless.ts and
// participants.ts, which take `db` as their first parameter).
// =============================================================================

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildSearchPattern,
  searchTokens,
  groupParticipantsByPerson,
  toParticipantSearchResult,
  toCampaignSearchResult,
  toAssessmentSearchResult,
  type ParticipantSearchRow,
  type CampaignSearchRow,
  type AssessmentSearchRow,
  type ParticipantSearchResult,
  type CampaignSearchResult,
  type AssessmentSearchResult,
  type PersonSearchResult,
} from './chat-search-mappers'

/** Every chat lookup caps its DISPLAYED result set at this many entries. */
export const CHAT_SEARCH_LIMIT = 20

/**
 * How many participation rows to scan before grouping into people. Higher than
 * the display limit on purpose: one person can hold dozens of participations.
 */
export const PARTICIPATION_SCAN_LIMIT = 400

export class ChatSearchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChatSearchError'
  }
}

/**
 * Participation rows matching a name or email fragment, within what the caller
 * may see.
 *
 * Every token in the phrase must match SOMEWHERE — chained .or() calls are
 * ANDed by PostgREST — because a name is stored split across first_name and
 * last_name, so matching "Jason Hunt" whole against either column finds
 * nothing. Each token is escaped independently.
 *
 * The row cap is raised well above the display limit here because these rows
 * are about to be collapsed into people: one person can easily hold dozens of
 * participations, and truncating before grouping would drop whole humans.
 */
export async function searchParticipants(
  db: SupabaseClient,
  term: string,
  limit = PARTICIPATION_SCAN_LIMIT,
): Promise<ParticipantSearchResult[]> {
  const tokens = searchTokens(term)
  if (tokens.length === 0) return []

  let builder = db
    .from('campaign_participants')
    .select(
      'id, email, first_name, last_name, status, campaign_id, person_key, campaigns(id, title, client_id, clients(id, name))',
    )
    .is('deleted_at', null)
    .is('campaign_rater_id', null)

  for (const token of tokens) {
    const pattern = buildSearchPattern(token)
    builder = builder.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
    )
  }

  const { data, error } = await builder
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new ChatSearchError(error.message)
  return ((data ?? []) as unknown as ParticipantSearchRow[]).map(
    toParticipantSearchResult,
  )
}

/**
 * The same search, collapsed into PEOPLE rather than participations — the unit
 * the question is actually asked in.
 */
export async function searchPeople(
  db: SupabaseClient,
  term: string,
  limit = CHAT_SEARCH_LIMIT,
): Promise<{ people: PersonSearchResult[]; truncated: boolean }> {
  const rows = await searchParticipants(db, term)
  const people = groupParticipantsByPerson(rows)
  return {
    people: people.slice(0, limit),
    truncated: people.length > limit || rows.length === PARTICIPATION_SCAN_LIMIT,
  }
}

/** Campaigns matching a title fragment, optionally filtered by status. */
export async function searchCampaigns(
  db: SupabaseClient,
  params: { term?: string; status?: string; limit?: number } = {},
): Promise<CampaignSearchResult[]> {
  let builder = db
    .from('campaigns')
    .select('id, title, status, kind, opens_at, closes_at, clients(id, name)')
    .is('deleted_at', null)

  const term = params.term?.trim()
  if (term) builder = builder.ilike('title', buildSearchPattern(term))

  const status = params.status?.trim()
  if (status) builder = builder.eq('status', status)

  const { data, error } = await builder
    .order('created_at', { ascending: false })
    .limit(params.limit ?? CHAT_SEARCH_LIMIT)

  if (error) throw new ChatSearchError(error.message)
  return ((data ?? []) as unknown as CampaignSearchRow[]).map(toCampaignSearchResult)
}

/** Assessments matching a title fragment. */
export async function searchAssessments(
  db: SupabaseClient,
  params: { term?: string; limit?: number } = {},
): Promise<AssessmentSearchResult[]> {
  let builder = db
    .from('assessments')
    .select('id, title, slug, status, scoring_method, clients(id, name)')
    .is('deleted_at', null)

  const term = params.term?.trim()
  if (term) builder = builder.ilike('title', buildSearchPattern(term))

  const { data, error } = await builder
    .order('created_at', { ascending: false })
    .limit(params.limit ?? CHAT_SEARCH_LIMIT)

  if (error) throw new ChatSearchError(error.message)
  return ((data ?? []) as unknown as AssessmentSearchRow[]).map(
    toAssessmentSearchResult,
  )
}
