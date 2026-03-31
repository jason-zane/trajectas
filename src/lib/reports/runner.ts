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
import { parseBlocks } from './registry'
import { resolveBand, DEFAULT_BAND_GLOBALS } from './band-resolution'
import { buildDerivedNarrative, buildDevelopmentSuggestion } from './narrative'
import { enhanceNarrative, generateStrengthsAnalysis, generateDevelopmentAdvice } from './ai-narrative'
import type { BlockConfig, ResolvedBlockData } from './types'
import type { ScoreDetailConfig, ScoreOverviewConfig, StrengthsHighlightsConfig, DevelopmentPlanConfig } from './types'
import type { PersonReferenceType, ReportDisplayLevel } from '@/types/database'

interface SessionData {
  id: string
  campaignId: string
  participantProfileId: string
  firstName?: string
  lastName?: string
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
    .update({ status: 'generating' })
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
        .select('id, campaign_id, participant_profile_id, profiles(first_name, last_name)')
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

    // Build score map: factorId → scaledScore
    const scoreMap: ScoreMap = {}
    for (const row of scoresResult.data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scoreMap[(row as any).factor_id] = (row as any).scaled_score
    }

    // Session + participant name for person reference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionRow = sessionResult.data as any
    const sessionData: SessionData = {
      id: sessionRow.id,
      campaignId: sessionRow.campaign_id,
      participantProfileId: sessionRow.participant_profile_id,
      firstName: sessionRow.profiles?.first_name,
      lastName: sessionRow.profiles?.last_name,
    }

    // Fetch all taxonomy entities needed by score blocks
    const entityIds = extractEntityIds(blocks)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taxonomyMap = await fetchTaxonomyEntities(db as any, entityIds)

    // -----------------------------------------------------------------------
    // Steps 2–5: Process each block
    // -----------------------------------------------------------------------

    const resolvedBlocks: ResolvedBlockData[] = []

    for (const block of blocks) {
      // Step 2: Condition check
      const conditionResult = evaluateCondition(block, scoreMap)
      if (!conditionResult.pass) {
        resolvedBlocks.push({
          blockId: block.id,
          type: block.type,
          order: block.order,
          printBreakBefore: block.printBreakBefore,
          printHide: block.printHide,
          screenHide: block.screenHide,
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
      )

      resolvedBlocks.push({
        blockId: block.id,
        type: block.type,
        order: block.order,
        printBreakBefore: block.printBreakBefore,
        printHide: block.printHide,
        screenHide: block.screenHide,
        data,
      })
    }

    // -----------------------------------------------------------------------
    // Step 6: Write snapshot
    // -----------------------------------------------------------------------

    await db.from('report_snapshots').update({
      status: template.autoRelease ? 'released' : 'ready',
      released_at: template.autoRelease ? new Date().toISOString() : null,
      generated_at: new Date().toISOString(),
      rendered_data: resolvedBlocks,
      error_message: null,
    }).eq('id', snapshotId)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[runner] processSnapshot failed for ${snapshotId}:`, message)
    await db.from('report_snapshots').update({
      status: 'failed',
      error_message: message,
    }).eq('id', snapshotId)
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
  for (const row of [
    ...(factorsResult.data ?? []),
    ...(constructsResult.data ?? []),
    ...(dimensionsResult.data ?? []),
  ]) {
    map.set(String(row.id), row)
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

async function resolveBlockData(
  block: BlockConfig,
  scoreMap: ScoreMap,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taxonomyMap: Map<string, any>,
  personReference: PersonReferenceType,
  _templateDisplayLevel: ReportDisplayLevel,
  session: SessionData,
  aiEnhance: boolean,
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
      generatedAt: new Date().toISOString(),
    }
  }

  if (block.type === 'score_detail') {
    const config = block.config as ScoreDetailConfig
    // Multi-entity support with backward compat for legacy entityId
    const entityIds = config.entityIds?.length
      ? config.entityIds
      : config.entityId
        ? [config.entityId]
        : []
    if (entityIds.length === 0) return { _empty: true, reason: 'no entities configured' }

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

      let narrative: string | null = null
      if (config.showIndicators || config.showDefinition) {
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
        narrative = aiEnhance
          ? await enhanceNarrative({
              entityName: entity.name,
              derivedNarrative: derived,
              pompScore,
              bandLabel: bandResult.bandLabel,
              personReference,
              firstName: session.firstName,
            })
          : derived
      }

      const developmentSuggestion = config.showDevelopment
        ? buildDevelopmentSuggestion(
            { name: entity.name, developmentSuggestion: entity.development_suggestion },
            personReference,
            session.firstName,
          )
        : null

      entities.push({
        entityId,
        entityName: entity.name,
        entitySlug: entity.slug,
        definition: config.showDefinition ? entity.definition : undefined,
        pompScore,
        bandResult,
        narrative,
        developmentSuggestion,
      })
    }

    if (entities.length === 0) return { _empty: true, reason: 'no scored entities found' }
    return { entities, config }
  }

  if (block.type === 'score_overview') {
    const config = block.config as ScoreOverviewConfig
    const scores = Object.entries(scoreMap).map(([entityId, pompScore]) => {
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
      return { entityId, entityName: entity?.name ?? entityId, pompScore, bandResult }
    })
    return { scores, config }
  }

  if (block.type === 'strengths_highlights') {
    const config = block.config as StrengthsHighlightsConfig
    const ranked = Object.entries(scoreMap)
      .map(([entityId, pompScore]) => {
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
        return {
          entityId,
          entityName: entity?.name ?? entityId,
          pompScore,
          bandLabel: bandResult.bandLabel,
          definition: entity?.definition as string | undefined,
        }
      })
      .sort((a, b) => b.pompScore - a.pompScore)
      .slice(0, config.topN)

    let aiNarrative: string | null = null
    if (config.aiNarrative && aiEnhance) {
      aiNarrative = await generateStrengthsAnalysis({
        highlights: ranked.map((h) => ({
          name: h.entityName,
          pompScore: h.pompScore,
          bandLabel: h.bandLabel,
          definition: h.definition,
        })),
        personReference,
        firstName: session.firstName,
      })
    }

    return { highlights: ranked, config, aiNarrative }
  }

  if (block.type === 'development_plan') {
    const config = block.config as DevelopmentPlanConfig
    const items = Object.entries(scoreMap)
      .map(([entityId, pompScore]) => {
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
        return {
          entityId,
          entityName: entity?.name ?? entityId,
          pompScore,
          bandLabel: bandResult.bandLabel,
          definition: entity?.definition as string | undefined,
          suggestion: entity?.development_suggestion
            ? buildDevelopmentSuggestion(
                { name: entity.name, developmentSuggestion: entity.development_suggestion },
                personReference,
                session.firstName,
              )
            : null,
          aiSuggestion: undefined as string | undefined,
        }
      })
      .filter((item) => item.suggestion)
      .sort((a, b) => a.pompScore - b.pompScore)
      .slice(0, config.maxItems)

    if (config.aiNarrative && aiEnhance && items.length > 0) {
      const adviceResult = await generateDevelopmentAdvice({
        items: items.map((item) => ({
          name: item.entityName,
          pompScore: item.pompScore,
          bandLabel: item.bandLabel,
          definition: item.definition,
          existingSuggestion: item.suggestion,
        })),
        personReference,
        firstName: session.firstName,
      })
      if (adviceResult) {
        for (const advice of adviceResult) {
          const match = items.find((i) => i.entityName === advice.entityName)
          if (match) match.aiSuggestion = advice.aiSuggestion
        }
      }
    }

    return { items, config }
  }

  // 360 blocks — return raw config for now; full resolution requires rater data
  return { config: block.config, _360: true }
}
