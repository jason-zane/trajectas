// @vitest-environment jsdom
import { it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { LikertQualitySummary } from '@/components/instruments/likert-quality-summary'
import type { LikertAuditReport } from '@/lib/instrument/likert/contracts'

it('keeps selected counts and reliability scenarios separate when construct names repeat', () => {
  const report: LikertAuditReport = {
    status: { jobId: 'job', phase: 'review', round: 1, detail: 'Current checks', totalCandidates: 7, reviewed: 7, passed: 7, selected: 6, target: 8, blockers: [], ready: false },
    spec: { version: 'likert-v1', measureType: 'trait', brief: 'Work habits', audience: {}, useContext: 'development', timeframe: 'Past three months', readingCeiling: 8, itemsPerConstruct: 4, reverseProportion: 0.25, scoreDirection: 'More of each construct',
      format: { id: 'format', name: 'Agreement', points: 5, anchorType: 'agreement', anchors: { 1: 'Strongly disagree', 2: 'Disagree', 3: 'Neutral', 4: 'Agree', 5: 'Strongly agree' } },
      constructs: ['a', 'b'].map(id => ({ id, name: 'Same display name', definition: `Definition for ${id}`, exclusions: [], cells: [] })) },
    specHash: 'hash', calls: 10, targetAlphaGoal: 0.8,
    models: { writer: 'a/writer', blueprint: 'b/blueprint', reviewers: ['a/reviewer', 'b/reviewer', 'c/reviewer'] },
    items: ['a', 'a', 'a', 'a', 'b', 'b', 'b'].map((constructId, index) => ({ id: `item-${index}`, stem: 'A statement', reverseScored: false, constructId, construct: 'Same display name', facet: 'Facet', selected: index !== 6, quality: null })),
  }
  render(<LikertQualitySummary report={report} />)
  const rows = screen.getAllByRole('row').slice(1)
  expect(rows.map(row => within(row).getAllByRole('cell').map(cell => cell.textContent))).toEqual([
    ['Same display name', '4', '0.31', '0.50', '0.63'],
    ['Same display name', '2', '0.18', '0.33', '0.46'],
  ])
  expect(screen.getByText(/not a measured result/)).toBeDefined()
})
