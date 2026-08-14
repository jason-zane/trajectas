// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CognitiveProfileBlock } from '@/components/reports/blocks/cognitive-profile'
import type { CognitiveScoreDisplay } from '@/lib/reports/cognitive-claims'

// -----------------------------------------------------------------------------
// LR-11 / #341 — cognitive_profile is the only block permitted to render a
// cognitive/ability score. These tests pin the render rules directly against
// the resolved CognitiveScoreDisplay union (never a raw row), matching what
// runner.ts's resolveBlockData actually hands the component.
// -----------------------------------------------------------------------------

function uncalibrated(overrides: Partial<Extract<CognitiveScoreDisplay, { kind: 'uncalibrated' }>> = {}): CognitiveScoreDisplay {
  return {
    kind: 'uncalibrated',
    provisional: true,
    rawCorrect: 19,
    itemsUsed: 28,
    itemsAttempted: 26,
    ...overrides,
  }
}

function calibrated(overrides: Partial<Extract<CognitiveScoreDisplay, { kind: 'calibrated' }>> = {}): CognitiveScoreDisplay {
  return {
    kind: 'calibrated',
    provisional: false,
    tScore: 58,
    percentile: 72,
    confidenceIntervalLower: 50,
    confidenceIntervalUpper: 66,
    normGroupId: 'ng-123',
    normVersion: '2027.1',
    ...overrides,
  }
}

describe('CognitiveProfileBlock', () => {
  it('renders nothing when there are no cognitive entities (matches other blocks\' _empty convention)', () => {
    const { container } = render(<CognitiveProfileBlock data={{ _empty: true, reason: 'no cognitive scores' }} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when entities is missing entirely', () => {
    const { container } = render(<CognitiveProfileBlock data={{}} />)
    expect(container.firstChild).toBeNull()
  })

  it('an uncalibrated score renders as a raw count, never a percentile/band, plus the mandatory no-comparison panel', () => {
    const { getByText, queryByText } = render(
      <CognitiveProfileBlock
        data={{
          entities: [
            { entityId: 'f-lrm', entityName: 'Inductive reasoning', display: uncalibrated() },
          ],
        }}
      />,
    )
    expect(getByText('19 of 28 items correct')).toBeTruthy()
    expect(getByText('There is no comparison group for this score yet.')).toBeTruthy()
    // Never a rendered percentile/T-score/band number for an uncalibrated
    // score — the component's copy explicitly disclaims "a percentile" in
    // prose (asserted above via the no-comparison panel text), but no
    // "Nth percentile" or "T = n" claim is ever printed.
    expect(queryByText(/\d+(st|nd|rd|th) percentile/i)).toBeNull()
    expect(queryByText(/T = /)).toBeNull()
    // The non-dismissible provisional banner, since provisional=true here.
    expect(getByText(/Pilot — not for selection decisions/)).toBeTruthy()
  })

  it('a calibrated score renders T-score, percentile, interval, and norm-group attribution — all sourced from the resolved object', () => {
    const { getByText, queryByText } = render(
      <CognitiveProfileBlock
        data={{
          entities: [
            { entityId: 'f-lrm', entityName: 'Inductive reasoning', display: calibrated() },
          ],
        }}
      />,
    )
    expect(getByText(/T = 58/)).toBeTruthy()
    expect(getByText(/72th percentile/)).toBeTruthy()
    expect(getByText(/50–66/)).toBeTruthy()
    expect(getByText(/ng-123/)).toBeTruthy()
    expect(getByText(/2027\.1/)).toBeTruthy()
    // provisional=false here, so no pilot banner.
    expect(queryByText(/Pilot — not for selection decisions/)).toBeNull()
  })

  it('renders multiple entities, each independently, sorted as provided by the runner', () => {
    const { getByText } = render(
      <CognitiveProfileBlock
        data={{
          entities: [
            { entityId: 'f-lrm', entityName: 'Inductive reasoning', display: uncalibrated({ rawCorrect: 12, itemsUsed: 18, itemsAttempted: 17 }) },
            { entityId: 'f-lrd', entityName: 'Deductive reasoning', display: uncalibrated({ rawCorrect: 7, itemsUsed: 10, itemsAttempted: 9 }) },
          ],
        }}
      />,
    )
    expect(getByText('12 of 18 items correct')).toBeTruthy()
    expect(getByText('7 of 10 items correct')).toBeTruthy()
    expect(getByText('INDUCTIVE REASONING')).toBeTruthy()
    expect(getByText('DEDUCTIVE REASONING')).toBeTruthy()
  })
})
