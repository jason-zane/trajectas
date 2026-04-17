// =============================================================================
// src/lib/reports/sample-data.ts — Sample data generator for template preview
// =============================================================================

import type { ResolvedBlockData, BlockConfig, BlockType, BandResult } from './types'
import type { ReportTheme } from './presentation'
import type { BandScheme } from './band-scheme'
import { DEFAULT_3_BAND_SCHEME } from './band-scheme'
import { resolveBand } from './band-resolution'
import { isDeferredBlockType, parseBlocks } from './registry'

// ---------------------------------------------------------------------------
// Preview entity — caller provides real DB entities; we assign fake scores
// ---------------------------------------------------------------------------

export interface PreviewEntity {
  id: string
  name: string
  type: 'dimension' | 'factor' | 'construct'
  parentId?: string
  definition?: string
  description?: string
  indicatorsLow?: string
  indicatorsMid?: string
  indicatorsHigh?: string
  strengthCommentary?: string
  developmentSuggestion?: string
  anchorLow?: string
  anchorHigh?: string
  /** Overrides the default preview score distribution when present. */
  pompScore?: number
}

// Fixed score distribution assigned deterministically by entity position.
const PREVIEW_SCORES = [82, 74, 71, 58, 45, 68, 77, 63, 55, 39]

type ScoredEntity = PreviewEntity & { pompScore: number; bandResult: BandResult }

function scoreEntities(entities: PreviewEntity[], scheme: BandScheme): ScoredEntity[] {
  return entities.map((e, i) => {
    const pompScore = e.pompScore ?? PREVIEW_SCORES[i % PREVIEW_SCORES.length]
    return { ...e, pompScore, bandResult: resolveBand(pompScore, scheme) }
  })
}

// ---------------------------------------------------------------------------
// Generic band-aware commentary (no entity-name assumptions)
// ---------------------------------------------------------------------------

function hasContent(text: string | undefined | null): text is string {
  if (!text) return false
  const stripped = text.replace(/<[^>]*>/g, '').trim()
  return stripped.length > 0
}

/** Resolve the indicator text for a scored entity based on its indicator tier.
 *  Prefers the matching tier, falls back to any available indicator. */
function resolveIndicator(entity: ScoredEntity, tier: 'high' | 'mid' | 'low'): string | null {
  if (tier === 'high' && hasContent(entity.indicatorsHigh)) return entity.indicatorsHigh!
  if (tier === 'mid' && hasContent(entity.indicatorsMid)) return entity.indicatorsMid!
  if (tier === 'low' && hasContent(entity.indicatorsLow)) return entity.indicatorsLow!
  // Fall back to any available
  if (hasContent(entity.indicatorsHigh)) return entity.indicatorsHigh!
  if (hasContent(entity.indicatorsMid)) return entity.indicatorsMid!
  if (hasContent(entity.indicatorsLow)) return entity.indicatorsLow!
  return null
}

const SAMPLE_STRENGTH_COMMENTARIES = [
  '[Sample] Strength commentary from the library will appear here.',
]

const SAMPLE_DEVELOPMENT_SUGGESTIONS = [
  '[Sample] Development suggestions from the library will appear here.',
]

const SAMPLE_ANCHORS: Array<{ low: string; high: string }> = [
  { low: 'Tends to avoid complex challenges', high: 'Actively seeks out complex challenges' },
  { low: 'Prefers individual work environments', high: 'Thrives in collaborative settings' },
  { low: 'Relies on established approaches', high: 'Generates novel solutions readily' },
  { low: 'Focuses on immediate concerns', high: 'Takes a long-term strategic view' },
  { low: 'Prefers stable environments', high: 'Adapts quickly to change' },
]

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate sample ResolvedBlockData for template preview.
 * Uses real entity names from the DB with deterministic fake scores.
 */
export function generateSampleData(
  templateBlocks: Record<string, unknown>[] | BlockConfig[],
  reportTheme: ReportTheme,
  entities: PreviewEntity[] = [],
  templateName = 'Assessment Report',
  scheme: BandScheme = DEFAULT_3_BAND_SCHEME,
): ResolvedBlockData[] {
  const scored = scoreEntities(entities, scheme)
  const blocks = parseBlocks(templateBlocks as Record<string, unknown>[])
  const resolved: ResolvedBlockData[] = []

  for (const block of blocks) {
    if (isDeferredBlockType(block.type)) {
      resolved.push({
        blockId: block.id,
        type: block.type,
        order: block.order,
        eyebrow: block.eyebrow,
        heading: block.heading,
        blockDescription: block.blockDescription,
        presentationMode: block.presentationMode,
        columns: block.columns,
        chartType: block.chartType,
        insetAccent: block.insetAccent,
        printBreakBefore: block.printBreakBefore,
        printHide: block.printHide,
        screenHide: block.screenHide,
        data: {},
        skipped: true,
        skipReason: 'block deferred',
      })
      continue
    }

    const data = generateBlockSampleData(block.type, block.config as Record<string, unknown>, scored, templateName, scheme)

    resolved.push({
      blockId: block.id,
      type: block.type,
      order: block.order,
      eyebrow: block.eyebrow,
      heading: block.heading,
      blockDescription: block.blockDescription,
      presentationMode: block.presentationMode,
      columns: block.columns,
      chartType: block.chartType,
      insetAccent: block.insetAccent,
      printBreakBefore: block.printBreakBefore,
      printHide: block.printHide,
      screenHide: block.screenHide,
      data,
    })
  }

  const firstVisibleBlock = resolved.find((block) => !block.skipped)
  if (firstVisibleBlock) {
    firstVisibleBlock.resolvedBrandTheme = reportTheme
  }

  return resolved
}

// ---------------------------------------------------------------------------
// Per-block generators
// ---------------------------------------------------------------------------

function filterEntities(
  entities: ScoredEntity[],
  config: Record<string, unknown>,
): ScoredEntity[] {
  let filtered = entities

  const displayLevel = config.displayLevel as string | undefined
  if (displayLevel) {
    filtered = filtered.filter((e) => e.type === displayLevel)
  }

  const entityIds = Array.isArray(config.entityIds) ? config.entityIds as string[] : []
  if (entityIds.length > 0) {
    filtered = filtered.filter((e) => entityIds.includes(e.id))
  }

  return filtered
}

function generateBlockSampleData(
  type: BlockType,
  config: Record<string, unknown>,
  entities: ScoredEntity[],
  templateName: string,
  scheme: BandScheme,
): Record<string, unknown> {
  const palette = scheme.palette

  switch (type) {
    case 'cover_page':
      return {
        participantName: 'Alex Morgan',
        assessmentName: 'AI Capability Index',
        campaignName: 'Q2 2026 Cohort',
        reportName: templateName,
        clientName: 'Preview Organisation',
        generatedAt: new Date().toISOString(),
        showDate: config.showDate !== false,
        showLogo: config.showLogo !== false,
        showPoweredBy: config.showPoweredBy === true,
        poweredByText: typeof config.poweredByText === 'string' && config.poweredByText
          ? config.poweredByText
          : 'Powered by Trajectas',
        showAssessmentName: config.showAssessmentName !== false,
        showCampaignName: config.showCampaignName === true,
        showReportName: config.showReportName === true,
      }

    case 'score_overview': {
      const filtered = filterEntities(entities, config)
      const parentNameMap = new Map<string, string>()
      for (const e of entities) {
        if (e.type === 'dimension') parentNameMap.set(e.id, e.name)
      }
      return {
        palette,
        scores: filtered.slice(0, 8).map((e, i) => ({
          entityId: e.id,
          entityName: e.name,
          pompScore: e.pompScore,
          bandResult: e.bandResult,
          parentName: e.parentId ? (parentNameMap.get(e.parentId) ?? '') : '',
          anchorLow: e.anchorLow ?? SAMPLE_ANCHORS[i % SAMPLE_ANCHORS.length].low,
          anchorHigh: e.anchorHigh ?? SAMPLE_ANCHORS[i % SAMPLE_ANCHORS.length].high,
        })),
        config: {
          displayLevel: config.displayLevel ?? 'factor',
          showScore: config.showScore !== false,
          showBandLabel: config.showBandLabel !== false,
          showAnchors: config.showAnchors === true,
          groupByDimension: config.groupByDimension === true,
        },
      }
    }

    case 'score_interpretation': {
      const filtered = filterEntities(entities, config)
      // Map dimension ids/names to their full (scored) entity so groups can
      // emit a groupEntity header.
      const parentNameMap = new Map<string, string>()
      const parentScoredMap = new Map<string, ScoredEntity>()
      for (const e of entities) {
        if (e.type === 'dimension') {
          parentNameMap.set(e.id, e.name)
          parentScoredMap.set(e.id, e)
        }
      }

      const groupByDim = config.groupByDimension !== false
      const groupMap = new Map<string, { parentId: string | null; items: ScoredEntity[] }>()
      const ungrouped: ScoredEntity[] = []

      for (const e of filtered) {
        const parentName = e.parentId ? (parentNameMap.get(e.parentId) ?? null) : null
        if (groupByDim && parentName) {
          const group = groupMap.get(parentName) ?? { parentId: e.parentId ?? null, items: [] }
          group.items.push(e)
          groupMap.set(parentName, group)
        } else {
          ungrouped.push(e)
        }
      }

      const mapEntity = (e: ScoredEntity, i: number) => {
        const anchors = SAMPLE_ANCHORS[i % SAMPLE_ANCHORS.length]
        return {
          entityId: e.id,
          entityName: e.name,
          pompScore: e.pompScore,
          bandResult: e.bandResult,
          anchorLow: e.anchorLow ?? anchors.low,
          anchorHigh: e.anchorHigh ?? anchors.high,
        }
      }

      const mapGroupEntity = (e: ScoredEntity) => ({
        entityId: e.id,
        entityName: e.name,
        pompScore: e.pompScore,
        bandResult: e.bandResult,
        anchorLow: e.anchorLow ?? null,
        anchorHigh: e.anchorHigh ?? null,
      })

      type GroupEntity = ReturnType<typeof mapGroupEntity>
      const groups: Array<{
        groupName: string | null
        groupEntity: GroupEntity | null
        entities: ReturnType<typeof mapEntity>[]
      }> = []
      for (const [groupName, group] of groupMap) {
        const parent = group.parentId ? parentScoredMap.get(group.parentId) : undefined
        groups.push({
          groupName,
          groupEntity: parent ? mapGroupEntity(parent) : null,
          entities: group.items.map(mapEntity),
        })
      }
      if (ungrouped.length > 0) {
        groups.push({ groupName: null, groupEntity: null, entities: ungrouped.map(mapEntity) })
      }

      return {
        palette,
        groups,
        config: {
          displayLevel: config.displayLevel ?? 'factor',
          groupByDimension: groupByDim,
          showScore: config.showScore !== false,
          showBandLabel: config.showBandLabel !== false,
          showAnchors: config.showAnchors !== false,
          showGroupScore: config.showGroupScore === true,
          showGroupBand: config.showGroupBand === true,
          showGroupAnchors: config.showGroupAnchors === true,
        },
      }
    }

    case 'score_interpretation_v2': {
      const filtered = filterEntities(entities, config)
      const parentNameMap2 = new Map<string, string>()
      const parentScoredMap2 = new Map<string, ScoredEntity>()
      for (const e of entities) {
        if (e.type === 'dimension') {
          parentNameMap2.set(e.id, e.name)
          parentScoredMap2.set(e.id, e)
        }
      }

      const groupByDim2 = config.groupByDimension !== false
      const groupMap2 = new Map<string, { parentId: string | null; items: ScoredEntity[] }>()
      const ungrouped2: ScoredEntity[] = []

      for (const e of filtered) {
        const parentName = e.parentId ? (parentNameMap2.get(e.parentId) ?? null) : null
        if (groupByDim2 && parentName) {
          const group = groupMap2.get(parentName) ?? { parentId: e.parentId ?? null, items: [] }
          group.items.push(e)
          groupMap2.set(parentName, group)
        } else {
          ungrouped2.push(e)
        }
      }

      const mapEntity2 = (e: ScoredEntity, i: number) => {
        const anchors = SAMPLE_ANCHORS[i % SAMPLE_ANCHORS.length]
        return {
          entityId: e.id,
          entityName: e.name,
          pompScore: e.pompScore,
          bandResult: e.bandResult,
          anchorLow: e.anchorLow ?? anchors.low,
          anchorHigh: e.anchorHigh ?? anchors.high,
        }
      }

      const mapGroupEntity2 = (e: ScoredEntity) => ({
        entityId: e.id,
        entityName: e.name,
        pompScore: e.pompScore,
        bandResult: e.bandResult,
        anchorLow: e.anchorLow ?? null,
        anchorHigh: e.anchorHigh ?? null,
      })

      type GroupEntity2 = ReturnType<typeof mapGroupEntity2>
      const groups2: Array<{
        groupName: string | null
        groupEntity: GroupEntity2 | null
        entities: ReturnType<typeof mapEntity2>[]
      }> = []
      for (const [groupName, group] of groupMap2) {
        const parent = group.parentId ? parentScoredMap2.get(group.parentId) : undefined
        groups2.push({
          groupName,
          groupEntity: parent ? mapGroupEntity2(parent) : null,
          entities: group.items.map(mapEntity2),
        })
      }
      if (ungrouped2.length > 0) {
        groups2.push({ groupName: null, groupEntity: null, entities: ungrouped2.map(mapEntity2) })
      }

      return {
        palette,
        bands: scheme.bands,
        groups: groups2,
        config: {
          displayLevel: config.displayLevel ?? 'factor',
          groupByDimension: groupByDim2,
          showScore: config.showScore !== false,
          showBandLabel: config.showBandLabel !== false,
          showAnchors: config.showAnchors !== false,
          showGroupScore: config.showGroupScore === true,
          showGroupBand: config.showGroupBand === true,
          showGroupAnchors: config.showGroupAnchors === true,
        },
      }
    }

    case 'score_detail': {
      const filtered = filterEntities(entities, config)
      if (filtered.length === 0) return { _empty: true, palette }
      const showIndicators = config.showIndicators !== false
      const showDefinition = config.showDefinition !== false
      const showNested = config.showNestedScores === true
      const detailEntities = filtered.map((e) => {
        const indicator = resolveIndicator(e, e.bandResult.indicatorTier)
        const narrative = showIndicators && indicator ? indicator : null

        const children = showNested
          ? entities.filter((c) => c.parentId === e.id).map((c) => {
              const childIndicator = resolveIndicator(c, c.bandResult.indicatorTier)
              return {
                entityId: c.id,
                entityName: c.name,
                entitySlug: c.name.toLowerCase().replace(/\s+/g, '-'),
                definition: c.definition,
                description: c.description,
                pompScore: c.pompScore,
                bandResult: c.bandResult,
                narrative: showIndicators && childIndicator ? childIndicator : null,
                developmentSuggestion: c.developmentSuggestion ?? null,
              }
            })
          : undefined

        return {
          entityId: e.id,
          entityName: e.name,
          entitySlug: e.name.toLowerCase().replace(/\s+/g, '-'),
          definition: e.definition,
          description: e.description,
          pompScore: e.pompScore,
          bandResult: e.bandResult,
          narrative,
          developmentSuggestion: e.developmentSuggestion ?? null,
          nestedScores: children && children.length > 0 ? children : undefined,
        }
      })
      return {
        palette,
        entities: detailEntities,
        config: {
          showScore: config.showScore !== false,
          showBandLabel: config.showBandLabel !== false,
          showDefinition: showDefinition,
          showDescription: config.showDescription === true,
          showIndicators: showIndicators,
          showDevelopment: config.showDevelopment === true,
          showNestedScores: config.showNestedScores === true,
          nestedLabel: typeof config.nestedLabel === 'string' ? config.nestedLabel : 'Factors',
        },
      }
    }

    case 'strengths_highlights': {
      const topN = (typeof config.topN === 'number' && config.topN > 0) ? config.topN : 3
      const filtered = filterEntities(entities, config)
      const sorted = [...filtered].sort((a, b) => b.pompScore - a.pompScore)
      const highlights = sorted.slice(0, topN).map((e) => ({
        entityId: e.id,
        entityName: e.name,
        pompScore: e.pompScore,
        bandResult: e.bandResult,
        strengthCommentary: e.strengthCommentary ?? SAMPLE_STRENGTH_COMMENTARIES[0],
      }))
      return { palette, highlights, config: { topN, style: 'cards' } }
    }

    case 'development_plan': {
      const maxItems = (typeof config.maxItems === 'number' && config.maxItems > 0) ? config.maxItems : 3
      const filtered = filterEntities(entities, config)
      const sorted = [...filtered].sort((a, b) => a.pompScore - b.pompScore)
      const items = sorted.slice(0, maxItems).map((e) => ({
        entityId: e.id,
        entityName: e.name,
        pompScore: e.pompScore,
        bandResult: e.bandResult,
        developmentSuggestion: e.developmentSuggestion ?? SAMPLE_DEVELOPMENT_SUGGESTIONS[0],
      }))
      return { palette, items, config: { maxItems } }
    }

    case 'ai_text':
      return {
        generatedText: 'AI-generated narrative will appear here when the report is generated.',
        promptName: 'Preview',
        isPreview: true,
      }

    case 'custom_text':
      return {
        heading: (typeof config.heading === 'string' && config.heading) || '',
        content: (typeof config.content === 'string' && config.content)
          || `This report presents your results from the ${templateName}. The findings are based on your self-assessment responses and are intended as a development tool, not a definitive evaluation.`,
      }

    case 'section_divider': {
      const style = (typeof config.style === 'string') ? config.style : 'thin_rule'
      return {
        title: 'Detailed Results',
        subtitle: 'Your scores across all dimensions',
        style,
      }
    }

    case 'rater_comparison':
    case 'gap_analysis':
    case 'open_comments':
      return { _360: true }

    case 'norm_comparison':
      return { _deferred: true }

    default:
      return {}
  }
}
