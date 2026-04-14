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

const STRENGTH_COMMENTARIES = [
  'This is a standout area of strength, with results placing comfortably above the proficiency threshold.',
  'Strong, consistent performance here reflects well-developed capability and confident application.',
  'A clear asset — results demonstrate reliable and effective practice in this area.',
]

const SAMPLE_INDICATORS: Record<'high' | 'mid' | 'low', string[]> = {
  high: [
    'Consistently demonstrates strong capability in this area, applying skills with confidence and producing reliable results across a range of contexts.',
    'Operates with a high degree of competence, showing the ability to adapt approach and maintain quality even in challenging situations.',
  ],
  mid: [
    'Shows developing capability in this area with a solid foundation, though application can be inconsistent across different contexts.',
    'Demonstrates an emerging understanding and is building confidence, with room to deepen both knowledge and practical application.',
  ],
  low: [
    'Capability in this area is at an early stage, with limited evidence of consistent application in professional settings.',
    'Shows awareness of the fundamentals but has not yet developed the depth needed for confident, independent application.',
  ],
}

const DEVELOPMENT_SUGGESTIONS = [
  'Identify specific situations where you can practise and apply skills in this area with low stakes and regular feedback.',
  'Seek structured learning or mentorship to build a stronger foundation of knowledge and technique.',
  'Work with your manager to identify one concrete project where you can stretch into this capability over the next quarter.',
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
        scores: filtered.slice(0, 8).map((e) => ({
          entityId: e.id,
          entityName: e.name,
          pompScore: e.pompScore,
          bandResult: makeBandResult(e),
          parentName: e.parentId ? (parentNameMap.get(e.parentId) ?? '') : '',
        })),
        config: {
          displayLevel: config.displayLevel ?? 'factor',
          showScore: config.showScore !== false,
          showBandLabel: config.showBandLabel !== false,
          groupByDimension: config.groupByDimension === true,
        },
      }
    }

    case 'score_detail': {
      const filtered = filterEntities(entities, config)
      if (filtered.length === 0) return { _empty: true }
      const showIndicators = config.showIndicators !== false
      const showDefinition = config.showDefinition !== false
      const showNested = config.showNestedScores === true
      const detailEntities = filtered.map((e, i) => {
        const definition = `A measure of capability and effectiveness in ${e.name.toLowerCase()}.`
        const indicatorText = SAMPLE_INDICATORS[e.band][i % SAMPLE_INDICATORS[e.band].length]
        // Build narrative from indicators only (definition rendered separately)
        const narrativeParts: string[] = []
        if (showIndicators) narrativeParts.push(indicatorText)
        const narrative = narrativeParts.length > 0 ? narrativeParts.join(' ') : null

        // Find child entities whose parentId matches this entity
        const children = showNested
          ? entities.filter((c) => c.parentId === e.id).map((c) => ({
              entityId: c.id,
              entityName: c.name,
              pompScore: c.pompScore,
              band: c.band,
              bandLabel: c.bandLabel,
            }))
          : undefined

        return {
          entityId: e.id,
          entityName: e.name,
          entitySlug: e.name.toLowerCase().replace(/\s+/g, '-'),
          definition,
          pompScore: e.pompScore,
          bandResult: makeBandResult(e),
          narrative,
          developmentSuggestion: DEVELOPMENT_SUGGESTIONS[i % DEVELOPMENT_SUGGESTIONS.length],
          nestedScores: children && children.length > 0 ? children : undefined,
        }
      })
      return {
        entities: detailEntities,
        config: {
          showScore: config.showScore !== false,
          showBandLabel: config.showBandLabel !== false,
          showDefinition: showDefinition,
          showIndicators: showIndicators,
          showDevelopment: config.showDevelopment === true,
          showNestedScores: config.showNestedScores === true,
        },
      }
    }

    case 'strengths_highlights': {
      const topN = (typeof config.topN === 'number' && config.topN > 0) ? config.topN : 3
      const filtered = filterEntities(entities, config)
      const sorted = [...filtered].sort((a, b) => b.pompScore - a.pompScore)
      const highlights = sorted.slice(0, topN).map((e, i) => ({
        entityId: e.id,
        entityName: e.name,
        pompScore: e.pompScore,
        bandResult: makeBandResult(e),
        strengthCommentary: STRENGTH_COMMENTARIES[i % STRENGTH_COMMENTARIES.length],
      }))
      return { highlights, config: { topN, style: 'cards' } }
    }

    case 'development_plan': {
      const maxItems = (typeof config.maxItems === 'number' && config.maxItems > 0) ? config.maxItems : 3
      const filtered = filterEntities(entities, config)
      const sorted = [...filtered].sort((a, b) => a.pompScore - b.pompScore)
      const items = sorted.slice(0, maxItems).map((e, i) => ({
        entityId: e.id,
        entityName: e.name,
        pompScore: e.pompScore,
        bandResult: makeBandResult(e),
        developmentSuggestion: DEVELOPMENT_SUGGESTIONS[i % DEVELOPMENT_SUGGESTIONS.length],
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
