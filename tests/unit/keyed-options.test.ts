/**
 * Unit tests for option-level keyed scoring (SJT expert keys, binary
 * correct/incorrect, scored categorical single-select, "Don't know").
 */

import { describe, expect, it } from 'vitest'
import { isKeyedItem, scoreKeyedResponse, type ScorableOption } from '@/lib/scoring/keyed-options'

const opt = (
  value: number,
  scoreValue: number | null,
  excludeFromScoring = false,
): ScorableOption => ({ value, scoreValue, excludeFromScoring })

/** SJT-style 4-option item with expert keys 0 / 1 / 3 / 5. */
const sjtOptions = [opt(1, 0), opt(2, 1), opt(3, 3), opt(4, 5)]

describe('isKeyedItem', () => {
  it('is true when any option carries a key', () => {
    expect(isKeyedItem(sjtOptions)).toBe(true)
    expect(isKeyedItem([opt(1, null), opt(2, 1)])).toBe(true)
  })

  it('is false for unkeyed options (plain likert/binary items)', () => {
    expect(isKeyedItem([opt(1, null), opt(2, null)])).toBe(false)
    expect(isKeyedItem([])).toBe(false)
  })
})

describe('scoreKeyedResponse', () => {
  it('scores an SJT response by its expert key, scaled across the key range', () => {
    expect(scoreKeyedResponse(1, sjtOptions)).toEqual({ kind: 'scored', pomp: 0 })
    expect(scoreKeyedResponse(2, sjtOptions)).toEqual({ kind: 'scored', pomp: 20 })
    expect(scoreKeyedResponse(3, sjtOptions)).toEqual({ kind: 'scored', pomp: 60 })
    expect(scoreKeyedResponse(4, sjtOptions)).toEqual({ kind: 'scored', pomp: 100 })
  })

  it('scores binary correct/incorrect keys as 100/0', () => {
    const options = [opt(0, 0), opt(1, 1)]
    expect(scoreKeyedResponse(1, options)).toEqual({ kind: 'scored', pomp: 100 })
    expect(scoreKeyedResponse(0, options)).toEqual({ kind: 'scored', pomp: 0 })
  })

  it('supports negative keys (penalty scoring)', () => {
    const options = [opt(1, -1), opt(2, 0), opt(3, 2)]
    expect(scoreKeyedResponse(1, options)).toEqual({ kind: 'scored', pomp: 0 })
    expect(scoreKeyedResponse(2, options)).toEqual({
      kind: 'scored',
      pomp: (1 / 3) * 100,
    })
    expect(scoreKeyedResponse(3, options)).toEqual({ kind: 'scored', pomp: 100 })
  })

  it("reports 'excluded' when the participant chose a Don't-know option", () => {
    const options = [...sjtOptions, opt(9, null, true)]
    expect(scoreKeyedResponse(9, options)).toEqual({ kind: 'excluded' })
  })

  it('excluded options do not stretch the key range', () => {
    // Excluded option carries a stray key that must be ignored.
    const options = [opt(1, 0), opt(2, 5), opt(9, 100, true)]
    expect(scoreKeyedResponse(2, options)).toEqual({ kind: 'scored', pomp: 100 })
  })

  it("reports 'unkeyable' for a response matching no option", () => {
    expect(scoreKeyedResponse(42, sjtOptions)).toEqual({ kind: 'unkeyable' })
  })

  it("reports 'unkeyable' when the chosen option has no key", () => {
    const options = [opt(1, null), opt(2, 5), opt(3, 0)]
    expect(scoreKeyedResponse(1, options)).toEqual({ kind: 'unkeyable' })
  })

  it("reports 'unkeyable' for degenerate keys (all identical)", () => {
    const options = [opt(1, 3), opt(2, 3)]
    expect(scoreKeyedResponse(1, options)).toEqual({ kind: 'unkeyable' })
  })
})
