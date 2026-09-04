// =============================================================================
// src/lib/dal/chat-search.ts
//
// Entity lookups for grounded chat. These are ordinary DAL reads with one
// deliberate difference from most of the module: the Supabase client is
// INJECTED rather than opened here, and callers pass the requesting user's
// RLS-scoped client (createServerSupabaseClient()), never the admin client.
//
// That gives MEMBERSHIP-level isolation for free: the SELECT policies on
// campaigns, campaign_participants and assessments scope through
// auth_user_client_ids(), so one query serves a client member narrowly without
// the caller having to remember a predicate.
//
// It does not give WORKSPACE-level isolation, and these functions used to
// assume it did. auth_user_client_ids() spans every membership regardless of
// which workspace the caller is standing in, and is_platform_admin() is
// role-only — both the active context and any support session live in a signed
// cookie that never reaches Postgres. So a platform admin inside one client's
// portal was served every tenant's people, campaigns and assessments. Hence the
// explicit `scope` argument below: RLS is the floor, not the boundary.
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

/**
 * The caller's workspace boundary, resolved once per request and passed to
 * every lookup. `null` on a field means unrestricted; an EMPTY ARRAY means
 * restricted to nothing and must yield no rows.
 */
export interface ChatSearchScope {
  /** From resolveTenantClientFilter(scope). */
  clientIds: string[] | null
  /** From getAccessibleCampaignIds(scope). */
  campaignIds: string[] | null
  /** The partners in scope; empty for a caller with no partner reach. */
  partnerIds: string[]
}

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
  scope: ChatSearchScope,
  term: string,
  limit = PARTICIPATION_SCAN_LIMIT,
): Promise<ParticipantSearchResult[]> {
  const tokens = searchTokens(term)
  if (tokens.length === 0) return []
  if (scope.campaignIds && scope.campaignIds.length === 0) return []

  let builder = db
    .from('campaign_participants')
    .select(
      'id, email, first_name, last_name, status, campaign_id, person_key, campaigns(id, title, client_id, clients(id, name))',
    )
    .is('deleted_at', null)
    .is('campaign_rater_id', null)

  if (scope.campaignIds) {
    builder = builder.in('campaign_id', scope.campaignIds)
  }

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
  scope: ChatSearchScope,
  term: string,
  limit = CHAT_SEARCH_LIMIT,
): Promise<{ people: PersonSearchResult[]; truncated: boolean }> {
  const rows = await searchParticipants(db, scope, term)
  const people = groupParticipantsByPerson(rows)
  return {
    people: people.slice(0, limit),
    truncated: people.length > limit || rows.length === PARTICIPATION_SCAN_LIMIT,
  }
}

/** Campaigns matching a title fragment, optionally filtered by status. */
export async function searchCampaigns(
  db: SupabaseClient,
  scope: ChatSearchScope,
  params: { term?: string; status?: string; limit?: number } = {},
): Promise<CampaignSearchResult[]> {
  if (scope.campaignIds && scope.campaignIds.length === 0) return []

  let builder = db
    .from('campaigns')
    .select('id, title, status, kind, opens_at, closes_at, clients(id, name)')
    .is('deleted_at', null)

  if (scope.campaignIds) {
    builder = builder.in('id', scope.campaignIds)
  }

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
  scope: ChatSearchScope,
  params: { term?: string; limit?: number } = {},
): Promise<AssessmentSearchResult[]> {
  let builder = db
    .from('assessments')
    .select('id, title, slug, status, scoring_method, clients(id, name)')
    .is('deleted_at', null)

  if (scope.clientIds) {
    // Mirrors the assessments SELECT policy, but against the workspace rather
    // than every membership: the caller's clients, their partners' assessments,
    // and the shared library (both owner columns null), which is not tenant
    // data and stays visible everywhere.
    const clauses = ['and(client_id.is.null,partner_id.is.null)']
    if (scope.clientIds.length > 0) {
      clauses.push(`client_id.in.(${scope.clientIds.join(',')})`)
    }
    if (scope.partnerIds.length > 0) {
      clauses.push(`partner_id.in.(${scope.partnerIds.join(',')})`)
    }
    builder = builder.or(clauses.join(','))
  }

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
