import { describe, it, expect } from 'vitest'
import { buildContentsSections, type ContentsDimension } from '@/lib/reports/contents-sections'
import type { BlockConfig } from '@/lib/reports/types'

function block(type: BlockConfig['type'], overrides: Partial<BlockConfig> = {}): BlockConfig {
  return {
    id: `${type}-${overrides.order ?? 0}`,
    type,
    order: 0,
    config: {},
    ...overrides,
  } as BlockConfig
}

const DIMS: ContentsDimension[] = [
  { id: 'dim-1', name: 'Leading', pompScore: 68, bandResult: { bandKey: 'effective', bandLabel: 'Effective', bandIndex: 1, bandCount: 3, indicatorTier: 'mid', pompScore: 68 } },
  { id: 'dim-2', name: 'Thinking', pompScore: 60, bandResult: { bandKey: 'effective', bandLabel: 'Effective', bandIndex: 1, bandCount: 3, indicatorTier: 'mid', pompScore: 60 } },
]

describe('buildContentsSections', () => {
  it('derives sections in block order with default labels', () => {
    const sections = buildContentsSections(
      [
        block('cover_page'),
        block('contents'),
        block('score_overview'),
        block('dimension_chapter'),
        block('development_plan'),
        block('closing_page'),
      ],
      DIMS,
    )
    expect(sections.map((s) => s.label)).toEqual([
      'Your profile at a glance',
      'Leading',
      'Thinking',
      'Development priorities',
      'About this report',
    ])
  })

  it('expands dimension chapters into one row per dimension with scores', () => {
    const sections = buildContentsSections([block('dimension_chapter')], DIMS)
    expect(sections).toHaveLength(2)
    expect(sections[0]).toMatchObject({ label: 'Leading', kind: 'dimension', pompScore: 68 })
    expect(sections[0].bandResult?.bandLabel).toBe('Effective')
  })

  it('carries pagination target ids: block id for sections, dim:<id> for chapters', () => {
    const sections = buildContentsSections(
      [block('score_overview'), block('dimension_chapter')],
      DIMS,
    )
    expect(sections[0].targetId).toBe('score_overview-0')
    expect(sections[1].targetId).toBe('dim:dim-1')
    expect(sections[2].targetId).toBe('dim:dim-2')
  })

  it('respects the dimensionIds filter on chapter blocks', () => {
    const sections = buildContentsSections(
      [block('dimension_chapter', { config: { dimensionIds: ['dim-2'] } as BlockConfig['config'] })],
      DIMS,
    )
    expect(sections.map((s) => s.label)).toEqual(['Thinking'])
  })

  it('prefers an authored heading over the default label', () => {
    const sections = buildContentsSections(
      [block('score_overview', { heading: 'Your profile' })],
      DIMS,
    )
    expect(sections[0].label).toBe('Your profile')
  })

  it('includes text blocks only when they carry a heading', () => {
    const sections = buildContentsSections(
      [block('custom_text'), block('custom_text', { order: 1, heading: 'Welcome' })],
      DIMS,
    )
    expect(sections.map((s) => s.label)).toEqual(['Welcome'])
  })

  it('never lists cover, contents, or dividers', () => {
    const sections = buildContentsSections(
      [block('cover_page'), block('contents'), block('section_divider')],
      DIMS,
    )
    expect(sections).toEqual([])
  })
})
