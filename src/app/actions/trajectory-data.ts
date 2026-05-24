'use server'

/**
 * Server action: getPersonTrajectory.
 *
 * Returns a TrajectoryResult for the person identified by the given
 * campaign_participant. The person is resolved via person_key, then all
 * sibling campaign_participants in the same client are gathered, their
 * completed sessions loaded, and scores rolled into per-entity series
 * at the requested level.
 *
 * Level semantics (see spec §"The trajectory query"):
 *   - construct: only construct-scored sessions contribute. Scores
 *     for factor-scored sessions are skipped at this level.
 *   - factor:    only factor-scored sessions contribute. Construct-
 *     scored sessions are skipped at this level (no up-rollup in v1).
 *   - dimension: both source levels contribute, rolled up to the
 *     dimension via factors.dimension_id or assessment_constructs.dimension_id.
 *
 * The "no cross-level up/down rollup" simplification is documented in
 * the spec under Risks; future work adds cross-level handling alongside
 * the reliability / norms layer.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import {
  AuthorizationError,
  requireParticipantAccess,
} from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'
import { rollupChildren } from '@/lib/comparison/rollup-scores'
import { computeAttemptOrdinals } from '@/lib/comparison/session-resolution'
import {
  computeDeltas,
  computeTrajectorySummary,
  emptyTrajectorySummary,
} from '@/lib/trajectory/rollup'
import type {
  TrajectoryAssessmentRef,
  TrajectoryLevel,
  TrajectoryLinkedParticipant,
  TrajectoryPoint,
  TrajectoryResult,
  TrajectorySeries,
} from '@/lib/trajectory/types'

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export async function getPersonTrajectory(
  campaignParticipantId: string,
  options: {
    level: TrajectoryLevel
    assessmentIds?: string[]
  },
): Promise<TrajectoryResult> {
  await requireParticipantAccess(campaignParticipantId)
  const identity = await loadPersonIdentity(campaignParticipantId)
  const db = createAdminClient()

  // 1. Linked participants — every cp sharing the person_key within the client.
  const linkedParticipants = await loadLinkedParticipants(db, identity)
  if (linkedParticipants.length === 0) {
    return emptyResult(identity, options.level)
  }
  const cpIds = linkedParticipants.map((p) => p.campaignParticipantId)

  // 2. Completed sessions for those cps (optionally filtered by assessment).
  const sessions = await loadCompletedSessions(db, cpIds, options.assessmentIds)
  if (sessions.length === 0) {
    return {
      ...emptyResult(identity, options.level),
      linkedParticipants,
    }
  }

  // 3. Per-(cp, assessment) attempt ordinals, computed across the FULL session
  //    list of those cps so attempt numbers reflect history correctly.
  const allSessionsForOrdinals = await loadAllSessionsForCps(db, cpIds)
  const attemptByPair = computeAttemptOrdinals(allSessionsForOrdinals)

  // 4. Assessment metadata (titles, scoring_level).
  const assessmentIds = [...new Set(sessions.map((s) => s.assessment_id))]
  const assessments = await loadAssessments(db, assessmentIds)
  const assessmentById = new Map(assessments.map((a) => [a.id, a]))

  // 5. Scores keyed by session.
  const sessionIds = sessions.map((s) => s.id)
  const scoresBySession = await loadScores(db, sessionIds)

  // 6. Taxonomy for entities touched by those scores at the requested level.
  const taxonomy = await loadTaxonomyForLevel(db, scoresBySession, assessmentById, options.level)

  // 7. Build per-entity series.
  const series = buildSeries({
    level: options.level,
    sessions,
    scoresBySession,
    assessmentById,
    taxonomy,
    linkedParticipants,
    attemptByPair,
  })

  // 8. Assessments-touched chips (independent of level — show what the
  //    person has actually attempted).
  const assessmentsTouched: TrajectoryAssessmentRef[] = assessments.map((a) => ({
    assessmentId: a.id,
    assessmentName: a.title,
    sessionCount: sessions.filter((s) => s.assessment_id === a.id).length,
  }))

  return {
    personKey: identity.personKey,
    clientId: identity.clientId,
    displayName: identity.displayName,
    primaryEmail: identity.primaryEmail,
    level: options.level,
    linkedParticipants,
    assessmentsTouched,
    series,
    summary: computeTrajectorySummary(series),
  }
}

// ---------------------------------------------------------------------------
// Identity + loaders
// ---------------------------------------------------------------------------

type PersonIdentity = {
  personKey: string
  clientId: string
  displayName: string
  primaryEmail: string
}

async function loadPersonIdentity(participantId: string): Promise<PersonIdentity> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('campaign_participants')
    .select('id, email, first_name, last_name, person_key, campaigns!inner(client_id)')
    .eq('id', participantId)
    .single()

  if (error || !data) {
    throw new AuthorizationError('Participant not found.')
  }
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns[0] : data.campaigns
  const clientId = campaigns?.client_id ? String(campaigns.client_id) : null
  if (!clientId) {
    throw new AuthorizationError('Participant has no client context.')
  }

  const first = (data.first_name as string | null) ?? ''
  const last = (data.last_name as string | null) ?? ''
  const displayName = `${first} ${last}`.trim() || String(data.email)

  return {
    personKey: String(data.person_key),
    clientId,
    displayName,
    primaryEmail: String(data.email),
  }
}

type LinkedCpRow = {
  id: string
  campaign_id: string
  email: string
  first_name: string | null
  last_name: string | null
  status: string
  created_at: string
  campaigns: { title: string; client_id: string } | { title: string; client_id: string }[] | null
  participant_sessions: { id: string; status: string }[] | null
}

async function loadLinkedParticipants(
  db: ReturnType<typeof createAdminClient>,
  identity: PersonIdentity,
): Promise<TrajectoryLinkedParticipant[]> {
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
    throwActionError('getPersonTrajectory', 'Unable to load linked participants.', error)
  }

  const rows = (data ?? []) as LinkedCpRow[]
  // Defence in depth: filter out any cross-client rows even though by model
  // they cannot exist.
  return rows
    .filter((row) => {
      const c = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns
      return c?.client_id && String(c.client_id) === identity.clientId
    })
    .map((row) => {
      const c = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns
      const sessions = row.participant_sessions ?? []
      const completed = sessions.filter((s) => s.status === 'completed').length
      return {
        campaignParticipantId: String(row.id),
        campaignId: String(row.campaign_id),
        campaignTitle: c?.title ? String(c.title) : 'Unknown',
        email: String(row.email),
        firstName: row.first_name,
        lastName: row.last_name,
        status: String(row.status),
        completedSessionCount: completed,
        createdAt: String(row.created_at),
      }
    })
}

type SessionRow = {
  id: string
  campaign_participant_id: string
  campaign_id: string
  assessment_id: string
  status: string
  started_at: string | null
  completed_at: string | null
}

async function loadCompletedSessions(
  db: ReturnType<typeof createAdminClient>,
  cpIds: string[],
  assessmentIds: string[] | undefined,
): Promise<SessionRow[]> {
  let q = db
    .from('participant_sessions')
    .select('id, campaign_participant_id, campaign_id, assessment_id, status, started_at, completed_at')
    .in('campaign_participant_id', cpIds)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true })

  if (assessmentIds && assessmentIds.length > 0) {
    q = q.in('assessment_id', assessmentIds)
  }

  const { data, error } = await q
  if (error) throwActionError('getPersonTrajectory', 'Unable to load sessions.', error)
  return (data ?? []) as SessionRow[]
}

/** Loads ALL sessions for the cp list (any status), used for attempt ordinals. */
async function loadAllSessionsForCps(
  db: ReturnType<typeof createAdminClient>,
  cpIds: string[],
): Promise<{ id: string; campaign_participant_id: string; assessment_id: string; status: string; started_at: string | null; completed_at: string | null }[]> {
  const { data, error } = await db
    .from('participant_sessions')
    .select('id, campaign_participant_id, assessment_id, status, started_at, completed_at')
    .in('campaign_participant_id', cpIds)
  if (error) {
    throwActionError('getPersonTrajectory', 'Unable to load session history.', error)
  }
  return data ?? []
}

type AssessmentRow = {
  id: string
  title: string
  scoring_level: 'factor' | 'construct'
}

async function loadAssessments(
  db: ReturnType<typeof createAdminClient>,
  assessmentIds: string[],
): Promise<AssessmentRow[]> {
  if (assessmentIds.length === 0) return []
  const { data, error } = await db
    .from('assessments')
    .select('id, title, scoring_level')
    .in('id', assessmentIds)
  if (error) throwActionError('getPersonTrajectory', 'Unable to load assessments.', error)
  return (data ?? []) as AssessmentRow[]
}

type ScoreRow = {
  session_id: string
  factor_id: string | null
  construct_id: string | null
  scaled_score: number | string | null
  raw_score: number | string | null
  percentile: number | string | null
}

/**
 * Returns a map: session_id → array of scores. We deliberately keep one row
 * per (session, entity) rather than collapsing — the buildSeries step decides
 * which side (factor or construct) to consume based on the requested level.
 */
async function loadScores(
  db: ReturnType<typeof createAdminClient>,
  sessionIds: string[],
): Promise<Map<string, ScoreRow[]>> {
  if (sessionIds.length === 0) return new Map()
  const { data, error } = await db
    .from('participant_scores')
    .select('session_id, factor_id, construct_id, scaled_score, raw_score, percentile')
    .in('session_id', sessionIds)
  if (error) throwActionError('getPersonTrajectory', 'Unable to load scores.', error)

  const out = new Map<string, ScoreRow[]>()
  for (const row of (data ?? []) as ScoreRow[]) {
    const bucket = out.get(row.session_id) ?? []
    bucket.push(row)
    out.set(row.session_id, bucket)
  }
  return out
}

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

type TaxonomyEntity = {
  id: string
  name: string
  level: TrajectoryLevel
  parentId: string | null
  parentName: string | null
  additionalParentIds: string[]
}

type TaxonomyMaps = {
  /** Entities at the REQUESTED level, keyed by entity id. */
  entitiesByLevel: Map<string, TaxonomyEntity>
  /** For dimension rollup: maps a factor id → dimension id, or construct id → dimension id. */
  parentDimensionByEntity: Map<string, { id: string; name: string }>
}

async function loadTaxonomyForLevel(
  db: ReturnType<typeof createAdminClient>,
  scoresBySession: Map<string, ScoreRow[]>,
  assessmentById: Map<string, AssessmentRow>,
  level: TrajectoryLevel,
): Promise<TaxonomyMaps> {
  // Collect referenced ids by scoring level.
  const factorIds = new Set<string>()
  const constructIds = new Set<string>()

  for (const [, rows] of scoresBySession) {
    for (const r of rows) {
      if (r.factor_id) factorIds.add(r.factor_id)
      if (r.construct_id) constructIds.add(r.construct_id)
    }
  }

  const entitiesByLevel = new Map<string, TaxonomyEntity>()
  const parentDimensionByEntity = new Map<string, { id: string; name: string }>()

  // For dimension rollup we need entity → dimension lookups for BOTH sides.
  // Factor → dimension via factors.dimension_id (direct FK).
  if (factorIds.size > 0) {
    const { data: factorRows, error } = await db
      .from('factors')
      .select('id, name, dimension_id, dimensions(id, name)')
      .in('id', [...factorIds])
    if (error) {
      throwActionError('getPersonTrajectory', 'Unable to load factor taxonomy.', error)
    }
    for (const row of (factorRows ?? []) as FactorRow[]) {
      const dim = unwrap(row.dimensions)
      if (level === 'factor') {
        entitiesByLevel.set(String(row.id), {
          id: String(row.id),
          name: String(row.name),
          level: 'factor',
          parentId: dim?.id ?? null,
          parentName: dim?.name ?? null,
          additionalParentIds: [],
        })
      }
      if (dim) {
        parentDimensionByEntity.set(String(row.id), { id: dim.id, name: dim.name })
      }
    }
  }

  // Construct → dimension via assessment_constructs.dimension_id (denormalised).
  // We resolve dimension_id per (construct, assessment) pair because the same
  // construct may appear under different dimensions in different assessments;
  // for trajectory we pick any one consistent dimension by collapsing duplicates.
  if (constructIds.size > 0) {
    // Load construct names regardless of level.
    const { data: constructRows, error: cErr } = await db
      .from('constructs')
      .select('id, name')
      .in('id', [...constructIds])
    if (cErr) {
      throwActionError('getPersonTrajectory', 'Unable to load construct taxonomy.', cErr)
    }
    const constructNameById = new Map(
      ((constructRows ?? []) as { id: string; name: string }[]).map((r) => [String(r.id), String(r.name)]),
    )

    // Map construct → dimension via assessment_constructs.
    const { data: acRows, error: acErr } = await db
      .from('assessment_constructs')
      .select('construct_id, dimension_id, dimensions(id, name)')
      .in('construct_id', [...constructIds])
    if (acErr) {
      throwActionError('getPersonTrajectory', 'Unable to load assessment_constructs.', acErr)
    }
    for (const row of (acRows ?? []) as AssessmentConstructLite[]) {
      const dim = unwrap(row.dimensions)
      if (dim && !parentDimensionByEntity.has(String(row.construct_id))) {
        parentDimensionByEntity.set(String(row.construct_id), { id: dim.id, name: dim.name })
      }
    }

    if (level === 'construct') {
      // Resolve construct → factor via factor_constructs. The relation is
      // many-to-many: a construct can sit under multiple factors. The first
      // factor encountered becomes the primary parent (drives breadcrumb +
      // matrix grouping); the rest go on additionalParentIds so the drill
      // from any of those factors still surfaces this construct.
      const { data: fcRows, error: fcErr } = await db
        .from('factor_constructs')
        .select('construct_id, factor_id, factors(id, name)')
        .in('construct_id', [...constructIds])
      if (fcErr) {
        throwActionError('getPersonTrajectory', 'Unable to load factor_constructs.', fcErr)
      }
      const factorParentsByConstruct = new Map<string, { id: string; name: string }[]>()
      for (const row of (fcRows ?? []) as FactorConstructLite[]) {
        const f = unwrap(row.factors)
        if (!f) continue
        const cid = String(row.construct_id)
        const entry = { id: String(f.id), name: String(f.name) }
        const list = factorParentsByConstruct.get(cid) ?? []
        if (!list.some((x) => x.id === entry.id)) list.push(entry)
        factorParentsByConstruct.set(cid, list)
      }

      for (const id of constructIds) {
        const factorParents = factorParentsByConstruct.get(id) ?? []
        const primary = factorParents[0] ?? null
        const additional = factorParents.slice(1).map((p) => p.id)
        const dimFallback = primary ? null : (parentDimensionByEntity.get(id) ?? null)
        entitiesByLevel.set(id, {
          id,
          name: constructNameById.get(id) ?? id,
          level: 'construct',
          parentId: primary?.id ?? dimFallback?.id ?? null,
          parentName: primary?.name ?? dimFallback?.name ?? null,
          additionalParentIds: additional,
        })
      }
    }
  }

  // For the dimension level, the entities ARE the dimensions themselves.
  if (level === 'dimension') {
    const dimensionIds = new Set<string>()
    for (const v of parentDimensionByEntity.values()) dimensionIds.add(v.id)
    if (dimensionIds.size > 0) {
      const { data: dimRows, error } = await db
        .from('dimensions')
        .select('id, name')
        .in('id', [...dimensionIds])
      if (error) {
        throwActionError('getPersonTrajectory', 'Unable to load dimension taxonomy.', error)
      }
      for (const row of (dimRows ?? []) as { id: string; name: string }[]) {
        entitiesByLevel.set(String(row.id), {
          id: String(row.id),
          name: String(row.name),
          level: 'dimension',
          parentId: null,
          parentName: null,
          additionalParentIds: [],
        })
      }
    }
  }

  // assessmentById is only consulted indirectly through scoring_level via
  // the buildSeries step; the taxonomy itself is assessment-agnostic.
  void assessmentById

  return { entitiesByLevel, parentDimensionByEntity }
}

type FactorRow = {
  id: string
  name: string
  dimension_id: string | null
  dimensions: { id: string; name: string } | { id: string; name: string }[] | null
}
type AssessmentConstructLite = {
  construct_id: string
  dimension_id: string | null
  dimensions: { id: string; name: string } | { id: string; name: string }[] | null
}
type FactorConstructLite = {
  construct_id: string
  factor_id: string | null
  factors: { id: string; name: string } | { id: string; name: string }[] | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

// ---------------------------------------------------------------------------
// Series assembly
// ---------------------------------------------------------------------------

type BuildSeriesInput = {
  level: TrajectoryLevel
  sessions: SessionRow[]
  scoresBySession: Map<string, ScoreRow[]>
  assessmentById: Map<string, AssessmentRow>
  taxonomy: TaxonomyMaps
  linkedParticipants: TrajectoryLinkedParticipant[]
  attemptByPair: Map<string, number>
}

function buildSeries(input: BuildSeriesInput): TrajectorySeries[] {
  const cpById = new Map(input.linkedParticipants.map((p) => [p.campaignParticipantId, p]))

  // Stable mapping for joining (cp -> campaign title) on each point.
  const campaignTitleByCp = new Map(
    input.linkedParticipants.map((p) => [p.campaignParticipantId, p.campaignTitle]),
  )

  // Group points by entity id at the requested level.
  const pointsByEntity = new Map<string, TrajectoryPoint[]>()

  for (const session of input.sessions) {
    const assessment = input.assessmentById.get(session.assessment_id)
    if (!assessment) continue
    if (!session.completed_at) continue // safety — already filtered to completed

    const scores = input.scoresBySession.get(session.id) ?? []
    const cp = cpById.get(session.campaign_participant_id)
    const attemptKey = `${session.campaign_participant_id}:${session.assessment_id}:${session.id}`
    const attemptNumber = input.attemptByPair.get(attemptKey) ?? 1

    const basePoint = {
      sessionId: session.id,
      campaignId: session.campaign_id,
      campaignTitle: campaignTitleByCp.get(session.campaign_participant_id) ?? cp?.campaignTitle ?? '',
      assessmentId: assessment.id,
      assessmentName: assessment.title,
      completedAt: session.completed_at!,
      attemptNumber,
      reliability: null,
      normGroupId: null,
      normGroupName: null,
    }

    if (input.level === 'construct') {
      // Only construct-scored sessions contribute native construct scores.
      if (assessment.scoring_level !== 'construct') continue
      for (const s of scores) {
        if (!s.construct_id) continue
        const taxonomy = input.taxonomy.entitiesByLevel.get(s.construct_id)
        if (!taxonomy) continue
        addPoint(pointsByEntity, s.construct_id, {
          ...basePoint,
          ...numericTriple(s),
        })
      }
    } else if (input.level === 'factor') {
      if (assessment.scoring_level !== 'factor') continue
      for (const s of scores) {
        if (!s.factor_id) continue
        const taxonomy = input.taxonomy.entitiesByLevel.get(s.factor_id)
        if (!taxonomy) continue
        addPoint(pointsByEntity, s.factor_id, {
          ...basePoint,
          ...numericTriple(s),
        })
      }
    } else {
      // dimension: roll up either factors or constructs to their parent dimension
      // for this session.
      const childrenByDimension = new Map<
        string,
        { score: number | null; weight: number }[]
      >()
      for (const s of scores) {
        const childId = assessment.scoring_level === 'factor' ? s.factor_id : s.construct_id
        if (!childId) continue
        const parent = input.taxonomy.parentDimensionByEntity.get(childId)
        if (!parent) continue
        const value = numericOrNull(s.scaled_score)
        const bucket = childrenByDimension.get(parent.id) ?? []
        bucket.push({ score: value, weight: 1 })
        childrenByDimension.set(parent.id, bucket)
      }
      for (const [dimensionId, children] of childrenByDimension) {
        const taxonomy = input.taxonomy.entitiesByLevel.get(dimensionId)
        if (!taxonomy) continue
        const rolledScaled = rollupChildren(
          children.map((c) => ({ childId: '', score: c.score, weight: c.weight })),
        )
        addPoint(pointsByEntity, dimensionId, {
          ...basePoint,
          scaledScore: rolledScaled,
          rawScore: null,
          percentile: null,
        })
      }
    }
  }

  // Sort points within each series by completed_at; compute deltas.
  const series: TrajectorySeries[] = []
  for (const [entityId, points] of pointsByEntity) {
    const taxonomy = input.taxonomy.entitiesByLevel.get(entityId)
    if (!taxonomy) continue
    points.sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    series.push({
      entityId,
      entityName: taxonomy.name,
      level: taxonomy.level,
      parentId: taxonomy.parentId,
      parentName: taxonomy.parentName,
      additionalParentIds: taxonomy.additionalParentIds,
      points,
      deltas: computeDeltas(points),
    })
  }

  // Stable ordering: by parent then name.
  series.sort((a, b) => {
    const p = (a.parentName ?? '').localeCompare(b.parentName ?? '')
    if (p !== 0) return p
    return a.entityName.localeCompare(b.entityName)
  })

  return series
}

function addPoint(
  pointsByEntity: Map<string, TrajectoryPoint[]>,
  entityId: string,
  point: TrajectoryPoint,
) {
  const bucket = pointsByEntity.get(entityId) ?? []
  bucket.push(point)
  pointsByEntity.set(entityId, bucket)
}

function numericTriple(row: ScoreRow): {
  scaledScore: number | null
  rawScore: number | null
  percentile: number | null
} {
  return {
    scaledScore: numericOrNull(row.scaled_score),
    rawScore: numericOrNull(row.raw_score),
    percentile: numericOrNull(row.percentile),
  }
}

function numericOrNull(v: number | string | null): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// Empty result helper
// ---------------------------------------------------------------------------

function emptyResult(identity: PersonIdentity, level: TrajectoryLevel): TrajectoryResult {
  return {
    personKey: identity.personKey,
    clientId: identity.clientId,
    displayName: identity.displayName,
    primaryEmail: identity.primaryEmail,
    level,
    linkedParticipants: [],
    assessmentsTouched: [],
    series: [],
    summary: emptyTrajectorySummary(),
  }
}
