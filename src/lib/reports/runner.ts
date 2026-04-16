// =============================================================================
// src/lib/reports/runner.ts
// processSnapshot(snapshotId) — the 6-step report generation pipeline.
//
// Steps:
//   1. Fetch   — load template, scores, taxonomy entities in parallel
//   2. Condition-check — skip blocks whose conditions aren't met
//   3. Band resolution — for each scored entity
//   4. Derived narrative — assemble from indicators + definition
//   5. AI enhance — if narrative_mode === 'ai_enhanced'
//   6. Snapshot — write rendered_data, set status → ready
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { mapReportSnapshotRow, mapReportTemplateRow } from '@/lib/supabase/mappers'
import { isDeferredBlockType, parseBlocks } from './registry'
import { resolveBand, DEFAULT_BAND_GLOBALS } from './band-resolution'
import { buildDerivedNarrative, buildDevelopmentSuggestion, resolvePersonToken } from './narrative'
import { enhanceNarrative } from './ai-narrative'
import { OpenRouterProvider } from '@/lib/ai/providers/openrouter'
import { getModelForTask } from '@/lib/ai/model-config'
import { DEFAULT_REPORT_THEME } from './presentation'
import { getEffectiveBrand } from '@/app/actions/brand'
import { enqueueReportSnapshotEvent } from '@/lib/integrations/events'
import type { ReportTheme } from './presentation'
import type { BlockConfig, ResolvedBlockData, BandResult } from './types'
import type { ScoreDetailConfig, ScoreOverviewConfig, StrengthsHighlightsConfig, DevelopmentPlanConfig, AiTextConfig } from './types'
import type { PersonReferenceType, ReportDisplayLevel } from '@/types/database'

interface SessionData {
  id: string
  campaignId: string
  participantProfileId: string
  firstName?: string
  lastName?: string
  campaignName?: string
  assessmentName?: string
  reportName?: string
}

interface ScoreMap {
  [entityId: string]: number  // entityId → scaledScore (POMP 0–100)
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function processSnapshot(snapshotId: string): Promise<void> {
  const db = createAdminClient()

  // Mark as generating
  await db
    .from('report_snapshots')
    .update({
      status: 'generating',
      pdf_url: null,
      pdf_status: null,
      pdf_error_message: null,
    })
    .eq('id', snapshotId)
    .eq('status', 'pending')

  try {
    // -----------------------------------------------------------------------
    // Step 1: Fetch all required data in parallel
    // -----------------------------------------------------------------------

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
        .select('id, campaign_id, participant_profile_id, assessment_id, profiles(first_name, last_name), assessments(title), campaign_participants(first_name, last_name)')
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
    const blocks = parseBlocks(template.blocks)

    // Build score map: entityId → scaledScore (factor_id or construct_id)
    const scoreMap: ScoreMap = {}
    for (const row of scoresResult.data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = row as any
      const entityId = r.scoring_level === 'construct' ? r.construct_id : r.factor_id
      if (entityId) scoreMap[entityId] = r.scaled_score
    }

    // Session + participant name for person reference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionRow = sessionResult.data as any
    // Resolve participant name: prefer profiles, fall back to campaign_participants
    const cp = Array.isArray(sessionRow.campaign_participants)
      ? sessionRow.campaign_participants[0]
      : sessionRow.campaign_participants
    const firstName = sessionRow.profiles?.first_name ?? cp?.first_name ?? undefined
    const lastName = sessionRow.profiles?.last_name ?? cp?.last_name ?? undefined

    const sessionData: SessionData = {
      id: sessionRow.id,
      campaignId: sessionRow.campaign_id,
      participantProfileId: sessionRow.participant_profile_id,
      firstName,
      lastName,
      assessmentName: sessionRow.assessments?.title ?? undefined,
      reportName: template.name,
    }

    // Resolve brand theme via the standard cascade: campaign → client → partner → platform
    let resolvedBrandTheme: ReportTheme = DEFAULT_REPORT_THEME

    if (sessionData.campaignId) {
      const { data: campaign } = await db
        .from('campaigns')
        .select('client_id, title')
        .eq('id', sessionData.campaignId)
        .maybeSingle()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const campaignRow = campaign as any
      sessionData.campaignName = campaignRow?.title ?? undefined

      const brand = await getEffectiveBrand(
        campaign?.client_id ? String(campaign.client_id) : null,
        sessionData.campaignId,
      )
      if (brand.reportTheme) {
        resolvedBrandTheme = { ...DEFAULT_REPORT_THEME, ...brand.reportTheme }
      }
    }

    // Fetch all taxonomy entities needed by score blocks.
    // Include all scored factor IDs so that score_overview / strengths_highlights /
    // development_plan blocks (which iterate scoreMap directly) can resolve names.
    const entityIds = extractEntityIds(blocks)
    const allEntityIds = Array.from(new Set([...entityIds, ...Object.keys(scoreMap)]))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taxonomyMap = await fetchTaxonomyEntities(db as any, allEntityIds)

    // Build dimension scores by averaging child factor scores.
    // Also build a map of dimension → child factor IDs for nested scores.
    const dimensionChildFactors = new Map<string, string[]>()
    for (const [entityId, entity] of taxonomyMap) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = entity as any
      if (e._taxonomy_level === 'factor' && e.dimension_id) {
        const dimId = String(e.dimension_id)
        const list = dimensionChildFactors.get(dimId) ?? []
        list.push(entityId)
        dimensionChildFactors.set(dimId, list)
      }
    }

    // Fetch any dimensions referenced by factors but not yet in taxonomyMap.
    // This happens when no blocks explicitly list dimension IDs but factors
    // reference them via dimension_id — we need them for displayLevel filtering
    // and for computing dimension-level scores.
    const missingDimIds = [...dimensionChildFactors.keys()].filter((id) => !taxonomyMap.has(id))
    if (missingDimIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extraDims = await fetchTaxonomyEntities(db as any, missingDimIds)
      for (const [id, entity] of extraDims) {
        taxonomyMap.set(id, entity)
      }
    }

    // Determine scoring level for this assessment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assessmentId = (sessionRow as any).assessment_id
    const { data: assessmentMeta } = await db
      .from('assessments')
      .select('scoring_level')
      .eq('id', assessmentId)
      .single()
    const scoringLevel: string = (assessmentMeta as Record<string, unknown>)?.scoring_level as string ?? 'factor'

    // Build dimension → child construct IDs map for construct-level assessments
    const dimensionChildConstructs = new Map<string, string[]>()

    if (scoringLevel === 'construct') {
      const { data: acRows } = await db
        .from('assessment_constructs')
        .select('construct_id, dimension_id')
        .eq('assessment_id', assessmentId)

      for (const row of acRows ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = row as any
        if (!r.dimension_id) continue
        const dimId = String(r.dimension_id)
        const list = dimensionChildConstructs.get(dimId) ?? []
        list.push(String(r.construct_id))
        dimensionChildConstructs.set(dimId, list)
      }

      // Fetch any dimensions referenced by assessment_constructs but not in taxonomyMap
      const missingConstructDimIds = [...dimensionChildConstructs.keys()].filter(
        (id) => !taxonomyMap.has(id),
      )
      if (missingConstructDimIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const extraDims = await fetchTaxonomyEntities(db as any, missingConstructDimIds)
        for (const [id, entity] of extraDims) {
          taxonomyMap.set(id, entity)
        }
      }

      // Compute dimension scores from construct scores
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
      // Compute dimension scores as average of child factor scores
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

    // -----------------------------------------------------------------------
    // Steps 2–5: Process each block
    // -----------------------------------------------------------------------

    const resolvedBlocks: ResolvedBlockData[] = []

    for (const block of blocks) {
      if (isDeferredBlockType(block.type)) {
        resolvedBlocks.push({
          blockId: block.id,
          type: block.type,
          order: block.order,
          eyebrow: block.eyebrow,
          heading: block.heading,
          blockDescription: block.blockDescription,
          printBreakBefore: block.printBreakBefore,
          printHide: block.printHide,
          screenHide: block.screenHide,
          presentationMode: block.presentationMode,
          columns: block.columns,
          chartType: block.chartType,
          insetAccent: block.insetAccent,
          data: {},
          skipped: true,
          skipReason: 'block deferred',
        })
        continue
      }

      // Step 2: Condition check
      const conditionResult = evaluateCondition(block, scoreMap)
      if (!conditionResult.pass) {
        resolvedBlocks.push({
          blockId: block.id,
          type: block.type,
          order: block.order,
          eyebrow: block.eyebrow,
          heading: block.heading,
          blockDescription: block.blockDescription,
          printBreakBefore: block.printBreakBefore,
          printHide: block.printHide,
          screenHide: block.screenHide,
          presentationMode: block.presentationMode,
          columns: block.columns,
          chartType: block.chartType,
          insetAccent: block.insetAccent,
          data: {},
          skipped: true,
          skipReason: conditionResult.reason,
        })
        continue
      }

      // Step 3–5: Resolve block data (band + narrative per entity)
      const data = await resolveBlockData(
        block,
        scoreMap,
        taxonomyMap,
        template.personReference,
        template.displayLevel,
        sessionData,
        snapshot.narrativeMode === 'ai_enhanced',
        dimensionChildFactors,
        dimensionChildConstructs,
        scoringLevel,
      )

      resolvedBlocks.push({
        blockId: block.id,
        type: block.type,
        order: block.order,
        eyebrow: block.eyebrow,
        heading: block.heading,
        blockDescription: block.blockDescription,
        printBreakBefore: block.printBreakBefore,
        printHide: block.printHide,
        screenHide: block.screenHide,
        presentationMode: block.presentationMode,
        columns: block.columns,
        chartType: block.chartType,
        insetAccent: block.insetAccent,
        data,
      })
    }

    // Attach resolved brand theme to the first non-skipped block
    const firstActive = resolvedBlocks.find((b) => !b.skipped)
    if (firstActive) {
      firstActive.resolvedBrandTheme = resolvedBrandTheme
    }

    // -----------------------------------------------------------------------
    // Step 6: Write snapshot
    // -----------------------------------------------------------------------

    const generatedAt = new Date().toISOString()
    const releasedAt = template.autoRelease ? generatedAt : null
    const nextStatus = template.autoRelease ? 'released' : 'ready'

    await db.from('report_snapshots').update({
      status: nextStatus,
      released_at: releasedAt,
      generated_at: generatedAt,
      rendered_data: resolvedBlocks,
      error_message: null,
    }).eq('id', snapshotId)

    // Mark session as ready when a report completes
    await db
      .from('participant_sessions')
      .update({
        processing_status: 'ready',
        processing_error: null,
        processed_at: generatedAt,
      })
      .eq('id', snapshot.participantSessionId)

    try {
      await enqueueReportSnapshotEvent({
        snapshotId,
        campaignId: snapshot.campaignId,
        participantSessionId: snapshot.participantSessionId,
        status: nextStatus,
        generatedAt,
        releasedAt,
      })
    } catch (eventError) {
      console.error(`[integrations] Failed to enqueue report event for ${snapshotId}:`, eventError)
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[runner] processSnapshot failed for ${snapshotId}:`, message)
    const { data: failedSnapshot } = await db
      .from('report_snapshots')
      .select('participant_session_id')
      .eq('id', snapshotId)
      .maybeSingle()

    await db.from('report_snapshots').update({
      status: 'failed',
      error_message: message,
    }).eq('id', snapshotId)

    if (failedSnapshot?.participant_session_id) {
      await db
        .from('participant_sessions')
        .update({
          processing_status: 'failed',
          processing_error: message,
          processed_at: null,
        })
        .eq('id', failedSnapshot.participant_session_id)
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractEntityIds(blocks: BlockConfig[]): string[] {
  const ids = new Set<string>()
  for (const block of blocks) {
    const config = block.config as Record<string, unknown>
    if (typeof config.entityId === 'string' && config.entityId) ids.add(config.entityId)
    if (Array.isArray(config.entityIds)) {
      config.entityIds.forEach((id) => typeof id === 'string' && id && ids.add(id))
    }
  }
  return Array.from(ids)
}

type TaxonomyLookupClient = {
  from: (
    table: string
  ) => {
    select: (
      query: string
    ) => {
      in: (
        column: string,
        values: string[]
      ) => Promise<{ data: Record<string, unknown>[] | null }>
    }
  }
}

async function fetchTaxonomyEntities(
  db: TaxonomyLookupClient,
  entityIds: string[]
): Promise<Map<string, Record<string, unknown>>> {
  if (entityIds.length === 0) return new Map()

  const [factorsResult, constructsResult, dimensionsResult] = await Promise.all([
    db.from('factors').select('*').in('id', entityIds),
    db.from('constructs').select('*').in('id', entityIds),
    db.from('dimensions').select('*').in('id', entityIds),
  ])

  const map = new Map<string, Record<string, unknown>>()
  for (const row of factorsResult.data ?? []) {
    map.set(String(row.id), { ...row, _taxonomy_level: 'factor' })
  }
  for (const row of constructsResult.data ?? []) {
    map.set(String(row.id), { ...row, _taxonomy_level: 'construct' })
  }
  for (const row of dimensionsResult.data ?? []) {
    map.set(String(row.id), { ...row, _taxonomy_level: 'dimension' })
  }
  return map
}

function evaluateCondition(
  block: BlockConfig,
  scoreMap: ScoreMap,
): { pass: boolean; reason?: string } {
  if (!block.condition) return { pass: true }

  switch (block.condition.type) {
    case 'hasNormData':
      return { pass: false, reason: 'norm_comparison deferred' }
    case 'has360Data':
      // TODO: check if 360 rater data exists for this session
      return { pass: false, reason: '360 data check not yet implemented' }
    case 'scoreAbove': {
      const score = scoreMap[block.condition.entityId]
      if (score === undefined) return { pass: false, reason: 'no score for entity' }
      return score > block.condition.threshold
        ? { pass: true }
        : { pass: false, reason: `score ${score} not above threshold ${block.condition.threshold}` }
    }
    case 'scoreBelow': {
      const score = scoreMap[block.condition.entityId]
      if (score === undefined) return { pass: false, reason: 'no score for entity' }
      return score < block.condition.threshold
        ? { pass: true }
        : { pass: false, reason: `score ${score} not below threshold ${block.condition.threshold}` }
    }
  }
}

/**
 * Filter scored entities by displayLevel and entityIds from block config.
 * Returns [entityId, pompScore][] matching the filter criteria.
 */
function filterScoredEntities(
  scoreMap: ScoreMap,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taxonomyMap: Map<string, any>,
  config: { displayLevel?: string; entityIds?: string[] },
): [string, number][] {
  let entries = Object.entries(scoreMap)

  // Filter by display level (taxonomy type)
  if (config.displayLevel) {
    const targetLevel = mapDisplayLevel(config.displayLevel)
    entries = entries.filter(([entityId]) => {
      const entity = taxonomyMap.get(entityId)
      const level = entity?._taxonomy_level ?? entity?.taxonomy_level
      return level === targetLevel
    })
  }

  // Filter by explicit entity IDs
  if (config.entityIds?.length) {
    const idSet = new Set(config.entityIds)
    entries = entries.filter(([entityId]) => idSet.has(entityId))
  }

  return entries
}

async function resolveBlockData(
  block: BlockConfig,
  scoreMap: ScoreMap,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taxonomyMap: Map<string, any>,
  personReference: PersonReferenceType,
  _templateDisplayLevel: ReportDisplayLevel,
  session: SessionData,
  aiEnhance: boolean,
  dimensionChildFactors: Map<string, string[]>,
  dimensionChildConstructs: Map<string, string[]>,
  scoringLevel: string,
): Promise<Record<string, unknown>> {
  if (block.type === 'norm_comparison') {
    return { _deferred: true, message: 'Norm comparison not available in this version.' }
  }

  if (['cover_page', 'custom_text', 'section_divider'].includes(block.type)) {
    // Meta blocks: config is passed through as-is + session/campaign data injected
    return {
      ...block.config,
      participantName: session.firstName
        ? `${session.firstName} ${session.lastName ?? ''}`.trim()
        : undefined,
      assessmentName: session.assessmentName,
      campaignName: session.campaignName,
      reportName: session.reportName,
      generatedAt: new Date().toISOString(),
    }
  }

  if (block.type === 'score_detail') {
    const config = block.config as ScoreDetailConfig
    // Resolve entity IDs: explicit list, legacy single ID, or all matching displayLevel
    let entityIds: string[]
    if (config.entityIds?.length) {
      entityIds = config.entityIds
    } else if (config.entityId) {
      entityIds = [config.entityId]
    } else {
      // Fall back to all scored entities matching displayLevel
      entityIds = filterScoredEntities(scoreMap, taxonomyMap, config).map(([id]) => id)
    }
    if (entityIds.length === 0) return { _empty: true, reason: 'no scored entities found for display level' }

    const entities: Record<string, unknown>[] = []
    for (const entityId of entityIds) {
      const entity = taxonomyMap.get(entityId)
      if (!entity) continue

      const pompScore = scoreMap[entityId]
      if (pompScore === undefined) continue

      const bandResult = resolveBand(pompScore, {
        bandLabelLow: entity.band_label_low,
        bandLabelMid: entity.band_label_mid,
        bandLabelHigh: entity.band_label_high,
        pompThresholdLow: entity.pomp_threshold_low,
        pompThresholdHigh: entity.pomp_threshold_high,
      })

      // Build narrative from indicators only (definition is rendered separately by the component).
      // For AI-enhanced mode, we still pass the full derived narrative as context.
      let narrative: string | null = null
      if (config.showIndicators) {
        if (aiEnhance) {
          const derived = buildDerivedNarrative(
            {
              name: entity.name,
              definition: entity.definition,
              indicatorsLow: entity.indicators_low,
              indicatorsMid: entity.indicators_mid,
              indicatorsHigh: entity.indicators_high,
            },
            bandResult.band,
            personReference,
            session.firstName,
          )
          narrative = await enhanceNarrative({
            entityName: entity.name,
            derivedNarrative: derived,
            pompScore,
            bandLabel: bandResult.bandLabel,
            personReference,
            firstName: session.firstName,
          })
        } else {
          // Pass only the band-specific indicator text, not definition
          const rawIndicator =
            bandResult.band === 'low'
              ? entity.indicators_low
              : bandResult.band === 'high'
                ? entity.indicators_high
                : entity.indicators_mid
          narrative = rawIndicator
            ? resolvePersonToken(rawIndicator.trim(), personReference, session.firstName)
            : null
        }
      }

      const developmentSuggestion = config.showDevelopment
        ? buildDevelopmentSuggestion(
            { name: entity.name, developmentSuggestion: entity.development_suggestion },
            personReference,
            session.firstName,
          )
        : null

      // Resolve nested child scores when showNestedScores is on and entity is a dimension
      let nestedScores: Record<string, unknown>[] | undefined
      if (config.showNestedScores && entity._taxonomy_level === 'dimension') {
        const childIds = scoringLevel === 'construct'
          ? (dimensionChildConstructs.get(entityId) ?? [])
          : (dimensionChildFactors.get(entityId) ?? [])
        nestedScores = []
        for (const childId of childIds) {
          const childEntity = taxonomyMap.get(childId)
          if (!childEntity) continue
          const childScore = scoreMap[childId]
          if (childScore === undefined) continue
          const childBand = resolveBand(childScore, {
            bandLabelLow: childEntity.band_label_low,
            bandLabelMid: childEntity.band_label_mid,
            bandLabelHigh: childEntity.band_label_high,
            pompThresholdLow: childEntity.pomp_threshold_low,
            pompThresholdHigh: childEntity.pomp_threshold_high,
          })
          let childNarrative: string | null = null
          if (config.showIndicators) {
            const childRawIndicator =
              childBand.band === 'low'
                ? childEntity.indicators_low
                : childBand.band === 'high'
                  ? childEntity.indicators_high
                  : childEntity.indicators_mid
            childNarrative = childRawIndicator
              ? resolvePersonToken(childRawIndicator.trim(), personReference, session.firstName)
              : null
          }
          const childDev = config.showDevelopment
            ? buildDevelopmentSuggestion(
                { name: childEntity.name, developmentSuggestion: childEntity.development_suggestion },
                personReference,
                session.firstName,
              )
            : null
          nestedScores.push({
            entityId: childId,
            entityName: childEntity.name,
            entitySlug: childEntity.slug,
            definition: config.showDefinition ? childEntity.definition : undefined,
            description: config.showDescription ? childEntity.description : undefined,
            pompScore: Math.round(childScore),
            bandResult: childBand,
            narrative: childNarrative,
            developmentSuggestion: childDev,
          })
        }
        if (nestedScores.length === 0) nestedScores = undefined
      }

      entities.push({
        entityId,
        entityName: entity.name,
        entitySlug: entity.slug,
        definition: config.showDefinition ? entity.definition : undefined,
        description: config.showDescription ? entity.description : undefined,
        pompScore: Math.round(pompScore),
        bandResult,
        narrative,
        developmentSuggestion,
        nestedScores,
      })
    }

    if (entities.length === 0) return { _empty: true, reason: 'no scored entities found' }
    return { entities, config }
  }

  if (block.type === 'score_overview') {
    const config = block.config as ScoreOverviewConfig
    const filtered = filterScoredEntities(scoreMap, taxonomyMap, config)
    const scores = filtered.map(([entityId, pompScore]) => {
      const entity = taxonomyMap.get(entityId)
      const bandResult = entity
        ? resolveBand(pompScore, {
            bandLabelLow: entity.band_label_low,
            bandLabelMid: entity.band_label_mid,
            bandLabelHigh: entity.band_label_high,
            pompThresholdLow: entity.pomp_threshold_low,
            pompThresholdHigh: entity.pomp_threshold_high,
          })
        : resolveBand(pompScore, {}, DEFAULT_BAND_GLOBALS)
      let parentName = ''
      if (entity?._taxonomy_level === 'factor' && entity?.dimension_id) {
        parentName = taxonomyMap.get(String(entity.dimension_id))?.name ?? ''
      } else if (scoringLevel === 'construct' && entity?._taxonomy_level === 'construct') {
        // For construct-level scoring, find parent dimension from dimensionChildConstructs
        for (const [dimId, constructIds] of dimensionChildConstructs) {
          if (constructIds.includes(entityId)) {
            parentName = taxonomyMap.get(dimId)?.name ?? ''
            break
          }
        }
      }
      return { entityId, entityName: entity?.name ?? entityId, pompScore: Math.round(pompScore), bandResult, parentName }
    })
    return { scores, config }
  }

  if (block.type === 'strengths_highlights') {
    const config = block.config as StrengthsHighlightsConfig
    return resolveStrengthsHighlights(scoreMap, taxonomyMap, config)
  }

  if (block.type === 'development_plan') {
    const config = block.config as DevelopmentPlanConfig
    return resolveDevelopmentPlan(scoreMap, taxonomyMap, config)
  }

  if (block.type === 'ai_text') {
    const config = block.config as AiTextConfig
    return resolveAiText(config, scoreMap, taxonomyMap, personReference, session)
  }

  // 360 blocks — return raw config for now; full resolution requires rater data
  return { config: block.config, _360: true }
}

// ---------------------------------------------------------------------------
// Exported resolution helpers (testable without DB)
// ---------------------------------------------------------------------------

/** Map displayLevel config value to the internal _taxonomy_level tag. */
function mapDisplayLevel(level: string): string {
  // The types use 'factor' in the config but the DB tag is also 'factor'
  return level
}

export interface StrengthHighlight {
  entityId: string
  entityName: string
  pompScore: number
  bandResult: BandResult
  strengthCommentary: string
}

/**
 * Resolve strengths highlights: rank entities by POMP descending, take topN,
 * include strengthCommentary from taxonomy library.
 */
export function resolveStrengthsHighlights(
  scoreMap: Record<string, number>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taxonomyMap: Map<string, any>,
  config: StrengthsHighlightsConfig,
): { highlights: StrengthHighlight[]; config: StrengthsHighlightsConfig } {
  const targetLevel = mapDisplayLevel(config.displayLevel)

  const highlights = Object.entries(scoreMap)
    .map(([entityId, pompScore]) => {
      const entity = taxonomyMap.get(entityId)
      if (!entity) return null
      // Filter by taxonomy level when entity has the tag
      const entityLevel = entity._taxonomy_level ?? entity.taxonomy_level
      if (entityLevel && entityLevel !== targetLevel) return null

      const bandResult = resolveBand(pompScore, {
        bandLabelLow: entity.band_label_low,
        bandLabelMid: entity.band_label_mid,
        bandLabelHigh: entity.band_label_high,
        pompThresholdLow: entity.pomp_threshold_low,
        pompThresholdHigh: entity.pomp_threshold_high,
      })
      return {
        entityId,
        entityName: entity.name ?? entityId,
        pompScore: Math.round(pompScore),
        bandResult,
        strengthCommentary: (entity.strength_commentary as string) ?? '',
      }
    })
    .filter((item): item is StrengthHighlight => item !== null)
    .sort((a, b) => b.pompScore - a.pompScore)
    .slice(0, config.topN)

  return { highlights, config }
}

export interface DevelopmentItem {
  entityId: string
  entityName: string
  pompScore: number
  bandResult: BandResult
  developmentSuggestion: string
}

/**
 * Resolve development plan: rank entities by POMP ascending (when prioritised),
 * take bottom N, include developmentSuggestion from taxonomy library.
 */
export function resolveDevelopmentPlan(
  scoreMap: Record<string, number>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taxonomyMap: Map<string, any>,
  config: DevelopmentPlanConfig,
): { items: DevelopmentItem[]; config: DevelopmentPlanConfig } {
  // Filter by displayLevel and entityIds
  const entityFilter = config.entityIds?.length ? new Set(config.entityIds) : null
  const targetLevel = config.displayLevel ? mapDisplayLevel(config.displayLevel) : null

  let items = Object.entries(scoreMap)
    .map(([entityId, pompScore]) => {
      if (entityFilter && !entityFilter.has(entityId)) return null
      const entity = taxonomyMap.get(entityId)
      if (!entity) return null
      // Filter by taxonomy level
      if (targetLevel) {
        const entityLevel = entity._taxonomy_level ?? entity.taxonomy_level
        if (entityLevel && entityLevel !== targetLevel) return null
      }

      const bandResult = resolveBand(pompScore, {
        bandLabelLow: entity.band_label_low,
        bandLabelMid: entity.band_label_mid,
        bandLabelHigh: entity.band_label_high,
        pompThresholdLow: entity.pomp_threshold_low,
        pompThresholdHigh: entity.pomp_threshold_high,
      })
      return {
        entityId,
        entityName: entity.name ?? entityId,
        pompScore: Math.round(pompScore),
        bandResult,
        developmentSuggestion: (entity.development_suggestion as string) ?? '',
      }
    })
    .filter((item): item is DevelopmentItem => item !== null)

  if (config.prioritiseByScore) {
    items = items.sort((a, b) => a.pompScore - b.pompScore)
  }

  items = items.slice(0, config.maxItems)

  return { items, config }
}

// ---------------------------------------------------------------------------
// AI Text block resolution
// ---------------------------------------------------------------------------

async function resolveAiText(
  config: AiTextConfig,
  scoreMap: Record<string, number>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taxonomyMap: Map<string, any>,
  personReference: PersonReferenceType,
  session: SessionData,
): Promise<Record<string, unknown>> {
  if (!config.promptId) {
    return { generatedText: '', isPreview: true, promptName: 'None' }
  }

  const db = createAdminClient()

  try {
    // Fetch the prompt template by ID
    const { data: promptRow, error: promptError } = await db
      .from('ai_system_prompts')
      .select('id, name, purpose, content, version')
      .eq('id', config.promptId)
      .single()

    if (promptError || !promptRow?.content) {
      return { generatedText: '', isPreview: true, promptName: 'Unknown', error: true }
    }

    const promptName = promptRow.name as string
    const promptContent = promptRow.content as string
    const promptPurpose = promptRow.purpose as string

    // Fetch model config for the prompt's purpose
    const taskConfig = await getModelForTask(promptPurpose as Parameters<typeof getModelForTask>[0])
    const model = taskConfig.modelId

    // Assemble full data context
    const participantName = session.firstName
      ? `${session.firstName} ${session.lastName ?? ''}`.trim()
      : 'the participant'

    const entityContext = Object.entries(scoreMap).map(([entityId, pompScore]) => {
      const entity = taxonomyMap.get(entityId)
      if (!entity) return { entityId, pompScore: Math.round(pompScore) }
      const bandResult = resolveBand(pompScore, {
        bandLabelLow: entity.band_label_low,
        bandLabelMid: entity.band_label_mid,
        bandLabelHigh: entity.band_label_high,
        pompThresholdLow: entity.pomp_threshold_low,
        pompThresholdHigh: entity.pomp_threshold_high,
      })
      return {
        entityId,
        entityName: entity.name,
        definition: entity.definition,
        pompScore: Math.round(pompScore),
        band: bandResult.band,
        bandLabel: bandResult.bandLabel,
        strengthCommentary: entity.strength_commentary ?? null,
        developmentSuggestion: entity.development_suggestion ?? null,
      }
    })

    const userMessage = JSON.stringify({
      participant: {
        name: participantName,
        firstName: session.firstName ?? null,
        personReference,
      },
      scores: entityContext,
    })

    const provider = new OpenRouterProvider()
    const response = await provider.complete({
      model,
      systemPrompt: promptContent,
      prompt: userMessage,
    })

    const text = response.content
    if (!text || text.trim().length < 5) {
      return { generatedText: '', error: true, promptName }
    }

    const generatedText = resolvePersonToken(text.trim(), personReference, session.firstName)
    return { generatedText, promptName, model: response.model }
  } catch (err) {
    console.error('[runner] AI Text generation failed:', err)
    const promptName = config.promptId ? 'Unknown' : 'None'
    return {
      generatedText: 'Unable to generate narrative. Please try again.',
      error: true,
      promptName,
    }
  }
}
