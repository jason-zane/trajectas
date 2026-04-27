'use server'

import { createClient } from '@/lib/supabase/server'
import { requireParticipantAccess, requireSessionAccess } from '@/lib/auth/authorization'
import { rollupChildren } from '@/lib/comparison/rollup-scores'
import type {
  Column,
  ColumnGroup,
  ComparisonRequest,
  ComparisonResult,
  ComparisonRow,
  RowAssessment,
} from '@/lib/comparison/types'

export type EligibleAssessment = {
  assessmentId: string
  assessmentName: string
  completedSessionCount: number
}

type EmbeddedAssessment = { id: string; title: string }
type EligibleSessionRow = {
  assessment_id: string
  status: string
  assessments: EmbeddedAssessment | EmbeddedAssessment[] | null
}

function unwrapEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function getEligibleAssessmentsForParticipants(
  campaignParticipantIds: string[],
): Promise<EligibleAssessment[]> {
  if (campaignParticipantIds.length === 0) return []

  // Throws AuthorizationError on the first unauthorized id; we let it propagate.
  await Promise.all(campaignParticipantIds.map((id) => requireParticipantAccess(id)))

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('participant_sessions')
    .select('assessment_id, status, assessments(id, title)')
    .in('campaign_participant_id', campaignParticipantIds)
  if (error) throw error

  const counts = new Map<string, EligibleAssessment>()
  for (const row of ((data ?? []) as unknown as EligibleSessionRow[])) {
    const a = unwrapEmbedded(row.assessments)
    if (!a) continue
    const existing = counts.get(a.id) ?? {
      assessmentId: a.id,
      assessmentName: a.title,
      completedSessionCount: 0,
    }
    if (row.status === 'completed') existing.completedSessionCount += 1
    counts.set(a.id, existing)
  }
  return [...counts.values()].sort((a, b) =>
    a.assessmentName.localeCompare(b.assessmentName),
  )
}

// ---------------------------------------------------------------------------
// getSessionOptionsForRow
// ---------------------------------------------------------------------------

export type SessionOption = {
  sessionId: string
  assessmentId: string
  assessmentName: string
  attemptNumber: number
  startedAt: string
  status: string
}

type SessionOptionRow = {
  id: string
  assessment_id: string
  started_at: string | null
  status: string
  assessments: { title: string } | { title: string }[] | null
}

export async function getSessionOptionsForRow(
  campaignParticipantId: string,
  assessmentIds: string[],
): Promise<SessionOption[]> {
  if (assessmentIds.length === 0) return []
  await requireParticipantAccess(campaignParticipantId)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('participant_sessions')
    .select('id, assessment_id, started_at, status, assessments(title)')
    .eq('campaign_participant_id', campaignParticipantId)
    .in('assessment_id', assessmentIds)
    .order('started_at', { ascending: true })
  if (error) throw error

  const perAssessmentCounter = new Map<string, number>()
  return ((data ?? []) as unknown as SessionOptionRow[]).map((row) => {
    const next = (perAssessmentCounter.get(row.assessment_id) ?? 0) + 1
    perAssessmentCounter.set(row.assessment_id, next)
    return {
      sessionId: row.id,
      assessmentId: row.assessment_id,
      assessmentName: unwrapEmbedded(row.assessments)?.title ?? '',
      attemptNumber: next,
      startedAt: row.started_at ?? '',
      status: row.status,
    }
  })
}

// ---------------------------------------------------------------------------
// getComparisonMatrix
// ---------------------------------------------------------------------------

import {
  pickMostRecentCompleted,
  computeAttemptOrdinals,
  type SessionRow,
} from '@/lib/comparison/session-resolution'

type CampaignParticipantRow = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
}

type AssessmentMetaRow = {
  id: string
  title: string
  scoring_level: 'factor' | 'construct'
}

type FactorRow = {
  id: string
  name: string
  dimension_id: string | null
  dimensions: { id: string; name: string } | { id: string; name: string }[] | null
}

type AssessmentFactorRow = {
  factor_id: string
  factors: FactorRow | FactorRow[] | null
}

type AssessmentConstructRow = {
  construct_id: string
  dimension_id: string | null
  constructs: { id: string; name: string } | { id: string; name: string }[] | null
  dimensions: { id: string; name: string } | { id: string; name: string }[] | null
}

type ParticipantScoreRow = {
  participant_session_id: string
  factor_id: string | null
  construct_id: string | null
  scaled_score: number | string | null
}

export async function getComparisonMatrix(
  req: ComparisonRequest,
): Promise<ComparisonResult> {
  const cpIds = [...new Set(req.entries.map((e) => e.campaignParticipantId))]
  if (cpIds.length === 0) return { columns: [], rows: [] }

  await Promise.all(cpIds.map((id) => requireParticipantAccess(id)))
  const explicitSessionIds = req.entries.flatMap((e) =>
    Object.values(e.sessionIdsByAssessment ?? {}),
  )
  if (explicitSessionIds.length) {
    await Promise.all(explicitSessionIds.map((id) => requireSessionAccess(id)))
  }

  if (req.assessmentIds.length === 0) {
    // No assessments to materialise — still return identity rows so the UI can render them.
    return assembleEmptyResult(req, await loadCampaignParticipants(cpIds))
  }

  const supabase = await createClient()

  const [cpRows, sessionRows, columns] = await Promise.all([
    loadCampaignParticipants(cpIds),
    loadSessions(supabase, cpIds, req.assessmentIds),
    buildColumnGroups(supabase, req.assessmentIds),
  ])

  // Resolve session ids per (entry × assessment).
  type Resolved = { entryIndex: number; assessmentId: string; sessionId: string | null }
  const resolutions: Resolved[] = []
  req.entries.forEach((entry, idx) => {
    for (const aId of req.assessmentIds) {
      const explicit = entry.sessionIdsByAssessment?.[aId]
      if (explicit) {
        resolutions.push({ entryIndex: idx, assessmentId: aId, sessionId: explicit })
        continue
      }
      const pick = pickMostRecentCompleted(sessionRows, entry.campaignParticipantId, aId)
      resolutions.push({ entryIndex: idx, assessmentId: aId, sessionId: pick?.id ?? null })
    }
  })

  const sessionIds = resolutions
    .map((r) => r.sessionId)
    .filter((s): s is string => Boolean(s))
  const scoresBySession = sessionIds.length
    ? await loadParticipantScores(supabase, sessionIds)
    : new Map<string, Map<string, number>>()

  const attemptByPair = computeAttemptOrdinals(sessionRows)
  const cpById = new Map(cpRows.map((r) => [r.id, r] as const))

  const rows: ComparisonRow[] = req.entries.map((entry, idx) => {
    const cpId = entry.campaignParticipantId
    const cp = cpById.get(cpId)
    const perAssessment: RowAssessment[] = req.assessmentIds.map((aId) => {
      const res = resolutions.find((r) => r.entryIndex === idx && r.assessmentId === aId)!
      const session = res.sessionId
        ? sessionRows.find((s) => s.id === res.sessionId) ?? null
        : null
      const sScores = res.sessionId
        ? scoresBySession.get(res.sessionId) ?? new Map<string, number>()
        : new Map<string, number>()

      // Multiple ColumnGroups may share an assessmentId (one per dimension).
      // Populate every cell on every group that belongs to this assessment.
      const cells: Record<string, number | null> = {}
      const matchingGroups = columns.filter((g) => g.assessmentId === aId)
      for (const group of matchingGroups) {
        const childScores = group.children.map((c) => ({
          childId: c.id,
          score: sScores.has(c.id) ? sScores.get(c.id) ?? null : null,
          weight: 1,
        }))
        for (const c of group.children) {
          cells[c.id] = sScores.has(c.id) ? sScores.get(c.id) ?? null : null
        }
        cells[group.rollup.id] = rollupChildren(childScores)
      }

      return {
        assessmentId: aId,
        sessionId: res.sessionId,
        sessionStartedAt: session?.started_at ?? null,
        sessionStatus: session?.status ?? null,
        attemptNumber: res.sessionId
          ? attemptByPair.get(`${cpId}:${aId}:${res.sessionId}`) ?? null
          : null,
        cells,
      }
    })

    return {
      entryId: `${cpId}:${idx}`,
      campaignParticipantId: cpId,
      participantName: cp ? formatName(cp) : '',
      participantEmail: cp?.email ?? '',
      perAssessment,
    }
  })

  return { columns, rows }
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

async function loadCampaignParticipants(ids: string[]): Promise<CampaignParticipantRow[]> {
  if (ids.length === 0) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('campaign_participants')
    .select('id, email, first_name, last_name')
    .in('id', ids)
  if (error) throw error
  return (data ?? []) as CampaignParticipantRow[]
}

async function loadSessions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cpIds: string[],
  assessmentIds: string[],
): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('participant_sessions')
    .select('id, campaign_participant_id, assessment_id, status, started_at, completed_at')
    .in('campaign_participant_id', cpIds)
    .in('assessment_id', assessmentIds)
  if (error) throw error
  return (data ?? []) as SessionRow[]
}

async function loadParticipantScores(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionIds: string[],
): Promise<Map<string, Map<string, number>>> {
  const { data, error } = await supabase
    .from('participant_scores')
    .select('participant_session_id, factor_id, construct_id, scaled_score')
    .in('participant_session_id', sessionIds)
  if (error) throw error

  const out = new Map<string, Map<string, number>>()
  for (const row of (data ?? []) as ParticipantScoreRow[]) {
    const key = row.factor_id ?? row.construct_id
    if (!key || row.scaled_score === null) continue
    const value =
      typeof row.scaled_score === 'number' ? row.scaled_score : Number(row.scaled_score)
    if (!Number.isFinite(value)) continue
    const sessionMap = out.get(row.participant_session_id) ?? new Map<string, number>()
    sessionMap.set(key, Math.round(value))
    out.set(row.participant_session_id, sessionMap)
  }
  return out
}

async function buildColumnGroups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assessmentIds: string[],
): Promise<ColumnGroup[]> {
  const { data: aRows, error: aErr } = await supabase
    .from('assessments')
    .select('id, title, scoring_level')
    .in('id', assessmentIds)
  if (aErr) throw aErr

  const groups: ColumnGroup[] = []
  for (const a of (aRows ?? []) as AssessmentMetaRow[]) {
    if (a.scoring_level === 'construct') {
      groups.push(...(await constructLevelGroups(supabase, a)))
    } else {
      groups.push(...(await factorLevelGroups(supabase, a)))
    }
  }
  return groups
}

async function factorLevelGroups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assessment: AssessmentMetaRow,
): Promise<ColumnGroup[]> {
  const { data, error } = await supabase
    .from('assessment_factors')
    .select('factor_id, factors(id, name, dimension_id, dimensions(id, name))')
    .eq('assessment_id', assessment.id)
  if (error) throw error

  type DimBucket = { dim: Column; children: Column[] }
  const byDim = new Map<string, DimBucket>()
  // Keep a synthetic "no-dimension" bucket as a fallback so factors without a
  // dimension still surface — uses the assessment as the rollup label.
  let orphan: DimBucket | null = null

  for (const row of (data ?? []) as unknown as AssessmentFactorRow[]) {
    const f = unwrapEmbedded(row.factors)
    if (!f) continue
    const dim = unwrapEmbedded(f.dimensions)

    if (dim) {
      const bucket =
        byDim.get(dim.id) ??
        {
          dim: { id: dim.id, name: dim.name, level: 'dimension' as const, parentId: null },
          children: [],
        }
      bucket.children.push({ id: f.id, name: f.name, level: 'factor', parentId: dim.id })
      byDim.set(dim.id, bucket)
    } else {
      orphan ??= {
        dim: {
          id: `__assessment_${assessment.id}__rollup`,
          name: assessment.title,
          level: 'dimension',
          parentId: null,
        },
        children: [],
      }
      orphan.children.push({ id: f.id, name: f.name, level: 'factor', parentId: orphan.dim.id })
    }
  }

  const out: ColumnGroup[] = []
  for (const bucket of byDim.values()) {
    out.push({
      assessmentId: assessment.id,
      assessmentName: assessment.title,
      rollup: bucket.dim,
      children: bucket.children,
    })
  }
  if (orphan) {
    out.push({
      assessmentId: assessment.id,
      assessmentName: assessment.title,
      rollup: orphan.dim,
      children: orphan.children,
    })
  }
  return out
}

async function constructLevelGroups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assessment: AssessmentMetaRow,
): Promise<ColumnGroup[]> {
  const { data, error } = await supabase
    .from('assessment_constructs')
    .select('construct_id, dimension_id, constructs(id, name), dimensions(id, name)')
    .eq('assessment_id', assessment.id)
  if (error) throw error

  type DimBucket = { dim: Column; children: Column[] }
  const byDim = new Map<string, DimBucket>()
  let orphan: DimBucket | null = null

  for (const row of (data ?? []) as unknown as AssessmentConstructRow[]) {
    const c = unwrapEmbedded(row.constructs)
    if (!c) continue
    const dim = unwrapEmbedded(row.dimensions)

    if (dim) {
      const bucket =
        byDim.get(dim.id) ??
        {
          dim: { id: dim.id, name: dim.name, level: 'dimension' as const, parentId: null },
          children: [],
        }
      bucket.children.push({ id: c.id, name: c.name, level: 'construct', parentId: dim.id })
      byDim.set(dim.id, bucket)
    } else {
      orphan ??= {
        dim: {
          id: `__assessment_${assessment.id}__rollup`,
          name: assessment.title,
          level: 'dimension',
          parentId: null,
        },
        children: [],
      }
      orphan.children.push({ id: c.id, name: c.name, level: 'construct', parentId: orphan.dim.id })
    }
  }

  const out: ColumnGroup[] = []
  for (const bucket of byDim.values()) {
    out.push({
      assessmentId: assessment.id,
      assessmentName: assessment.title,
      rollup: bucket.dim,
      children: bucket.children,
    })
  }
  if (orphan) {
    out.push({
      assessmentId: assessment.id,
      assessmentName: assessment.title,
      rollup: orphan.dim,
      children: orphan.children,
    })
  }
  return out
}

function formatName(cp: CampaignParticipantRow): string {
  const name = `${cp.first_name ?? ''} ${cp.last_name ?? ''}`.trim()
  return name || cp.email
}

function assembleEmptyResult(
  req: ComparisonRequest,
  cpRows: CampaignParticipantRow[],
): ComparisonResult {
  const cpById = new Map(cpRows.map((r) => [r.id, r] as const))
  const rows: ComparisonRow[] = req.entries.map((entry, idx) => {
    const cp = cpById.get(entry.campaignParticipantId)
    return {
      entryId: `${entry.campaignParticipantId}:${idx}`,
      campaignParticipantId: entry.campaignParticipantId,
      participantName: cp ? formatName(cp) : '',
      participantEmail: cp?.email ?? '',
      perAssessment: [],
    }
  })
  return { columns: [], rows }
}
