'use server'

/**
 * Server actions for the Trajectory feature.
 *
 * See docs/superpowers/specs/2026-05-12-trajectory-design.md.
 *
 * Identity grouping is by `campaign_participants.person_key`. The auto-link
 * trigger reuses an existing person_key when (client_id, email) matches an
 * existing participant on insert; the merge/unlink actions below let an
 * admin correct mistakes manually. Both auto and manual paths enforce that
 * a person_key never crosses client boundaries.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import {
  applyTenantClientFilter,
  AuthorizationError,
  canManageClient,
  requireParticipantAccess,
  resolveAuthorizedScope,
  resolveTenantClientFilter,
} from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LinkedParticipant = {
  campaignParticipantId: string
  campaignId: string
  campaignTitle: string
  email: string
  firstName: string | null
  lastName: string | null
  status: string
  completedSessionCount: number
  createdAt: string
}

export type PersonSearchResult = {
  campaignParticipantId: string
  personKey: string
  displayName: string
  email: string
  campaignTitle: string
  clientId: string
  lastActivityAt: string | null
}

export type TrajectoryLandingData = {
  stats: {
    /** Distinct people (by person_key) with at least one completed session in scope. */
    peopleTracked: number
    /** Total completed sessions in scope (across all time). */
    sessionsCompleted: number
    /** Sessions completed in the last 30 days. */
    sessionsLast30Days: number
  }
  /** Most recently active people (one entry per person_key), already scoped. */
  recent: PersonSearchResult[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type ParticipantIdentity = {
  id: string
  campaignId: string
  clientId: string
  personKey: string
  email: string
}

async function loadParticipantIdentity(
  participantId: string,
): Promise<ParticipantIdentity> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('campaign_participants')
    .select('id, campaign_id, email, person_key, campaigns!inner(client_id)')
    .eq('id', participantId)
    .single()

  if (error || !data) {
    throw new AuthorizationError('Participant not found.')
  }

  // Supabase typing returns the embedded relation as an object or array depending
  // on the relationship. With an inner join on a 1:1 FK it's an object; some
  // codegen surfaces it as `T | T[]`. Normalise.
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns[0] : data.campaigns
  const clientId = campaigns?.client_id ? String(campaigns.client_id) : null
  if (!clientId) {
    throw new AuthorizationError('Participant has no client context.')
  }

  return {
    id: String(data.id),
    campaignId: String(data.campaign_id),
    clientId,
    personKey: String(data.person_key),
    email: String(data.email),
  }
}

function pickDisplayName(row: {
  first_name: string | null
  last_name: string | null
  email: string
}): string {
  const first = (row.first_name ?? '').trim()
  const last = (row.last_name ?? '').trim()
  if (first || last) {
    return [first, last].filter(Boolean).join(' ')
  }
  return row.email
}

// ---------------------------------------------------------------------------
// getLinkedParticipants
//
// Returns every campaign_participants row that shares the given participant's
// person_key. Always scoped to a single client (the auto-link trigger and the
// merge action both enforce this).
// ---------------------------------------------------------------------------

export async function getLinkedParticipants(
  campaignParticipantId: string,
): Promise<LinkedParticipant[]> {
  await requireParticipantAccess(campaignParticipantId)
  const identity = await loadParticipantIdentity(campaignParticipantId)

  const db = createAdminClient()
  const { data, error } = await db
    .from('campaign_participants')
    .select(`
      id,
      campaign_id,
      email,
      first_name,
      last_name,
      status,
      created_at,
      campaigns!inner(title, client_id),
      participant_sessions(id, status)
    `)
    .eq('person_key', identity.personKey)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    throwActionError('getLinkedParticipants', 'Unable to load linked records.', error)
  }

  // Defence in depth: filter out any rows whose campaign is in a different
  // client. By model this should be impossible (auto-link is client-scoped,
  // merge is rejected across clients), but a stray manual UPDATE could
  // produce one and we don't want to surface it as if it were the same person.
  const rows = (data ?? []).filter((row) => {
    const c = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns
    return c?.client_id && String(c.client_id) === identity.clientId
  })

  return rows.map((row) => {
    const c = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns
    const sessions = (row.participant_sessions ?? []) as { id: string; status: string }[]
    const completedCount = sessions.filter((s) => s.status === 'completed').length

    return {
      campaignParticipantId: String(row.id),
      campaignId: String(row.campaign_id),
      campaignTitle: c?.title ? String(c.title) : 'Unknown campaign',
      email: String(row.email),
      firstName: row.first_name ? String(row.first_name) : null,
      lastName: row.last_name ? String(row.last_name) : null,
      status: String(row.status),
      completedSessionCount: completedCount,
      createdAt: String(row.created_at),
    }
  })
}

// ---------------------------------------------------------------------------
// searchPersons
//
// Searches campaign_participants by email / name within the caller's
// accessible clients. Returns one row per person_key (the most recent
// participant for that key).
// ---------------------------------------------------------------------------

export async function searchPersons(
  query: string,
): Promise<PersonSearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const scope = await resolveAuthorizedScope()
  const db = createAdminClient()

  let q = db
    .from('campaign_participants')
    .select(`
      id,
      email,
      first_name,
      last_name,
      person_key,
      created_at,
      started_at,
      completed_at,
      campaigns!inner(title, client_id)
    `)
    .or(
      `email.ilike.%${trimmed}%,first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%`,
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)

  const scopedQ = applyTenantClientFilter(q, scope, 'campaigns.client_id')
  if (!scopedQ) return []
  q = scopedQ

  const { data, error } = await q
  if (error) {
    throwActionError('searchPersons', 'Unable to search.', error)
  }

  // Dedupe to one row per person_key (most recent by created_at, which is
  // how the query is ordered)
  const seen = new Set<string>()
  const out: PersonSearchResult[] = []
  for (const row of data ?? []) {
    const personKey = String(row.person_key)
    if (seen.has(personKey)) continue
    seen.add(personKey)
    const c = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns
    const lastActivity =
      row.completed_at ? String(row.completed_at) :
      row.started_at ? String(row.started_at) :
      row.created_at ? String(row.created_at) : null

    out.push({
      campaignParticipantId: String(row.id),
      personKey,
      displayName: pickDisplayName({
        first_name: row.first_name as string | null,
        last_name: row.last_name as string | null,
        email: String(row.email),
      }),
      email: String(row.email),
      campaignTitle: c?.title ? String(c.title) : 'Unknown',
      clientId: c?.client_id ? String(c.client_id) : '',
      lastActivityAt: lastActivity,
    })
  }

  return out
}

// ---------------------------------------------------------------------------
// getTrajectoryLandingData
//
// Powers the "before-you-pick-a-person" landing for /participants/trajectory.
// Returns:
//   - aggregate stats scoped to the caller's accessible clients
//   - the N most recently active people (deduped by person_key) so they can
//     jump straight to a participant they've already worked with
//
// Three small queries. Stats are exact counts via head:true; the recent list
// overfetches a window of 50 rows and dedupes client-side to one entry per
// person_key.
// ---------------------------------------------------------------------------

export async function getTrajectoryLandingData(
  recentLimit: number = 10,
): Promise<TrajectoryLandingData> {
  const scope = await resolveAuthorizedScope()
  const db = createAdminClient()

  const empty: TrajectoryLandingData = {
    stats: { peopleTracked: 0, sessionsCompleted: 0, sessionsLast30Days: 0 },
    recent: [],
  }
  const clientFilter = resolveTenantClientFilter(scope)
  if (clientFilter && clientFilter.length === 0) return empty

  // Cut-off for "last 30 days". Computed once for consistency across queries.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  let sessionsCompletedReq = db
    .from('campaign_participants')
    .select('id, campaigns!inner(client_id)', { count: 'exact', head: true })
    .not('completed_at', 'is', null)
    .is('deleted_at', null)

  let sessionsRecentReq = db
    .from('campaign_participants')
    .select('id, campaigns!inner(client_id)', { count: 'exact', head: true })
    .not('completed_at', 'is', null)
    .is('deleted_at', null)
    .gte('completed_at', thirtyDaysAgo)

  // Separate query for distinct person_keys with completed sessions. We
  // can't lift it off the recent-list window because that's capped — any
  // scope with more distinct completed people than the window would have
  // an undercounted "active people" KPI.
  let personKeysReq = db
    .from('campaign_participants')
    .select('person_key, campaigns!inner(client_id)')
    .not('completed_at', 'is', null)
    .is('deleted_at', null)

  let recentReq = db
    .from('campaign_participants')
    .select(`
      id,
      email,
      first_name,
      last_name,
      person_key,
      completed_at,
      campaigns!inner(title, client_id)
    `)
    .not('completed_at', 'is', null)
    .is('deleted_at', null)
    .order('completed_at', { ascending: false })
    .limit(Math.max(50, recentLimit * 5))

  if (clientFilter) {
    sessionsCompletedReq = sessionsCompletedReq.in('campaigns.client_id', clientFilter)
    sessionsRecentReq = sessionsRecentReq.in('campaigns.client_id', clientFilter)
    personKeysReq = personKeysReq.in('campaigns.client_id', clientFilter)
    recentReq = recentReq.in('campaigns.client_id', clientFilter)
  }

  const [sessionsCompletedRes, sessionsRecentRes, personKeysRes, recentRes] = await Promise.all([
    sessionsCompletedReq,
    sessionsRecentReq,
    personKeysReq,
    recentReq,
  ])

  if (sessionsCompletedRes.error)
    throwActionError('getTrajectoryLandingData', 'Unable to load trajectory stats.', sessionsCompletedRes.error)
  if (sessionsRecentRes.error)
    throwActionError('getTrajectoryLandingData', 'Unable to load trajectory stats.', sessionsRecentRes.error)
  if (personKeysRes.error)
    throwActionError('getTrajectoryLandingData', 'Unable to load trajectory stats.', personKeysRes.error)
  if (recentRes.error)
    throwActionError('getTrajectoryLandingData', 'Unable to load recent activity.', recentRes.error)

  // Distinct person_keys with ≥1 completed session, across the FULL scope.
  const personKeysWithSession = new Set<string>()
  for (const row of personKeysRes.data ?? []) {
    personKeysWithSession.add(String(row.person_key))
  }
  const peopleTracked = personKeysWithSession.size

  // Dedupe the recent list to one row per person_key, preserving recency order.
  const seen = new Set<string>()
  const recent: PersonSearchResult[] = []
  for (const row of recentRes.data ?? []) {
    const personKey = String(row.person_key)
    if (seen.has(personKey)) continue
    seen.add(personKey)
    if (recent.length >= recentLimit) break
    const c = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns
    recent.push({
      campaignParticipantId: String(row.id),
      personKey,
      displayName: pickDisplayName({
        first_name: row.first_name as string | null,
        last_name: row.last_name as string | null,
        email: String(row.email),
      }),
      email: String(row.email),
      campaignTitle: c?.title ? String(c.title) : 'Unknown',
      clientId: c?.client_id ? String(c.client_id) : '',
      lastActivityAt: row.completed_at ? String(row.completed_at) : null,
    })
  }

  return {
    stats: {
      peopleTracked,
      sessionsCompleted: sessionsCompletedRes.count ?? 0,
      sessionsLast30Days: sessionsRecentRes.count ?? 0,
    },
    recent,
  }
}

// ---------------------------------------------------------------------------
// linkParticipantsToSamePerson
//
// Merges one or more "source" participants into the target's person_key.
// Both source and target participants must live in the same client; cross-
// client merge is rejected.
//
// Writes a person_link_audit row inside the same transactional unit (we use
// the admin client and rely on the database transaction the RPC happens to
// open; in practice for two short UPDATEs the action's commit ordering is
// fine — we write the audit row LAST so a failed update doesn't leave a
// dangling audit entry).
// ---------------------------------------------------------------------------

export async function linkParticipantsToSamePerson(
  sourceCampaignParticipantIds: string[],
  targetCampaignParticipantId: string,
  reason?: string,
): Promise<{ targetPersonKey: string; mergedCount: number }> {
  if (sourceCampaignParticipantIds.length === 0) {
    return { targetPersonKey: '', mergedCount: 0 }
  }

  const allIds = Array.from(
    new Set([...sourceCampaignParticipantIds, targetCampaignParticipantId]),
  )
  for (const id of allIds) {
    await requireParticipantAccess(id)
  }

  const scope = await resolveAuthorizedScope()
  const target = await loadParticipantIdentity(targetCampaignParticipantId)
  const sources = await Promise.all(
    sourceCampaignParticipantIds.map((id) => loadParticipantIdentity(id)),
  )

  // Cross-client guard
  for (const s of sources) {
    if (s.clientId !== target.clientId) {
      throw new AuthorizationError(
        'Cannot merge participants from different clients.',
      )
    }
  }

  // Admin-role guard: client_admin of that client or platform_admin
  const canManage = canManageClient(scope, target.clientId)
  if (!canManage) {
    throw new AuthorizationError(
      'Only a client admin or platform admin can merge participants.',
    )
  }

  const sourceKeys = Array.from(new Set(sources.map((s) => s.personKey).filter(
    (k) => k !== target.personKey,
  )))
  if (sourceKeys.length === 0) {
    return { targetPersonKey: target.personKey, mergedCount: 0 }
  }

  const db = createAdminClient()
  const { data: updatedRows, error: updErr } = await db
    .from('campaign_participants')
    .update({ person_key: target.personKey })
    .in('person_key', sourceKeys)
    .select('id')

  if (updErr) {
    throwActionError('linkParticipantsToSamePerson', 'Merge failed.', updErr)
  }

  const affectedIds = (updatedRows ?? []).map((r) => String(r.id))

  // One audit row per (source_person_key → target_person_key) merge
  const auditRows = sourceKeys.map((src) => ({
    client_id: target.clientId,
    action: 'merge' as const,
    source_person_key: src,
    target_person_key: target.personKey,
    affected_participant_ids: affectedIds,
    performed_by: scope.actor?.id ?? null,
    reason: reason ?? null,
  }))
  const { error: auditErr } = await db.from('person_link_audit').insert(auditRows)
  if (auditErr) {
    throwActionError(
      'linkParticipantsToSamePerson',
      'Merge succeeded but audit write failed.',
      auditErr,
    )
  }

  return { targetPersonKey: target.personKey, mergedCount: affectedIds.length }
}

// ---------------------------------------------------------------------------
// unlinkParticipant
//
// Re-randomises the person_key on a single campaign_participants row,
// splitting it off from whichever person it was grouped under.
// ---------------------------------------------------------------------------

export async function unlinkParticipant(
  campaignParticipantId: string,
  reason?: string,
): Promise<{ newPersonKey: string }> {
  await requireParticipantAccess(campaignParticipantId)
  const scope = await resolveAuthorizedScope()
  const identity = await loadParticipantIdentity(campaignParticipantId)

  const canManage = canManageClient(scope, identity.clientId)
  if (!canManage) {
    throw new AuthorizationError(
      'Only a client admin or platform admin can unlink participants.',
    )
  }

  const db = createAdminClient()

  // Generate the new key in the application layer so we can record it in the
  // audit row. Postgres's DEFAULT gen_random_uuid() doesn't help here because
  // we'd need to read it back after the update.
  const newPersonKey = crypto.randomUUID()

  const { error: updErr } = await db
    .from('campaign_participants')
    .update({ person_key: newPersonKey })
    .eq('id', campaignParticipantId)

  if (updErr) {
    throwActionError('unlinkParticipant', 'Unlink failed.', updErr)
  }

  const { error: auditErr } = await db.from('person_link_audit').insert({
    client_id: identity.clientId,
    action: 'split',
    source_person_key: identity.personKey,
    target_person_key: newPersonKey,
    affected_participant_ids: [campaignParticipantId],
    performed_by: scope.actor?.id ?? null,
    reason: reason ?? null,
  })
  if (auditErr) {
    throwActionError(
      'unlinkParticipant',
      'Unlink succeeded but audit write failed.',
      auditErr,
    )
  }

  return { newPersonKey }
}
