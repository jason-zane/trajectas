// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComparisonMatrix } from '@/components/comparison/comparison-matrix'
import type { ComparisonResult } from '@/lib/comparison/types'

const data: ComparisonResult = {
  columns: [
    {
      assessmentId: 'a1',
      assessmentName: 'Leadership',
      rollup: { id: 'd1', name: 'Influence', level: 'dimension', parentId: null },
      children: [
        { id: 'f1', name: 'Persuasion', level: 'factor', parentId: 'd1' },
        { id: 'f2', name: 'Empathy', level: 'factor', parentId: 'd1' },
      ],
    },
  ],
  rows: [
    {
      entryId: 'e1',
      campaignParticipantId: 'cp1',
      participantName: 'Sarah',
      participantEmail: 's@x',
      perAssessment: [
        {
          assessmentId: 'a1',
          sessionId: 's1',
          sessionStartedAt: '2026-04-02T10:00:00Z',
          sessionStatus: 'completed',
          attemptNumber: 2,
          cells: { d1: 75, f1: 72, f2: 78 },
        },
      ],
    },
    {
      entryId: 'e2',
      campaignParticipantId: 'cp2',
      participantName: 'Marcus',
      participantEmail: 'm@x',
      perAssessment: [
        {
          assessmentId: 'a1',
          sessionId: null,
          sessionStartedAt: null,
          sessionStatus: null,
          attemptNumber: null,
          cells: { d1: null, f1: null, f2: null },
        },
      ],
    },
  ],
}

describe('ComparisonMatrix', () => {
  it('renders group + child headers and row cells', () => {
    render(
      <ComparisonMatrix data={data} getCellStyle={() => ({})} onChangeRowSession={() => {}} />,
    )
    expect(screen.getByText('Leadership')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /persuasion/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /empathy/i })).toBeInTheDocument()
    expect(screen.getByText('72')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('sorts rows by clicking a child header (descending first, dashes last)', () => {
    render(
      <ComparisonMatrix data={data} getCellStyle={() => ({})} onChangeRowSession={() => {}} />,
    )
    const header = screen.getByRole('button', { name: /persuasion/i })
    fireEvent.click(header)
    const names = screen.getAllByTestId('row-name').map((n) => n.textContent)
    expect(names[0]).toBe('Sarah')
    expect(names[1]).toBe('Marcus')
  })

  it('invokes onChangeRowSession when the date cell is clicked', () => {
    const calls: string[] = []
    render(
      <ComparisonMatrix
        data={data}
        getCellStyle={() => ({})}
        onChangeRowSession={(id) => calls.push(id)}
      />,
    )
    const dateButton = screen.getAllByText(/2026/)[0]
    fireEvent.click(dateButton)
    expect(calls).toEqual(['e1'])
  })
})
