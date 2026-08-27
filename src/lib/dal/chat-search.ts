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
  toParticipantSearchResult,
  toCampaignSearchResult,
  toAssessmentSearchResult,
  type ParticipantSearchRow,
  type CampaignSearchRow,
  type AssessmentSearchRow,
  type ParticipantSearchResult,
  type CampaignSearchResult,
  type AssessmentSearchResult,
} from './chat-search-mappers'

/** Every chat lookup caps its result set at this many rows. */
export const CHAT_SEARCH_LIMIT = 20

export class ChatSearchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChatSearchError'
  }
}

/** People matching a name or email fragment, within what the caller may see. */
export async function searchParticipants(
  db: SupabaseClient,
  term: string,
  limit = CHAT_SEARCH_LIMIT,
): Promise<ParticipantSearchResult[]> {
  const pattern = buildSearchPattern(term)
  const { data, error } = await db
    .from('campaign_participants')
    .select('id, email, first_name, last_name, status, campaign_id, campaigns(id, title)')
    .is('deleted_at', null)
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
    .limit(limit)

  if (error) throw new ChatSearchError(error.message)
  return ((data ?? []) as unknown as ParticipantSearchRow[]).map(
    toParticipantSearchResult,
  )
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
