// =============================================================================
// src/lib/reports/preview-entities.ts
// Shared loader used by both the server action (auth-gated) and the print
// route (token-gated). Produces PreviewEntity[] scoped to an assessment with
// pompScores from the seeded session (or synthScore fallback).
// =============================================================================

import type { createAdminClient } from '@/lib/supabase/admin'
import { getPreviewSessionId } from '@/lib/sample-data/seed-preview'
import { synthScore, weightedMean } from '@/lib/sample-data/score-synth'
import type { PreviewEntity } from '@/lib/reports/sample-data'

type DB = ReturnType<typeof createAdminClient>

function hasRealContent(text: unknown): string | undefined {
  if (!text || typeof text !== 'string') return undefined
  const stripped = text.replace(/<[^>]*>/g, '').trim()
  return stripped.length > 0 ? text : undefined
}

function mapToPreviewEntity(
  row: Record<string, unknown>,
  type: 'dimension' | 'factor' | 'construct',
  parentId: string | undefined,
  pompScore: number,
): PreviewEntity {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    type,
    parentId,
    definition: hasRealContent(row.definition),
    description: hasRealContent(row.description),
    indicatorsLow: hasRealContent(row.indicators_low),
    indicatorsMid: hasRealContent(row.indicators_mid),
    indicatorsHigh: hasRealContent(row.indicators_high),
    strengthCommentary: hasRealContent(row.strength_commentary),
    developmentSuggestion: hasRealContent(row.development_suggestion),
    anchorLow: hasRealContent(row.anchor_low),
    anchorHigh: hasRealContent(row.anchor_high),
    pompScore,
  }
}

/**
 * Load the scoped preview entities for an assessment with POMPs pulled from
 * the seeded session (or synthScore fallback if no seed exists).
 *
 * Auth is the caller's responsibility — this function trusts the DB client.
 */
export async function loadPreviewEntitiesForAssessment(
  db: DB,
  assessmentId: string,
): Promise<PreviewEntity[]> {
  const { data: assessment } = await db
    .from('assessments')
    .select('id, scoring_level')
    .eq('id', assessmentId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!assessment) return []

  const scoringLevel = (assessment as { scoring_level: 'factor' | 'construct' }).scoring_level

  const sessionId = await getPreviewSessionId(db, assessmentId)
  const scoreByEntity = new Map<string, number>()
  if (sessionId) {
    const { data: scores } = await db
      .from('participant_scores')
      .select('factor_id, construct_id, scaled_score')
      .eq('session_id', sessionId)
    for (const row of (scores ?? []) as Array<{
      factor_id: string | null
      construct_id: string | null
      scaled_score: number
    }>) {
      const entityId = row.factor_id ?? row.construct_id
      if (entityId) scoreByEntity.set(entityId, Number(row.scaled_score))
    }
  }

  const scoreFor = (id: string): number => scoreByEntity.get(id) ?? synthScore(id)

  if (scoringLevel === 'construct') {
    return loadConstructLevelEntities(db, assessmentId, scoreFor)
  }
  return loadFactorLevelEntities(db, assessmentId, scoreFor)
}

async function loadConstructLevelEntities(
  db: DB,
  assessmentId: string,
  scoreFor: (id: string) => number,
): Promise<PreviewEntity[]> {
  const { data: ac } = await db
    .from('assessment_constructs')
    .select('construct_id, constructs(id, name, definition, description, indicators_low, indicators_mid, indicators_high, strength_commentary, development_suggestion, anchor_low, anchor_high)')
    .eq('assessment_id', assessmentId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const constructRows = (ac ?? []).map((r: any) => r.constructs).filter(Boolean)

  const constructIds = constructRows.map((c: { id: string }) => c.id)
  const { data: dcLinks } = constructIds.length === 0
    ? { data: [] as Array<{ dimension_id: string; construct_id: string; weight: number }> }
    : await db
        .from('dimension_constructs')
        .select('dimension_id, construct_id, weight')
        .in('construct_id', constructIds)

  type DcLink = { dimension_id: string; construct_id: string; weight: number }
  const linksByDimension = new Map<string, DcLink[]>()
  for (const link of (dcLinks ?? []) as DcLink[]) {
    const list = linksByDimension.get(link.dimension_id) ?? []
    list.push(link)
    linksByDimension.set(link.dimension_id, list)
  }

  const dimensionIds = Array.from(linksByDimension.keys())
  const { data: dimensions } = dimensionIds.length === 0
    ? { data: [] as Array<Record<string, unknown>> }
    : await db
        .from('dimensions')
        .select('id, name, definition, description, indicators_low, indicators_mid, indicators_high, strength_commentary, development_suggestion, anchor_low, anchor_high')
        .in('id', dimensionIds)

  const constructScores = new Map<string, number>()
  for (const c of constructRows as Array<{ id: string }>) {
    constructScores.set(c.id, scoreFor(c.id))
  }

  const dimensionEntities: PreviewEntity[] = (dimensions ?? []).map((d) => {
    const links = linksByDimension.get(String(d.id)) ?? []
    const pomp = weightedMean(
      links.map((l) => ({
        value: constructScores.get(l.construct_id) ?? synthScore(l.construct_id),
        weight: Number(l.weight),
      })),
    )
    return mapToPreviewEntity(d, 'dimension', undefined, pomp)
  })

  const constructEntities: PreviewEntity[] = (constructRows as Array<Record<string, unknown>>).map((c) => {
    const id = String(c.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parentId = (dcLinks ?? []).find((l: any) => l.construct_id === id)?.dimension_id as string | undefined
    return mapToPreviewEntity(c, 'construct', parentId, constructScores.get(id)!)
  })

  return [...dimensionEntities, ...constructEntities]
}

async function loadFactorLevelEntities(
  db: DB,
  assessmentId: string,
  scoreFor: (id: string) => number,
): Promise<PreviewEntity[]> {
  const { data: af } = await db
    .from('assessment_factors')
    .select('factor_id, factors(id, dimension_id, name, definition, description, indicators_low, indicators_mid, indicators_high, strength_commentary, development_suggestion, anchor_low, anchor_high)')
    .eq('assessment_id', assessmentId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const factorRows = (af ?? []).map((r: any) => r.factors).filter(Boolean)
  const factorIds = factorRows.map((f: { id: string }) => f.id)

  const { data: fcLinks } = factorIds.length === 0
    ? { data: [] as Array<{ factor_id: string; construct_id: string }> }
    : await db
        .from('factor_constructs')
        .select('factor_id, construct_id, constructs(id, name, definition, description, indicators_low, indicators_mid, indicators_high, strength_commentary, development_suggestion, anchor_low, anchor_high)')
        .in('factor_id', factorIds)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dimensionIds = Array.from(new Set(factorRows.map((f: any) => f.dimension_id).filter(Boolean))) as string[]
  const { data: dimensions } = dimensionIds.length === 0
    ? { data: [] as Array<Record<string, unknown>> }
    : await db
        .from('dimensions')
        .select('id, name, definition, description, indicators_low, indicators_mid, indicators_high, strength_commentary, development_suggestion, anchor_low, anchor_high')
        .in('id', dimensionIds)

  const factorScores = new Map<string, number>()
  for (const f of factorRows as Array<{ id: string }>) factorScores.set(f.id, scoreFor(f.id))

  const factorsByDimension = new Map<string, string[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const f of factorRows as Array<any>) {
    if (!f.dimension_id) continue
    const list = factorsByDimension.get(f.dimension_id) ?? []
    list.push(f.id)
    factorsByDimension.set(f.dimension_id, list)
  }

  const dimensionEntities: PreviewEntity[] = (dimensions ?? []).map((d) => {
    const ids = factorsByDimension.get(String(d.id)) ?? []
    const pomp = weightedMean(ids.map((id) => ({ value: factorScores.get(id)!, weight: 1 })))
    return mapToPreviewEntity(d, 'dimension', undefined, pomp)
  })

  const factorEntities: PreviewEntity[] = (factorRows as Array<Record<string, unknown>>).map((f) => {
    const id = String(f.id)
    return mapToPreviewEntity(f, 'factor', (f.dimension_id as string) ?? undefined, factorScores.get(id)!)
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const constructRows = (fcLinks ?? []).map((l: any) => ({ ...l.constructs, factor_id: l.factor_id })).filter((c) => c?.id)
  const constructEntities: PreviewEntity[] = (constructRows as Array<Record<string, unknown>>).map((c) => {
    const id = String(c.id)
    return mapToPreviewEntity(c, 'construct', (c.factor_id as string) ?? undefined, synthScore(id))
  })

  return [...dimensionEntities, ...factorEntities, ...constructEntities]
}
