// =============================================================================
// src/lib/reports/report-context.ts
//
// ReportContext — the stable "ingredients pantry" handed to custom reports.
// Fetches everything a report needs to render: template, snapshot, session,
// scores (with dimension averages), taxonomy, band scheme, and resolved brand
// theme.
//
// Custom report builders code against this type. Treat the shape as a stable
// public surface — changes should be additive, or co-ordinated with custom
// report implementations.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { mapReportSnapshotRow, mapReportTemplateRow } from '@/lib/supabase/mappers'
import { resolveTemplateBandScheme } from './resolve-template-band-scheme'
import { resolveBand } from './band-resolution'
import { DEFAULT_REPORT_THEME, type ReportTheme } from './presentation'
import { getEffectiveBrand } from '@/app/actions/brand'
import type { BandScheme } from './band-scheme'
import type { BandResult } from './types'
import type { ReportSnapshot, ReportTemplate } from '@/types/database'

export type ScoreMap = Record<string, number>
export type TaxonomyEntity = Record<string, unknown> & { _taxonomy_level: 'factor' | 'construct' | 'dimension' }
export type TaxonomyMap = Map<string, TaxonomyEntity>

export interface ReportContextSession {
  id: string
  campaignId: string | null
  participantProfileId: string | null
  assessmentId: string
  firstName?: string
  lastName?: string
  campaignName?: string
  assessmentName?: string
  clientId: string | null
}

export interface ReportContext {
  /** The snapshot being generated. */
  snapshot: ReportSnapshot
  /** The template row. */
  template: ReportTemplate
  /** Participant + assessment + campaign identity. */
  session: ReportContextSession

  /** entityId → POMP 0–100. Includes dimension scores derived from child averages. */
  scores: ScoreMap
  /** Whether the underlying assessment scores at construct or factor level. */
  scoringLevel: 'factor' | 'construct'

  /** entityId → taxonomy row (factor / construct / dimension). */
  taxonomy: TaxonomyMap
  /** dimensionId → child factor IDs (factor-scored assessments). */
  dimensionChildFactors: Map<string, string[]>
  /** dimensionId → child construct IDs (construct-scored assessments). */
  dimensionChildConstructs: Map<string, string[]>

  /** Band scheme resolved via template → partner → platform → default cascade. */
  bandScheme: BandScheme
  /** Resolve a POMP score against the active band scheme. */
  resolveBand: (score: number) => BandResult

  /** Brand theme — campaign → client → partner → platform cascade, merged over defaults. */
  brandTheme: ReportTheme
}

export interface BuildReportContextOptions {
  /**
   * Additional taxonomy entity IDs to ensure are fetched beyond the scored set.
   * Custom reports usually leave this empty; the block-path may pass IDs
   * referenced explicitly in blocks.
   */
  extraEntityIds?: string[]
}

/**
 * Build the ReportContext for a snapshot.
 *
 * Performs cross-table reads in parallel where possible. Mutates nothing —
 * the snapshot row is read but not updated here.
 *
 * @throws if the snapshot, template, or session can't be found.
 */
export async function buildReportContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  snapshotId: string,
  opts: BuildReportContextOptions = {},
): Promise<ReportContext> {
  const snapshotResult = await db
    .from('report_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single()
  if (snapshotResult.error || !snapshotResult.data) {
    throw new Error(`Snapshot not found: ${snapshotId}`)
  }
  const snapshot = mapReportSnapshotRow(snapshotResult.data)

  const [templateResult, scoresResult, sessionResult] = await Promise.all([
    db.from('report_templates').select('*').eq('id', snapshot.templateId).single(),
    db.from('participant_scores').select('*').eq('session_id', snapshot.participantSessionId),
    db
      .from('participant_sessions')
      .select(
        'id, campaign_id, participant_profile_id, assessment_id, profiles(first_name, last_name), assessments(title), campaign_participants(first_name, last_name)',
      )
      .eq('id', snapshot.participantSessionId)
      .single(),
  ])

  if (templateResult.error || !templateResult.data) {
    throw new Error(`Template not found: ${snapshot.templateId}`)
  }
  if (scoresResult.error) throw new Error(scoresResult.error.message)
  if (sessionResult.error || !sessionResult.data) {
    throw new Error(`Session not found: ${snapshot.participantSessionId}`)
  }

  const template = mapReportTemplateRow(templateResult.data)

  // Band scheme cascade
  const templateRow = templateResult.data as Record<string, unknown>
  const bandScheme = await resolveTemplateBandScheme(db, {
    bandScheme: (templateRow.band_scheme as BandScheme | null) ?? null,
    partnerId: template.partnerId ?? null,
  })

  // Score map (factor or construct level)
  const scoreMap: ScoreMap = {}
  for (const row of (scoresResult.data ?? []) as Array<Record<string, unknown>>) {
    const scoringLevel = row.scoring_level as string
    const entityId = scoringLevel === 'construct' ? row.construct_id : row.factor_id
    if (typeof entityId === 'string' && entityId) {
      scoreMap[entityId] = row.scaled_score as number
    }
  }

  // Session identity + campaign/client/brand
  const sessionRow = sessionResult.data as Record<string, unknown>
  const profiles = sessionRow.profiles as { first_name?: string; last_name?: string } | null
  const cpRaw = sessionRow.campaign_participants
  const cp = (Array.isArray(cpRaw) ? cpRaw[0] : cpRaw) as
    | { first_name?: string; last_name?: string }
    | null
    | undefined
  const assessments = sessionRow.assessments as { title?: string } | null

  let campaignName: string | undefined
  let clientId: string | null = null
  let brandTheme: ReportTheme = DEFAULT_REPORT_THEME

  const campaignId = (sessionRow.campaign_id as string | null) ?? null
  if (campaignId) {
    const { data: campaign } = await db
      .from('campaigns')
      .select('client_id, title')
      .eq('id', campaignId)
      .maybeSingle()
    const campaignRow = campaign as { client_id?: string | null; title?: string } | null
    campaignName = campaignRow?.title ?? undefined
    clientId = campaignRow?.client_id ?? null

    const brand = await getEffectiveBrand(clientId, campaignId)
    if (brand.reportTheme) {
      brandTheme = { ...DEFAULT_REPORT_THEME, ...brand.reportTheme }
    }
  }

  const session: ReportContextSession = {
    id: sessionRow.id as string,
    campaignId,
    participantProfileId: (sessionRow.participant_profile_id as string | null) ?? null,
    assessmentId: sessionRow.assessment_id as string,
    firstName: profiles?.first_name ?? cp?.first_name ?? undefined,
    lastName: profiles?.last_name ?? cp?.last_name ?? undefined,
    campaignName,
    assessmentName: assessments?.title ?? undefined,
    clientId,
  }

  // Scoring level + assessment_constructs (for construct-level dimension rollups)
  const { data: assessmentMeta } = await db
    .from('assessments')
    .select('scoring_level')
    .eq('id', session.assessmentId)
    .single()
  const scoringLevel = ((assessmentMeta as Record<string, unknown> | null)?.scoring_level as
    | 'factor'
    | 'construct'
    | undefined) ?? 'factor'

  // Taxonomy fetch — scored entities + caller's extras
  const extraEntityIds = opts.extraEntityIds ?? []
  const initialEntityIds = Array.from(new Set([...extraEntityIds, ...Object.keys(scoreMap)]))
  const taxonomy: TaxonomyMap = await fetchTaxonomy(db, initialEntityIds)

  const dimensionChildFactors = new Map<string, string[]>()
  for (const [entityId, entity] of taxonomy) {
    if (entity._taxonomy_level === 'factor' && typeof entity.dimension_id === 'string') {
      const dimId = entity.dimension_id
      const list = dimensionChildFactors.get(dimId) ?? []
      list.push(entityId)
      dimensionChildFactors.set(dimId, list)
    }
  }

  // Pull any dimensions referenced but not yet loaded
  const missingDimIds = [...dimensionChildFactors.keys()].filter((id) => !taxonomy.has(id))
  if (missingDimIds.length > 0) {
    const extras = await fetchTaxonomy(db, missingDimIds)
    for (const [id, entity] of extras) taxonomy.set(id, entity)
  }

  const dimensionChildConstructs = new Map<string, string[]>()
  if (scoringLevel === 'construct') {
    const { data: acRows } = await db
      .from('assessment_constructs')
      .select('construct_id, dimension_id')
      .eq('assessment_id', session.assessmentId)
    for (const row of (acRows ?? []) as Array<Record<string, unknown>>) {
      if (!row.dimension_id) continue
      const dimId = String(row.dimension_id)
      const list = dimensionChildConstructs.get(dimId) ?? []
      list.push(String(row.construct_id))
      dimensionChildConstructs.set(dimId, list)
    }
    const missingConstructDimIds = [...dimensionChildConstructs.keys()].filter(
      (id) => !taxonomy.has(id),
    )
    if (missingConstructDimIds.length > 0) {
      const extras = await fetchTaxonomy(db, missingConstructDimIds)
      for (const [id, entity] of extras) taxonomy.set(id, entity)
    }
    // Average construct scores up to dimension scores
    for (const [dimId, constructIds] of dimensionChildConstructs) {
      if (scoreMap[dimId] !== undefined) continue
      const childScores = constructIds
        .map((cId) => scoreMap[cId])
        .filter((s): s is number => s !== undefined)
      if (childScores.length > 0) {
        scoreMap[dimId] = childScores.reduce((a, b) => a + b, 0) / childScores.length
      }
    }
  } else {
    // Average factor scores up to dimension scores
    for (const [dimId, factorIds] of dimensionChildFactors) {
      if (scoreMap[dimId] !== undefined) continue
      const childScores = factorIds
        .map((fId) => scoreMap[fId])
        .filter((s): s is number => s !== undefined)
      if (childScores.length > 0) {
        scoreMap[dimId] = childScores.reduce((a, b) => a + b, 0) / childScores.length
      }
    }
  }

  return {
    snapshot,
    template,
    session,
    scores: scoreMap,
    scoringLevel,
    taxonomy,
    dimensionChildFactors,
    dimensionChildConstructs,
    bandScheme,
    resolveBand: (score: number) => resolveBand(score, bandScheme),
    brandTheme,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchTaxonomy(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  entityIds: string[],
): Promise<TaxonomyMap> {
  if (entityIds.length === 0) return new Map()

  const [factorsResult, constructsResult, dimensionsResult] = await Promise.all([
    db.from('factors').select('*').in('id', entityIds),
    db.from('constructs').select('*').in('id', entityIds),
    db.from('dimensions').select('*').in('id', entityIds),
  ])

  const map: TaxonomyMap = new Map()
  for (const row of (factorsResult.data ?? []) as Array<Record<string, unknown>>) {
    map.set(String(row.id), { ...row, _taxonomy_level: 'factor' })
  }
  for (const row of (constructsResult.data ?? []) as Array<Record<string, unknown>>) {
    map.set(String(row.id), { ...row, _taxonomy_level: 'construct' })
  }
  for (const row of (dimensionsResult.data ?? []) as Array<Record<string, unknown>>) {
    map.set(String(row.id), { ...row, _taxonomy_level: 'dimension' })
  }
  return map
}
