// =============================================================================
// src/lib/reports/sample-data.ts — Sample data generator for template preview
// =============================================================================

import type { ResolvedBlockData, BlockConfig, BlockType } from './types'
import type { ReportTheme } from './presentation'
import { isDeferredBlockType, parseBlocks } from './registry'

// ---------------------------------------------------------------------------
// Sample entity pool — enough entries to support topN/maxItems up to 10
// ---------------------------------------------------------------------------

const SAMPLE_ENTITIES = [
  { entityId: 'dim-1', entityName: 'AI Literacy', pompScore: 82, band: 'high' as const, bandLabel: 'Highly Proficient' },
  { entityId: 'dim-2', entityName: 'Prompt Engineering', pompScore: 74, band: 'high' as const, bandLabel: 'Highly Proficient' },
  { entityId: 'dim-3', entityName: 'Critical Evaluation', pompScore: 71, band: 'high' as const, bandLabel: 'Highly Proficient' },
  { entityId: 'dim-4', entityName: 'Ethical Reasoning', pompScore: 58, band: 'mid' as const, bandLabel: 'Developing' },
  { entityId: 'dim-5', entityName: 'Data Interpretation', pompScore: 45, band: 'mid' as const, bandLabel: 'Developing' },
  { entityId: 'dim-6', entityName: 'Tool Integration', pompScore: 68, band: 'mid' as const, bandLabel: 'Developing' },
  { entityId: 'dim-7', entityName: 'Automation Thinking', pompScore: 77, band: 'high' as const, bandLabel: 'Highly Proficient' },
  { entityId: 'dim-8', entityName: 'Creative Application', pompScore: 63, band: 'mid' as const, bandLabel: 'Developing' },
  { entityId: 'dim-9', entityName: 'Collaboration with AI', pompScore: 55, band: 'mid' as const, bandLabel: 'Developing' },
  { entityId: 'dim-10', entityName: 'Risk Awareness', pompScore: 39, band: 'low' as const, bandLabel: 'Emerging' },
]

const STRENGTH_COMMENTARIES = [
  'You demonstrate strong foundational understanding of AI systems and how they can be applied effectively in professional contexts.',
  'Your ability to craft clear, context-rich prompts that produce reliable outputs is a consistent and distinctive strength.',
  'You approach AI-generated content with healthy scepticism, cross-referencing outputs and identifying limitations effectively.',
  'You apply thoughtful consideration to the ethical implications of AI use, flagging risks and advocating for responsible practices.',
  'Your ability to extract meaningful insights from AI-generated data and translate them into actionable decisions stands out.',
  'You integrate AI tools into your existing workflows efficiently, reducing friction and maximising productivity gains.',
  'You identify automation opportunities systematically and design solutions that free up human capacity for higher-value work.',
  'You combine AI capabilities with creative thinking to generate novel solutions that go beyond templated outputs.',
  'You collaborate effectively with AI systems as a working partner, adjusting your approach based on model behaviour and limitations.',
  'You demonstrate a clear understanding of AI failure modes, bias risks, and when human oversight is essential.',
]

const DEVELOPMENT_SUGGESTIONS = [
  'Deepen your understanding of emerging AI modalities beyond text — including multimodal and agentic systems — to expand your range of application.',
  'Experiment with structured prompt frameworks such as chain-of-thought and few-shot prompting to improve output consistency.',
  'Build a personal evaluation rubric for assessing AI output quality across factual accuracy, relevance, and tone before using outputs in critical contexts.',
  'Seek out case studies on AI ethics failures to sharpen your ability to anticipate downstream consequences of AI decisions.',
  'Practice interpreting outputs from AI-assisted data analysis tools to strengthen your data literacy alongside AI fluency.',
  'Identify one high-friction workflow per month and explore whether an AI tool exists that could meaningfully reduce that friction.',
  'Map a current manual process end-to-end before automating it — this discipline ensures automation decisions are grounded in real understanding.',
  'Set aside time for exploratory, low-stakes AI experimentation to build creative fluency without performance pressure.',
  'Establish shared team norms around how AI outputs should be reviewed and attributed to build collective accountability.',
  'Stay current on published AI risk frameworks and apply at least one to an upcoming project or decision.',
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

    const data = generateBlockSampleData(block.type, block.config as Record<string, unknown>)

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

function makeBandResult(entity: (typeof SAMPLE_ENTITIES)[number]) {
  return { band: entity.band, bandLabel: entity.bandLabel, pompScore: entity.pompScore, thresholdLow: 40, thresholdHigh: 70 }
}

function generateBlockSampleData(type: BlockType, config: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case 'cover_page':
      return {
        participantName: 'Alex Morgan',
        campaignTitle: 'AI Capability Index',
        generatedAt: new Date().toISOString(),
        showDate: config.showDate !== false,
        showLogo: config.showLogo !== false,
        showPoweredBy: config.showPoweredBy === true,
        poweredByText: typeof config.poweredByText === 'string' && config.poweredByText
          ? config.poweredByText
          : 'Powered by Trajectas',
      }

    case 'score_overview':
      return {
        scores: SAMPLE_ENTITIES.slice(0, 5).map((e) => ({
          entityId: e.entityId,
          entityName: e.entityName,
          pompScore: e.pompScore,
          bandResult: makeBandResult(e),
        })),
        config: {
          displayLevel: config.displayLevel ?? 'factor',
          showScore: config.showScore !== false,
          showBandLabel: config.showBandLabel !== false,
          groupByDimension: config.groupByDimension === true,
        },
      }

    case 'score_detail':
      return {
        entityId: 'dim-1',
        entityName: 'AI Literacy',
        entitySlug: 'ai-literacy',
        definition:
          'Understanding of AI concepts, capabilities, and limitations — and the ability to work effectively alongside AI systems in professional contexts.',
        pompScore: 82,
        bandResult: {
          band: 'high',
          bandLabel: 'Highly Proficient',
          pompScore: 82,
          thresholdLow: 40,
          thresholdHigh: 70,
        },
        narrative:
          'You demonstrate strong foundational understanding of AI systems and how they can be applied effectively in professional contexts. Your ability to distinguish between AI capabilities and limitations is a clear strength that enables confident, well-calibrated use.',
        developmentSuggestion:
          'Deepen your understanding of emerging AI modalities beyond text — including multimodal and agentic systems — to expand your range of application and stay ahead of the capability curve.',
        config: {
          showScore: config.showScore !== false,
          showBandLabel: config.showBandLabel !== false,
          showDefinition: config.showDefinition !== false,
          showIndicators: config.showIndicators !== false,
          showDevelopment: config.showDevelopment === true,
          showNestedScores: config.showNestedScores === true,
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
