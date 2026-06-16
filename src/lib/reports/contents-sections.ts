// =============================================================================
// src/lib/reports/contents-sections.ts
// Pure helper that derives Contents-block sections from a template's blocks.
// Shared by the runner (real data) and sample-data (builder preview) so the
// two never drift. Page numbers come from the measured pagination pass at
// render time, resolved via each section's targetId.
// =============================================================================

import type { BlockConfig, BandResult } from './types'

export interface ContentsSection {
  label: string
  kind: 'section' | 'dimension'
  pompScore?: number
  bandResult?: BandResult
  /**
   * Anchor id matched against [data-toc-target] markers in the rendered
   * report — the measured pagination pass resolves it to a page number.
   * Block id for sections; `dim:<dimensionId>` for chapter dimensions.
   */
  targetId?: string
}

export interface ContentsDimension {
  id: string
  name: string
  pompScore: number
  bandResult: BandResult
}

const DEFAULT_LABELS: Partial<Record<BlockConfig['type'], string>> = {
  score_overview: 'Your profile at a glance',
  strengths_highlights: 'Signature strengths',
  development_plan: 'Development priorities',
  closing_page: 'About this report',
}

// Block types that never appear in a table of contents.
const EXCLUDED: BlockConfig['type'][] = [
  'cover_page',
  'contents',
  'section_divider',
  'norm_comparison',
  'custom',
]

export function buildContentsSections(
  blocks: BlockConfig[],
  dimensions: ContentsDimension[],
): ContentsSection[] {
  const sections: ContentsSection[] = []

  for (const block of blocks) {
    if (EXCLUDED.includes(block.type)) continue

    if (block.type === 'dimension_chapter') {
      const config = block.config as { dimensionIds?: string[] }
      const filter = config.dimensionIds?.length ? new Set(config.dimensionIds) : null
      for (const dim of dimensions) {
        if (filter && !filter.has(dim.id)) continue
        sections.push({
          label: dim.name,
          kind: 'dimension',
          pompScore: dim.pompScore,
          bandResult: dim.bandResult,
          targetId: `dim:${dim.id}`,
        })
      }
      continue
    }

    const label = block.heading?.trim() || DEFAULT_LABELS[block.type]
    if (!label) continue
    sections.push({ label, kind: 'section', targetId: block.id })
  }

  return sections
}
