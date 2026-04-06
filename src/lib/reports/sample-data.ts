// =============================================================================
// src/lib/reports/sample-data.ts — Sample data generator for template preview
// =============================================================================

import type { ResolvedBlockData, BlockConfig, BlockType } from './types'
import type { ReportTheme } from './presentation'
import { parseBlocks } from './registry'

// ---------------------------------------------------------------------------
// Sample entity pool — enough entries to support topN/maxItems up to 10
// ---------------------------------------------------------------------------

const SAMPLE_ENTITIES = [
  { entityId: 'dim-1', entityName: 'Strategic Thinking', pompScore: 82, band: 'high' as const, bandLabel: 'Highly Effective' },
  { entityId: 'dim-2', entityName: 'Communication', pompScore: 74, band: 'high' as const, bandLabel: 'Highly Effective' },
  { entityId: 'dim-3', entityName: 'Adaptability', pompScore: 71, band: 'high' as const, bandLabel: 'Highly Effective' },
  { entityId: 'dim-4', entityName: 'Collaboration', pompScore: 58, band: 'mid' as const, bandLabel: 'Effective' },
  { entityId: 'dim-5', entityName: 'Resilience', pompScore: 45, band: 'mid' as const, bandLabel: 'Effective' },
  { entityId: 'dim-6', entityName: 'Innovation', pompScore: 68, band: 'mid' as const, bandLabel: 'Effective' },
  { entityId: 'dim-7', entityName: 'Decision Making', pompScore: 77, band: 'high' as const, bandLabel: 'Highly Effective' },
  { entityId: 'dim-8', entityName: 'Emotional Intelligence', pompScore: 63, band: 'mid' as const, bandLabel: 'Effective' },
  { entityId: 'dim-9', entityName: 'Accountability', pompScore: 55, band: 'mid' as const, bandLabel: 'Effective' },
  { entityId: 'dim-10', entityName: 'Influence', pompScore: 39, band: 'low' as const, bandLabel: 'Developing' },
]

const STRENGTH_COMMENTARIES = [
  'You demonstrate strong analytical skills that enable effective decision-making across complex situations.',
  'Your clarity and influence in written and verbal expression across different audiences is a distinctive strength.',
  'You show flexibility in approach when facing changing circumstances or ambiguity.',
  'Your ability to build trust and maintain productive relationships is consistently effective.',
  'You maintain composure and focus under pressure, enabling sustained performance.',
  'You generate creative solutions that push beyond conventional thinking.',
  'You weigh evidence carefully and make well-informed choices under uncertainty.',
  'You read interpersonal dynamics effectively and respond with empathy.',
  'You take ownership of outcomes and follow through on commitments reliably.',
  'You articulate a compelling vision that motivates others toward shared goals.',
]

const DEVELOPMENT_SUGGESTIONS = [
  'Focus on building structured approaches to problem-solving. Practice breaking complex challenges into smaller, manageable components.',
  'Seek structured feedback from peers on how effectively you integrate diverse viewpoints during collaborative problem-solving.',
  'Develop a personal stress-management protocol — identify your early warning signals and build in recovery practices before they escalate.',
  'Practice time-boxed decision-making in lower-stakes situations to build comfort with acting on incomplete information.',
  'Consider how you might share your strategic perspective more actively in team settings to help others develop this capability.',
  'Experiment with different communication styles when working with diverse stakeholder groups.',
  'Build deliberate pauses into your workflow to reflect on lessons learned before moving to the next challenge.',
  'Seek out cross-functional projects that expose you to unfamiliar perspectives and working styles.',
  'Create accountability structures — such as regular check-ins — to maintain momentum on long-term initiatives.',
  'Practice active listening in meetings, summarising others\u2019 positions before sharing your own to build influence.',
]

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate sample ResolvedBlockData for template preview.
 * Produces realistic but synthetic data so the template creator
 * can see what the report will look like.
 */
export function generateSampleData(
  templateBlocks: Record<string, unknown>[] | BlockConfig[],
  reportTheme: ReportTheme,
): ResolvedBlockData[] {
  const blocks = parseBlocks(templateBlocks as Record<string, unknown>[])
  const resolved: ResolvedBlockData[] = []

  for (const block of blocks) {
    const data = generateBlockSampleData(block.type, block.config as Record<string, unknown>)

    resolved.push({
      blockId: block.id,
      type: block.type,
      order: block.order,
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

  // Attach brand theme to first block
  if (resolved.length > 0) {
    resolved[0].resolvedBrandTheme = reportTheme
  }

  return resolved
}

// ---------------------------------------------------------------------------
// Per-block generators
// ---------------------------------------------------------------------------

function makeBandResult(entity: (typeof SAMPLE_ENTITIES)[number]) {
  return { band: entity.band, bandLabel: entity.bandLabel, pompScore: entity.pompScore, thresholdLow: 40, thresholdHigh: 70 }
}

function generateBlockSampleData(type: BlockType, config: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case 'cover_page':
      return {
        participantName: 'Alex Morgan',
        generatedAt: new Date().toISOString(),
        showDate: true,
        showPrimaryLogo: true,
        showSecondaryLogo: false,
        showPoweredBy: false,
        subtitle: 'Leadership Assessment',
      }

    case 'score_overview':
      return {
        scores: SAMPLE_ENTITIES.slice(0, 5).map((e) => ({
          entityId: e.entityId,
          entityName: e.entityName,
          pompScore: e.pompScore,
          bandResult: makeBandResult(e),
        })),
        config: { chartType: 'bar', displayLevel: 'dimension' },
      }

    case 'score_detail':
      return {
        entityId: 'dim-1',
        entityName: 'Strategic Thinking',
        entitySlug: 'strategic-thinking',
        definition:
          'The capacity to think beyond immediate challenges and consider broader implications for the client.',
        pompScore: 82,
        bandResult: {
          band: 'high',
          bandLabel: 'Highly Effective',
          pompScore: 82,
          thresholdLow: 40,
          thresholdHigh: 70,
        },
        narrative:
          'You demonstrate a strong ability to think beyond immediate challenges and consider broader implications. You consistently identify patterns and connections that others may miss, contributing to well-informed decisions.',
        developmentSuggestion:
          'Consider how you might share your strategic perspective more actively in team settings to help others develop this capability.',
        config: {
          showScore: false,
          showBandLabel: true,
          showDefinition: true,
          showIndicators: true,
          showDevelopment: true,
        },
      }

    case 'strengths_highlights': {
      const topN = (typeof config.topN === 'number' && config.topN > 0) ? config.topN : 3
      // Sort by score descending (top strengths)
      const sorted = [...SAMPLE_ENTITIES].sort((a, b) => b.pompScore - a.pompScore)
      const highlights = sorted.slice(0, topN).map((e, i) => ({
        entityId: e.entityId,
        entityName: e.entityName,
        pompScore: e.pompScore,
        bandResult: makeBandResult(e),
        strengthCommentary: STRENGTH_COMMENTARIES[i % STRENGTH_COMMENTARIES.length],
      }))
      return {
        highlights,
        config: { topN, style: 'cards' },
      }
    }

    case 'development_plan': {
      const maxItems = (typeof config.maxItems === 'number' && config.maxItems > 0) ? config.maxItems : 3
      // Sort by score ascending (lowest first for development)
      const sorted = [...SAMPLE_ENTITIES].sort((a, b) => a.pompScore - b.pompScore)
      const items = sorted.slice(0, maxItems).map((e, i) => ({
        entityId: e.entityId,
        entityName: e.entityName,
        pompScore: e.pompScore,
        bandResult: makeBandResult(e),
        developmentSuggestion: DEVELOPMENT_SUGGESTIONS[i % DEVELOPMENT_SUGGESTIONS.length],
      }))
      return {
        items,
        config: { maxItems },
      }
    }

    case 'ai_text':
      return {
        generatedText: 'AI-generated narrative will appear here when the report is generated.',
        promptName: 'Preview',
        isPreview: true,
      }

    case 'custom_text':
      return {
        heading: 'About This Assessment',
        content:
          'This report presents your results from the Leadership Assessment. The findings are based on your self-assessment responses and are intended as a development tool, not a definitive evaluation.',
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
