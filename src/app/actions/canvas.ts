'use server'

/**
 * Server action: getComparisonCanvas.
 *
 * Multi-person generalisation of getPersonTrajectory. Given the campaign
 * participants a user selected, resolve each to a person (person_key),
 * gather every linked campaign participation per person within the same
 * client, and return per-person score series at BOTH taxonomy layers —
 * dimensions and factors — plus the per-session overall composite.
 *
 * The canvas (hero chart + breakdown list) consumes this one payload for
 * every (people × time) setup; see the v4 spec.
 */

import { createClient } from '@/lib/supabase/server'
import { requireParticipantAccess } from '@/lib/auth/authorization'
import { getAggregateOnlyCampaignIdSet } from '@/lib/dal/campaigns'
import { resolveSessionActor } from '@/lib/auth/actor'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { throwActionError } from '@/lib/security/action-errors'
import { rollupChildren } from '@/lib/comparison/rollup-scores'
import { computePersonAttemptOrdinals } from '@/lib/comparison/session-resolution'
import { canvasRequestSchema, canvasViewStateSchema } from '@/lib/validations/canvas'
import { canvasTitle } from '@/lib/canvas/summarize'
import {
  OVERALL_ID,
  type CanvasEntity,
  type CanvasPerson,
  type CanvasPoint,
  type CanvasResult,
  type CanvasSeries,
  type CanvasViewState,
} from '@/lib/canvas/types'

type Db = Awaited<ReturnType<typeof createClient>>

type EntryCpRow = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  person_key: string | null
  campaigns: { client_id: string } | { client_id: string }[] | null
}

type LinkedCpRow = {
  id: string
  person_key: string | null
  campaigns: { client_id: string } | { client_id: string }[] | null
}

type SessionRow = {
  id: string
  campaign_participant_id: string
  campaign_id: string | null
  assessment_id: string
  status: string
  started_at: string | null
  completed_at: string | null
  composite_score: number | string | null
}

type ScoreRow = {
  session_id: string
  factor_id: string | null
  scaled_score: number | string | null
  confidence_interval_lower: number | string | null
  confidence_interval_upper: number | string | null
}

type FactorRow = {
  id: string
  name: string
  dimension_id: string | null
  dimensions:
    | { id: string; name: string; display_order: number | null }
    | { id: string; name: string; display_order: number | null }[]
    | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function numericOrNull(v: number | string | null): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export async function getComparisonCanvas(
  campaignParticipantIds: string[],
): Promise<CanvasResult> {
  const parsed = canvasRequestSchema.safeParse({ campaignParticipantIds })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid canvas request.')
  }
  const cpIds = parsed.data.campaignParticipantIds

  const accesses = await Promise.all(cpIds.map((id) => requireParticipantAccess(id)))
  const viewerIsPlatformAdmin = accesses[0]?.scope.isPlatformAdmin ?? false
  const db = await createClient()

  // 1. Entry participants → deduped people, preserving selection order.
  const entryRows = await loadEntryCps(db, cpIds)
  const entryById = new Map(entryRows.map((r) => [r.id, r]))
  const people: CanvasPerson[] = []
  const clientByPerson = new Map<string, string | null>()
  for (const cpId of cpIds) {
    const row = entryById.get(cpId)
    if (!row) continue
    const personKey = row.person_key ?? row.id
    if (people.some((p) => p.personKey === personKey)) continue
    const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.email
    people.push({
      personKey,
      entryCpId: row.id,
      displayName: name,
      email: row.email,
      completedSessionCount: 0,
      firstCompletedAt: null,
      lastCompletedAt: null,
    })
    clientByPerson.set(personKey, unwrap(row.campaigns)?.client_id ?? null)
  }
  if (people.length === 0) {
    return { people: [], entities: [], series: [], clientId: null }
  }
  const clientId = clientByPerson.get(people[0].personKey) ?? null

  // 2. Every linked participation per person (same person_key, same client).
  const personKeyByCp = await loadLinkedCpMap(db, people, clientByPerson)
  for (const cpId of cpIds) {
    const row = entryById.get(cpId)
    if (row) personKeyByCp.set(row.id, row.person_key ?? row.id)
  }
  const allCpIds = [...personKeyByCp.keys()]

  // 3. Sessions: completed ones feed the series; the full set feeds
  //    per-person attempt ordinals. Linked participations can reach into
  //    other campaigns, so aggregate-only exclusion happens here at the
  //    session level, not just on the entry participants.
  let allSessions = await loadSessions(db, allCpIds)
  if (!viewerIsPlatformAdmin) {
    const aggregateOnly = await getAggregateOnlyCampaignIdSet(db, [
      ...new Set(
        allSessions.map((s) => s.campaign_id).filter((id): id is string => !!id),
      ),
    ])
    if (aggregateOnly.size > 0) {
      allSessions = allSessions.filter(
        (s) => !s.campaign_id || !aggregateOnly.has(s.campaign_id),
      )
    }
  }
  const completed = allSessions
    .filter((s) => s.status === 'completed' && s.completed_at)
    .sort((a, b) => (a.completed_at as string).localeCompare(b.completed_at as string))
  const attemptByKey = computePersonAttemptOrdinals(allSessions, personKeyByCp)

  for (const p of people) {
    const own = completed.filter((s) => personKeyByCp.get(s.campaign_participant_id) === p.personKey)
    p.completedSessionCount = own.length
    p.firstCompletedAt = own[0]?.completed_at ?? null
    p.lastCompletedAt = own[own.length - 1]?.completed_at ?? null
  }

  if (completed.length === 0) {
    return { people, entities: [], series: [], clientId }
  }

  // 4. Assessment + campaign titles, and scores.
  const assessmentNameById = await loadAssessmentNames(db, [
    ...new Set(completed.map((s) => s.assessment_id)),
  ])
  const campaignTitleById = await loadCampaignTitles(db, [
    ...new Set(completed.map((s) => s.campaign_id).filter((id): id is string => !!id)),
  ])
  const scoresBySession = await loadScores(db, completed.map((s) => s.id))

  // 5. Taxonomy for every factor that appears in the scores — both layers.
  const factorIds = new Set<string>()
  for (const rows of scoresBySession.values()) {
    for (const r of rows) if (r.factor_id) factorIds.add(r.factor_id)
  }
  const { entities, dimensionByFactor } = await loadTaxonomy(db, [...factorIds])

  // 6. Series assembly: factor level, dimension rollup, and composite,
  //    per (person, session).
  const pointsBySeries = new Map<string, CanvasPoint[]>()
  const SERIES_KEY_SEP = '|'
  const push = (personKey: string, entityId: string, point: CanvasPoint) => {
    const key = `${personKey}${SERIES_KEY_SEP}${entityId}`
    const bucket = pointsBySeries.get(key) ?? []
    bucket.push(point)
    pointsBySeries.set(key, bucket)
  }

  for (const session of completed) {
    const personKey = personKeyByCp.get(session.campaign_participant_id)
    if (!personKey) continue
    const scores = scoresBySession.get(session.id) ?? []
    const attemptNumber =
      attemptByKey.get(`${personKey}:${session.assessment_id}:${session.id}`) ?? 1
    const base = {
      sessionId: session.id,
      completedAt: session.completed_at as string,
      assessmentId: session.assessment_id,
      assessmentName: assessmentNameById.get(session.assessment_id) ?? 'Assessment',
      campaignId: session.campaign_id ?? '',
      campaignTitle: session.campaign_id
        ? (campaignTitleById.get(session.campaign_id) ?? '')
        : '',
      attemptNumber,
      ciLower: null as number | null,
      ciUpper: null as number | null,
    }

    const byDimension = new Map<string, { score: number | null; weight: number }[]>()
    const allFactorScores: { score: number | null; weight: number }[] = []
    for (const s of scores) {
      if (!s.factor_id) continue
      const value = numericOrNull(s.scaled_score)
      if (value !== null) {
        push(personKey, s.factor_id, {
          ...base,
          value,
          ciLower: numericOrNull(s.confidence_interval_lower),
          ciUpper: numericOrNull(s.confidence_interval_upper),
        })
      }
      const dim = dimensionByFactor.get(s.factor_id)
      if (dim) {
        const bucket = byDimension.get(dim) ?? []
        bucket.push({ score: value, weight: 1 })
        byDimension.set(dim, bucket)
      }
      allFactorScores.push({ score: value, weight: 1 })
    }
    for (const [dimensionId, children] of byDimension) {
      const rolled = rollupChildren(children.map((c) => ({ childId: '', ...c })))
      if (rolled !== null) push(personKey, dimensionId, { ...base, value: rolled })
    }
    // Composite: the stored session composite wins; mean of factor scores is
    // the fallback for sessions predating the composite_score backfill.
    const composite =
      numericOrNull(session.composite_score) ??
      rollupChildren(allFactorScores.map((c) => ({ childId: '', ...c })))
    if (composite !== null) push(personKey, OVERALL_ID, { ...base, value: composite })
  }

  const series: CanvasSeries[] = [...pointsBySeries.entries()].map(([key, points]) => {
    const [personKey, entityId] = key.split(SERIES_KEY_SEP)
    points.sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    return { personKey, entityId, points }
  })

  return { people, entities, series, clientId }
}

/**
 * Freeze the current canvas into a comparison_snapshots row for the growth
 * report. The snapshot is immutable: the PDF rendered from it never drifts
 * as new results arrive. Returns the snapshot id for the PDF endpoint.
 */
export async function createTrajectorySnapshot(input: {
  campaignParticipantIds: string[]
  viewState?: CanvasViewState
}): Promise<{ snapshotId: string; title: string }> {
  const parsed = canvasRequestSchema.safeParse({
    campaignParticipantIds: input.campaignParticipantIds,
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid snapshot request.')
  }
  const viewParsed = canvasViewStateSchema.safeParse(input.viewState ?? {})
  const viewState = viewParsed.success ? viewParsed.data : {}

  // Authorisation happens inside getComparisonCanvas (per participant id).
  const canvas = await getComparisonCanvas(parsed.data.campaignParticipantIds)
  if (canvas.people.length === 0) {
    throw new Error('Nothing to snapshot — no people resolved from the selection.')
  }

  const actor = await resolveSessionActor()
  if (!actor) throw new Error('Not authenticated.')

  const db = await createClient()
  const title = canvasTitle(canvas.people)
  const { data, error } = await db
    .from('comparison_snapshots')
    .insert({
      owner_id: actor.id,
      client_id: canvas.clientId,
      title,
      canvas,
      view_state: viewState,
    })
    .select('id')
    .single()
  if (error || !data) {
    throwActionError('createTrajectorySnapshot', 'Unable to save the snapshot.', error)
  }

  await logAuditEvent({
    actorProfileId: actor.id,
    eventType: 'trajectory.snapshot_created',
    targetTable: 'comparison_snapshots',
    targetId: String(data!.id),
    clientId: canvas.clientId,
    metadata: {
      personCount: canvas.people.length,
      title,
    },
  })

  return { snapshotId: String(data!.id), title }
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

async function loadEntryCps(db: Db, cpIds: string[]): Promise<EntryCpRow[]> {
  const { data, error } = await db
    .from('campaign_participants')
    .select('id, email, first_name, last_name, person_key, campaigns!inner(client_id)')
    .in('id', cpIds)
    .is('deleted_at', null)
  if (error) throwActionError('getComparisonCanvas', 'Unable to load participants.', error)
  return (data ?? []) as EntryCpRow[]
}

/**
 * Map of cp id → person_key covering every participation of the selected
 * people. Cross-client rows are excluded even though the person_key model
 * already prevents them (defence in depth, mirroring getPersonTrajectory).
 */
async function loadLinkedCpMap(
  db: Db,
  people: CanvasPerson[],
  clientByPerson: Map<string, string | null>,
): Promise<Map<string, string>> {
  const personKeys = people
    .map((p) => p.personKey)
    .filter((k) => !people.some((p) => p.entryCpId === k))
  const out = new Map<string, string>()
  if (personKeys.length === 0) return out

  const { data, error } = await db
    .from('campaign_participants')
    .select('id, person_key, campaigns!inner(client_id)')
    .in('person_key', personKeys)
    .is('deleted_at', null)
  if (error) {
    throwActionError('getComparisonCanvas', 'Unable to load linked participants.', error)
  }
  for (const row of (data ?? []) as LinkedCpRow[]) {
    if (!row.person_key) continue
    const expectedClient = clientByPerson.get(row.person_key)
    const rowClient = unwrap(row.campaigns)?.client_id ?? null
    if (expectedClient && rowClient && expectedClient !== rowClient) continue
    out.set(row.id, row.person_key)
  }
  return out
}

async function loadSessions(db: Db, cpIds: string[]): Promise<SessionRow[]> {
  if (cpIds.length === 0) return []
  const { data, error } = await db
    .from('participant_sessions')
    .select(
      'id, campaign_participant_id, campaign_id, assessment_id, status, started_at, completed_at, composite_score',
    )
    .in('campaign_participant_id', cpIds)
  if (error) throwActionError('getComparisonCanvas', 'Unable to load sessions.', error)
  return (data ?? []) as SessionRow[]
}

async function loadAssessmentNames(db: Db, assessmentIds: string[]): Promise<Map<string, string>> {
  if (assessmentIds.length === 0) return new Map()
  const { data, error } = await db.from('assessments').select('id, title').in('id', assessmentIds)
  if (error) throwActionError('getComparisonCanvas', 'Unable to load assessments.', error)
  return new Map(
    ((data ?? []) as { id: string; title: string }[]).map((a) => [a.id, a.title]),
  )
}

async function loadCampaignTitles(db: Db, campaignIds: string[]): Promise<Map<string, string>> {
  if (campaignIds.length === 0) return new Map()
  const { data, error } = await db.from('campaigns').select('id, title').in('id', campaignIds)
  if (error) throwActionError('getComparisonCanvas', 'Unable to load campaigns.', error)
  return new Map(
    ((data ?? []) as { id: string; title: string }[]).map((c) => [c.id, c.title]),
  )
}

async function loadScores(db: Db, sessionIds: string[]): Promise<Map<string, ScoreRow[]>> {
  if (sessionIds.length === 0) return new Map()
  const { data, error } = await db
    .from('participant_scores')
    .select(
      'session_id, factor_id, scaled_score, confidence_interval_lower, confidence_interval_upper',
    )
    .in('session_id', sessionIds)
  if (error) throwActionError('getComparisonCanvas', 'Unable to load scores.', error)
  const out = new Map<string, ScoreRow[]>()
  for (const row of (data ?? []) as ScoreRow[]) {
    const bucket = out.get(row.session_id) ?? []
    bucket.push(row)
    out.set(row.session_id, bucket)
  }
  return out
}

async function loadTaxonomy(
  db: Db,
  factorIds: string[],
): Promise<{ entities: CanvasEntity[]; dimensionByFactor: Map<string, string> }> {
  if (factorIds.length === 0) return { entities: [], dimensionByFactor: new Map() }
  const { data, error } = await db
    .from('factors')
    .select('id, name, dimension_id, dimensions(id, name, display_order)')
    .in('id', factorIds)
  if (error) throwActionError('getComparisonCanvas', 'Unable to load taxonomy.', error)

  const entities: CanvasEntity[] = []
  const dimensionByFactor = new Map<string, string>()
  const seenDimensions = new Map<string, { name: string; displayOrder: number }>()
  for (const row of (data ?? []) as FactorRow[]) {
    const dim = unwrap(row.dimensions)
    entities.push({
      id: String(row.id),
      name: String(row.name),
      level: 'factor',
      parentId: dim ? String(dim.id) : null,
      // `factors` has no display_order column; the name tiebreak orders these.
      displayOrder: 0,
    })
    if (dim) {
      dimensionByFactor.set(String(row.id), String(dim.id))
      seenDimensions.set(String(dim.id), {
        name: String(dim.name),
        displayOrder: dim.display_order ?? 0,
      })
    }
  }
  // Carry the authored order onto the entity rather than relying on the order
  // they are pushed in: every consumer re-sorts (orderEntities, CanvasHero),
  // so insertion order here would be discarded.
  for (const [id, dim] of seenDimensions) {
    entities.push({
      id,
      name: dim.name,
      level: 'dimension',
      parentId: null,
      displayOrder: dim.displayOrder,
    })
  }
  return { entities, dimensionByFactor }
}
