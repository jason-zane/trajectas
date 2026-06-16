// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComparisonSelectionBar } from '@/components/comparison/comparison-selection-bar'
import type { ComparisonRequest } from '@/lib/comparison/types'

const request: ComparisonRequest = {
  entries: [],
  assessmentIds: [],
  visibleLevels: ['dimension'],
}

function renderBar(onToggleLevel = vi.fn()) {
  render(
    <ComparisonSelectionBar
      rows={[]}
      request={request}
      visibleLevels={['dimension']}
      eligibleAssessments={[]}
      deltaMode={false}
      longitudinal={false}
      onRemoveEntry={vi.fn()}
      onAddEntryClick={vi.fn()}
      onToggleAssessment={vi.fn()}
      onToggleLevel={onToggleLevel}
      onToggleDelta={vi.fn()}
    />,
  )
  return onToggleLevel
}

describe('ComparisonSelectionBar — Show toggle', () => {
  it('renders only the dimension and factor levels', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Dimensions' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Factors' })).toBeDefined()
    // No third, unlabelled level button (the old 'construct' entry had no
    // LEVEL_LABEL key and rendered as an empty pill).
    const pressable = screen
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-pressed'))
    // Dimensions, Factors, and the Δ-vs-mean toggle.
    expect(pressable.map((b) => b.textContent)).toEqual([
      'Dimensions',
      'Factors',
      'Δ vs mean',
    ])
  })

  it('toggles only valid column levels', () => {
    const onToggleLevel = renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'Factors' }))
    expect(onToggleLevel).toHaveBeenCalledExactlyOnceWith('factor')
  })
})
