// =============================================================================
// src/lib/reports/sample-data.ts — Sample data generator for template preview
// =============================================================================

import type { ResolvedBlockData, BlockType } from './types'
import type { ReportTheme } from './presentation'
import { parseBlocks } from './registry'

/**
 * Generate sample ResolvedBlockData for template preview.
 * Produces realistic but synthetic data so the template creator
 * can see what the report will look like.
 */
export function generateSampleData(
  templateBlocks: Record<string, unknown>[],
  reportTheme: ReportTheme,
): ResolvedBlockData[] {
  const blocks = parseBlocks(templateBlocks)
  const resolved: ResolvedBlockData[] = []

  for (const block of blocks) {
    const data = generateBlockSampleData(block.type)

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

function generateBlockSampleData(type: BlockType): Record<string, unknown> {
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
        scores: [
          {
            entityId: 'dim-1',
            entityName: 'Strategic Thinking',
            pompScore: 82,
            bandResult: { band: 'high', bandLabel: 'Highly Effective', pompScore: 82, thresholdLow: 40, thresholdHigh: 70 },
          },
          {
            entityId: 'dim-2',
            entityName: 'Communication',
            pompScore: 74,
            bandResult: { band: 'high', bandLabel: 'Highly Effective', pompScore: 74, thresholdLow: 40, thresholdHigh: 70 },
          },
          {
            entityId: 'dim-3',
            entityName: 'Adaptability',
            pompScore: 71,
            bandResult: { band: 'high', bandLabel: 'Highly Effective', pompScore: 71, thresholdLow: 40, thresholdHigh: 70 },
          },
          {
            entityId: 'dim-4',
            entityName: 'Collaboration',
            pompScore: 58,
            bandResult: { band: 'mid', bandLabel: 'Effective', pompScore: 58, thresholdLow: 40, thresholdHigh: 70 },
          },
          {
            entityId: 'dim-5',
            entityName: 'Resilience',
            pompScore: 45,
            bandResult: { band: 'mid', bandLabel: 'Effective', pompScore: 45, thresholdLow: 40, thresholdHigh: 70 },
          },
        ],
        config: { chartType: 'bar', displayLevel: 'dimension' },
      }

    case 'score_detail':
      return {
        entityId: 'dim-1',
        entityName: 'Strategic Thinking',
        entitySlug: 'strategic-thinking',
        definition:
          'The capacity to think beyond immediate challenges and consider broader implications for the organisation.',
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

    case 'strengths_highlights':
      return {
        highlights: [
          {
            entityId: 'dim-1',
            entityName: 'Strategic Thinking',
            pompScore: 82,
            bandResult: { band: 'high', bandLabel: 'Highly Effective' },
            narrative:
              'You consistently demonstrate the ability to see beyond current circumstances and articulate a compelling picture of what is possible.',
          },
          {
            entityId: 'dim-2',
            entityName: 'Communication',
            pompScore: 74,
            bandResult: { band: 'high', bandLabel: 'Highly Effective' },
            narrative:
              'Your clarity and influence in written and verbal expression across different audiences is a distinctive strength.',
          },
          {
            entityId: 'dim-3',
            entityName: 'Adaptability',
            pompScore: 71,
            bandResult: { band: 'high', bandLabel: 'Highly Effective' },
            narrative: 'You show flexibility in approach when facing changing circumstances or ambiguity.',
          },
        ],
        config: { topN: 3, style: 'cards' },
      }

    case 'development_plan':
      return {
        items: [
          {
            entityId: 'dim-5',
            entityName: 'Resilience',
            pompScore: 45,
            suggestion:
              'Develop a personal stress-management protocol — identify your early warning signals and build in recovery practices before they escalate.',
          },
          {
            entityId: 'dim-4',
            entityName: 'Collaboration',
            pompScore: 58,
            suggestion:
              'Seek structured feedback from peers on how effectively you integrate diverse viewpoints during collaborative problem-solving.',
          },
          {
            entityId: 'dim-2',
            entityName: 'Communication',
            pompScore: 74,
            suggestion:
              'Practice time-boxed decision-making in lower-stakes situations to build comfort with acting on incomplete information.',
          },
        ],
        config: { maxItems: 3 },
      }

    case 'custom_text':
      return {
        heading: 'About This Assessment',
        content:
          'This report presents your results from the Leadership Assessment. The findings are based on your self-assessment responses and are intended as a development tool, not a definitive evaluation.',
      }

    case 'section_divider':
      return {
        title: 'Detailed Results',
        subtitle: 'Your scores across all dimensions',
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
