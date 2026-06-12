// @vitest-environment jsdom

import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { generateSampleData, type PreviewEntity } from '@/lib/reports/sample-data'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

const ENTITIES: PreviewEntity[] = [
  { id: 'dim-1', name: 'Thinking', type: 'dimension', pompScore: 60, description: 'Evidence-led thinking.' },
  { id: 'f-1', name: 'Analytical reasoning', type: 'factor', parentId: 'dim-1', pompScore: 78, definition: 'Breaks problems apart.', developmentSuggestion: 'Practise X.', indicatorsHigh: 'Shows strong analysis.' },
  { id: 'f-2', name: 'Judgement & decision-making', type: 'factor', parentId: 'dim-1', pompScore: 38 },
  { id: 'dim-2', name: 'Leading', type: 'dimension', pompScore: 70 },
  { id: 'f-3', name: 'Strategic vision', type: 'factor', parentId: 'dim-2', pompScore: 82 },
]

// The full 8-page default template arc: cover → contents → at-a-glance →
// chapters → development → closing.
const TEMPLATE_BLOCKS = [
  { id: 'b1', type: 'cover_page', order: 0, config: {} },
  { id: 'b2', type: 'contents', order: 1, config: {} },
  { id: 'b3', type: 'score_overview', order: 2, config: { displayLevel: 'factor', groupByDimension: true, depth: 'glance' }, heading: 'Your profile at a glance' },
  { id: 'b4', type: 'dimension_chapter', order: 3, config: { depth: 'full' } },
  { id: 'b5', type: 'development_plan', order: 4, config: { maxItems: 3, prioritiseByScore: true, showCommitments: true } },
  { id: 'b6', type: 'closing_page', order: 5, config: {} },
]

function renderTemplate() {
  const blocks = generateSampleData(TEMPLATE_BLOCKS, DEFAULT_REPORT_THEME, ENTITIES, 'Standard Report')
  return render(<ReportRenderer blocks={blocks} />)
}

describe('ReportRenderer — full redesigned template', () => {
  it('renders every block of the standard template without crashing', () => {
    const { container, getAllByText } = renderTemplate()
    // Contents lists chapter dimensions; chapters render heroes for both.
    expect(getAllByText('Thinking').length).toBeGreaterThanOrEqual(2)
    expect(getAllByText('Leading').length).toBeGreaterThanOrEqual(2)
    // Full depth carries indicators and the development inset.
    expect(getAllByText('BEHAVIOURAL INDICATORS').length).toBeGreaterThan(0)
    expect(getAllByText('DEVELOPMENT FOCUS').length).toBeGreaterThan(0)
    // Closing page legend + commitments panel.
    expect(getAllByText('SCORE BANDS').length).toBe(1)
    expect(getAllByText('MY COMMITMENTS').length).toBe(1)
    // Factor spine rows are atomic print entries.
    expect(container.querySelectorAll('.report-entry').length).toBeGreaterThan(3)
  })

  it('supports click-to-select in builder preview mode', () => {
    const blocks = generateSampleData(TEMPLATE_BLOCKS, DEFAULT_REPORT_THEME, ENTITIES, 'Standard Report')
    const onSelect = vi.fn()
    const { getAllByText } = render(
      <ReportRenderer blocks={blocks} onBlockSelect={onSelect} selectedBlockId="b3" />,
    )
    fireEvent.click(getAllByText('MY COMMITMENTS')[0])
    expect(onSelect).toHaveBeenCalledWith('b5')
  })
})
