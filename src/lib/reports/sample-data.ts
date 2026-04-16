// =============================================================================
// src/lib/reports/sample-data.ts — Sample data generator for template preview
// =============================================================================

import type { ResolvedBlockData, BlockConfig, BlockType } from './types'
import type { ReportTheme } from './presentation'
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
}

// Fixed score distribution assigned deterministically by entity position.
// Gives a realistic spread: some high, mostly mid, one low.
const PREVIEW_SCORES = [82, 74, 71, 58, 45, 68, 77, 63, 55, 39]

function bandForScore(score: number): { band: 'high' | 'mid' | 'low'; bandLabel: string } {
  if (score >= 70) return { band: 'high', bandLabel: 'Highly Proficient' }
  if (score >= 40) return { band: 'mid', bandLabel: 'Developing' }
  return { band: 'low', bandLabel: 'Emerging' }
}

type ScoredEntity = PreviewEntity & { pompScore: number; band: 'high' | 'mid' | 'low'; bandLabel: string }

function scoreEntities(entities: PreviewEntity[]): ScoredEntity[] {
  return entities.map((e, i) => {
    const pompScore = PREVIEW_SCORES[i % PREVIEW_SCORES.length]
    return { ...e, pompScore, ...bandForScore(pompScore) }
  })
}

// ---------------------------------------------------------------------------
// Generic band-aware commentary (no entity-name assumptions)
// ---------------------------------------------------------------------------

/** Check if a string has actual content (not just empty HTML tags). */
function hasContent(text: string | undefined | null): text is string {
  if (!text) return false
  // Strip HTML tags and check for non-whitespace content
  const stripped = text.replace(/<[^>]*>/g, '').trim()
  return stripped.length > 0
}

/** Resolve the indicator text for a scored entity based on its band.
 *  Prefers the matching band, falls back to any available indicator. */
function resolveIndicator(entity: ScoredEntity, band: 'high' | 'mid' | 'low'): string | null {
  // Try the exact band first
  if (band === 'high' && hasContent(entity.indicatorsHigh)) return entity.indicatorsHigh!
  if (band === 'mid' && hasContent(entity.indicatorsMid)) return entity.indicatorsMid!
  if (band === 'low' && hasContent(entity.indicatorsLow)) return entity.indicatorsLow!
  // Fall back to any available
  if (hasContent(entity.indicatorsHigh)) return entity.indicatorsHigh!
  if (hasContent(entity.indicatorsMid)) return entity.indicatorsMid!
  if (hasContent(entity.indicatorsLow)) return entity.indicatorsLow!
  return null
}

// Sample text for previews — real reports pull from the construct/factor/dimension library.
const SAMPLE_STRENGTH_COMMENTARIES = [
  '[Sample] Strength commentary from the library will appear here.',
]

const SAMPLE_INDICATORS: Record<'high' | 'mid' | 'low', string[]> = {
  high: ['[Sample] High-band behavioural indicators from the library will appear here.'],
  mid: ['[Sample] Mid-band behavioural indicators from the library will appear here.'],
  low: ['[Sample] Low-band behavioural indicators from the library will appear here.'],
}

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
 * If no entities are provided yet (still loading), blocks render with minimal data.
 */
export function generateSampleData(
  templateBlocks: Record<string, unknown>[] | BlockConfig[],
  reportTheme: ReportTheme,
  entities: PreviewEntity[] = [],
  templateName = 'Assessment Report',
): ResolvedBlockData[] {
  const scored = scoreEntities(entities)
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

    const data = generateBlockSampleData(block.type, block.config as Record<string, unknown>, scored, templateName)

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

  // Attach brand theme to the first visible block.
  const firstVisibleBlock = resolved.find((block) => !block.skipped)
  if (firstVisibleBlock) {
    firstVisibleBlock.resolvedBrandTheme = reportTheme
  }

  return resolved
}

// ---------------------------------------------------------------------------
// Per-block generators
// ---------------------------------------------------------------------------

function makeBandResult(e: ScoredEntity) {
  return { band: e.band, bandLabel: e.bandLabel, pompScore: e.pompScore, thresholdLow: 40, thresholdHigh: 70 }
}

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
): Record<string, unknown> {
  const first = entities[0]

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
      // Build a parentId→name lookup from all entities (dimensions are parents)
      const parentNameMap = new Map<string, string>()
      for (const e of entities) {
        if (e.type === 'dimension') parentNameMap.set(e.id, e.name)
      }
      return {
        scores: filtered.slice(0, 8).map((e, i) => ({
          entityId: e.id,
          entityName: e.name,
          pompScore: e.pompScore,
          bandResult: makeBandResult(e),
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
      const parentNameMap = new Map<string, string>()
      for (const e of entities) {
        if (e.type === 'dimension') parentNameMap.set(e.id, e.name)
      }

      const groupByDim = config.groupByDimension !== false
      const groupMap = new Map<string, ScoredEntity[]>()
      const ungrouped: ScoredEntity[] = []

      for (const e of filtered) {
        const parentName = e.parentId ? (parentNameMap.get(e.parentId) ?? null) : null
        if (groupByDim && parentName) {
          const list = groupMap.get(parentName) ?? []
          list.push(e)
          groupMap.set(parentName, list)
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
          bandResult: makeBandResult(e),
          anchorLow: e.anchorLow ?? anchors.low,
          anchorHigh: e.anchorHigh ?? anchors.high,
        }
      }

      const groups: Array<{ groupName: string | null; entities: ReturnType<typeof mapEntity>[] }> = []
      for (const [groupName, entries] of groupMap) {
        groups.push({ groupName, entities: entries.map(mapEntity) })
      }
      if (ungrouped.length > 0) {
        groups.push({ groupName: null, entities: ungrouped.map(mapEntity) })
      }

      return {
        groups,
        config: {
          displayLevel: config.displayLevel ?? 'factor',
          groupByDimension: groupByDim,
          showScore: config.showScore !== false,
          showBandLabel: config.showBandLabel !== false,
          showAnchors: config.showAnchors !== false,
        },
      }
    }

    case 'score_detail': {
      const filtered = filterEntities(entities, config)
      if (filtered.length === 0) return { _empty: true }
      const showIndicators = config.showIndicators !== false
      const showDefinition = config.showDefinition !== false
      const showNested = config.showNestedScores === true
      const detailEntities = filtered.map((e) => {
        // Use real library data — only scores are sample
        const indicator = resolveIndicator(e, e.band)
        const narrative = showIndicators && indicator ? indicator : null

        const children = showNested
          ? entities.filter((c) => c.parentId === e.id).map((c) => {
              const childIndicator = resolveIndicator(c, c.band)
              return {
                entityId: c.id,
                entityName: c.name,
                entitySlug: c.name.toLowerCase().replace(/\s+/g, '-'),
                definition: c.definition,
                description: c.description,
                pompScore: c.pompScore,
                bandResult: makeBandResult(c),
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
          bandResult: makeBandResult(e),
          narrative,
          developmentSuggestion: e.developmentSuggestion ?? null,
          nestedScores: children && children.length > 0 ? children : undefined,
        }
      })
      return {
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
        bandResult: makeBandResult(e),
        strengthCommentary: e.strengthCommentary ?? SAMPLE_STRENGTH_COMMENTARIES[0],
      }))
      return { highlights, config: { topN, style: 'cards' } }
    }

    case 'development_plan': {
      const maxItems = (typeof config.maxItems === 'number' && config.maxItems > 0) ? config.maxItems : 3
      const filtered = filterEntities(entities, config)
      const sorted = [...filtered].sort((a, b) => a.pompScore - b.pompScore)
      const items = sorted.slice(0, maxItems).map((e) => ({
        entityId: e.id,
        entityName: e.name,
        pompScore: e.pompScore,
        bandResult: makeBandResult(e),
        developmentSuggestion: e.developmentSuggestion ?? SAMPLE_DEVELOPMENT_SUGGESTIONS[0],
      }))
      return { items, config: { maxItems } }
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
