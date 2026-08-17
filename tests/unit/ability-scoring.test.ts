import { describe, expect, it } from 'vitest'
import {
  classifyEntry,
  classifyRTETier,
  computeRTE,
  computeServerLatencies,
  highWaterMark,
  isRapidGuess,
  RAPID_GUESS_THRESHOLD_MS,
} from '@/lib/scoring/ability-scoring'

// ---------------------------------------------------------------------------
// highWaterMark
// ---------------------------------------------------------------------------
describe('highWaterMark', () => {
  it('is the highest position with a saved response', () => {
    const entries = [{ position: 1 }, { position: 2 }, { position: 3 }, { position: 4 }]
    expect(highWaterMark(entries, new Set([1, 3]))).toBe(3)
  })

  it('is 0 when nothing was answered', () => {
    const entries = [{ position: 1 }, { position: 2 }]
    expect(highWaterMark(entries, new Set())).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// classifyEntry — the outcome/counts_toward_score matrix
// ---------------------------------------------------------------------------
describe('classifyEntry', () => {
  const base = {
    hasResponse: false,
    resolvedOptionId: null,
    correctOptionId: 'opt-correct',
    sectionExpired: false,
    position: 3,
    sectionHighWaterMark: 5,
  }

  describe('a section marked Practice never contributes', () => {
    // The case that motivated this: practice items in a real pilot are
    // ordinary bank items with purpose 'construct'. Nothing about the ITEM
    // says practice — only the section it was placed in does. Reading
    // items.purpose alone scored the practice section.
    it('excludes an ordinary construct item delivered in a practice section', () => {
      expect(
        classifyEntry({
          ...base,
          purpose: 'construct',
          sectionRole: 'practice',
          hasResponse: true,
          resolvedOptionId: 'opt-correct',
        }),
      ).toEqual({
        outcome: 'excluded',
        countsTowardScore: false,
        chosenOptionId: 'opt-correct',
      })
    })

    it('excludes it even when the answer was right', () => {
      const scored = classifyEntry({
        ...base,
        purpose: 'construct',
        sectionRole: 'scored',
        hasResponse: true,
        resolvedOptionId: 'opt-correct',
      })
      const practice = classifyEntry({
        ...base,
        purpose: 'construct',
        sectionRole: 'practice',
        hasResponse: true,
        resolvedOptionId: 'opt-correct',
      })
      expect(scored.outcome).toBe('correct')
      expect(scored.countsTowardScore).toBe(true)
      expect(practice.outcome).toBe('excluded')
      expect(practice.countsTowardScore).toBe(false)
    })

    it('excludes an instructions section too', () => {
      expect(
        classifyEntry({ ...base, purpose: 'construct', sectionRole: 'instructions' }).countsTowardScore,
      ).toBe(false)
    })

    it('scores normally when the section is scored, or when no role is supplied', () => {
      for (const sectionRole of ['scored', undefined, null]) {
        const result = classifyEntry({
          ...base,
          purpose: 'construct',
          sectionRole,
          hasResponse: true,
          resolvedOptionId: 'opt-correct',
        })
        expect(result).toEqual({
          outcome: 'correct',
          countsTowardScore: true,
          chosenOptionId: 'opt-correct',
        })
      }
    })

    it('still excludes a practice-purpose item inside a scored section', () => {
      // The two rules are independent; neither replaces the other.
      expect(
        classifyEntry({ ...base, purpose: 'practice', sectionRole: 'scored' }).countsTowardScore,
      ).toBe(false)
    })
  })

  it('practice items are always excluded, regardless of response', () => {
    expect(classifyEntry({ ...base, purpose: 'practice', hasResponse: true, resolvedOptionId: 'x' })).toEqual({
      outcome: 'excluded',
      countsTowardScore: false,
      chosenOptionId: 'x',
    })
    expect(classifyEntry({ ...base, purpose: 'practice' })).toEqual({
      outcome: 'excluded',
      countsTowardScore: false,
      chosenOptionId: null,
    })
  })

  it('non-cognitive validity purposes (no answer key) are excluded, not aborted', () => {
    for (const purpose of ['impression_management', 'infrequency', 'attention_check']) {
      expect(classifyEntry({ ...base, purpose })).toEqual({
        outcome: 'excluded',
        countsTowardScore: false,
        chosenOptionId: null,
      })
    }
  })

  it('a construct item with a matching response is correct and counts', () => {
    expect(
      classifyEntry({ ...base, purpose: 'construct', hasResponse: true, resolvedOptionId: 'opt-correct' }),
    ).toEqual({ outcome: 'correct', countsTowardScore: true, chosenOptionId: 'opt-correct' })
  })

  it('a construct item with a non-matching response is incorrect and counts', () => {
    expect(
      classifyEntry({ ...base, purpose: 'construct', hasResponse: true, resolvedOptionId: 'opt-wrong' }),
    ).toEqual({ outcome: 'incorrect', countsTowardScore: true, chosenOptionId: 'opt-wrong' })
  })

  it('an unresolved response value (no matching option) is incorrect, not a crash', () => {
    expect(
      classifyEntry({ ...base, purpose: 'construct', hasResponse: true, resolvedOptionId: null }),
    ).toEqual({ outcome: 'incorrect', countsTowardScore: true, chosenOptionId: null })
  })

  it('seed items are scored right/wrong but never count toward the factor score', () => {
    expect(
      classifyEntry({ ...base, purpose: 'seed', hasResponse: true, resolvedOptionId: 'opt-correct' }),
    ).toEqual({ outcome: 'correct', countsTowardScore: false, chosenOptionId: 'opt-correct' })
    expect(
      classifyEntry({ ...base, purpose: 'seed', hasResponse: true, resolvedOptionId: 'opt-wrong' }),
    ).toEqual({ outcome: 'incorrect', countsTowardScore: false, chosenOptionId: 'opt-wrong' })
  })

  it('no response, section not expired -> omitted (seen and skipped)', () => {
    expect(classifyEntry({ ...base, purpose: 'construct', sectionExpired: false, position: 2, sectionHighWaterMark: 5 })).toEqual(
      { outcome: 'omitted', countsTowardScore: true, chosenOptionId: null },
    )
  })

  it('no response, section expired, position at or below the high-water mark -> omitted', () => {
    expect(
      classifyEntry({ ...base, purpose: 'construct', sectionExpired: true, position: 4, sectionHighWaterMark: 5 }),
    ).toEqual({ outcome: 'omitted', countsTowardScore: true, chosenOptionId: null })
  })

  it('no response, section expired, position past the high-water mark -> expired_unseen (never reached)', () => {
    expect(
      classifyEntry({ ...base, purpose: 'construct', sectionExpired: true, position: 8, sectionHighWaterMark: 5 }),
    ).toEqual({ outcome: 'expired_unseen', countsTowardScore: true, chosenOptionId: null })
  })

  it('not-reached and omitted are never the same outcome for the same shape of input', () => {
    const omitted = classifyEntry({
      ...base,
      purpose: 'construct',
      sectionExpired: true,
      position: 5,
      sectionHighWaterMark: 5,
    })
    const notReached = classifyEntry({
      ...base,
      purpose: 'construct',
      sectionExpired: true,
      position: 6,
      sectionHighWaterMark: 5,
    })
    expect(omitted.outcome).toBe('omitted')
    expect(notReached.outcome).toBe('expired_unseen')
    expect(omitted.outcome).not.toBe(notReached.outcome)
  })
})

// ---------------------------------------------------------------------------
// computeServerLatencies
// ---------------------------------------------------------------------------
describe('computeServerLatencies', () => {
  it('derives latency from the gap to the section start for the first answer', () => {
    const start = Date.parse('2026-08-13T10:00:00.000Z')
    const answeredAt = Date.parse('2026-08-13T10:00:05.000Z')
    const result = computeServerLatencies(
      [{ itemId: 'i1', answeredAtMs: answeredAt, responseTimeMs: 9999 }],
      start,
    )
    expect(result).toEqual([{ itemId: 'i1', latencyMs: 5000, source: 'server_gap' }])
  })

  it('derives latency from the gap to the previous chronological answer', () => {
    const start = Date.parse('2026-08-13T10:00:00.000Z')
    const t1 = Date.parse('2026-08-13T10:00:05.000Z')
    const t2 = Date.parse('2026-08-13T10:00:11.000Z')
    const result = computeServerLatencies(
      [
        { itemId: 'i2', answeredAtMs: t2, responseTimeMs: null },
        { itemId: 'i1', answeredAtMs: t1, responseTimeMs: null },
      ],
      start,
    )
    expect(result.find((r) => r.itemId === 'i1')).toEqual({ itemId: 'i1', latencyMs: 5000, source: 'server_gap' })
    expect(result.find((r) => r.itemId === 'i2')).toEqual({ itemId: 'i2', latencyMs: 6000, source: 'server_gap' })
  })

  it('falls back to the client-reported value only for the first answer with no section start', () => {
    const t1 = Date.parse('2026-08-13T10:00:05.000Z')
    const t2 = Date.parse('2026-08-13T10:00:11.000Z')
    const result = computeServerLatencies(
      [
        { itemId: 'i1', answeredAtMs: t1, responseTimeMs: 2500 },
        { itemId: 'i2', answeredAtMs: t2, responseTimeMs: 999 },
      ],
      null,
    )
    expect(result.find((r) => r.itemId === 'i1')).toEqual({ itemId: 'i1', latencyMs: 2500, source: 'client_fallback' })
    // Once we have ANY chronological anchor (i1's answeredAt), subsequent
    // items use the trustworthy server gap, not the client value.
    expect(result.find((r) => r.itemId === 'i2')).toEqual({ itemId: 'i2', latencyMs: 6000, source: 'server_gap' })
  })

  it('reports "none" for an item with no response at all', () => {
    const result = computeServerLatencies([{ itemId: 'i1', answeredAtMs: null, responseTimeMs: null }], null)
    expect(result).toEqual([{ itemId: 'i1', latencyMs: null, source: 'none' }])
  })

  it('never produces a negative latency', () => {
    // Defensive: answered before the section's recorded start should not happen,
    // but clamp rather than emit a negative number if it ever does.
    const start = Date.parse('2026-08-13T10:00:10.000Z')
    const answeredAt = Date.parse('2026-08-13T10:00:05.000Z')
    const result = computeServerLatencies([{ itemId: 'i1', answeredAtMs: answeredAt, responseTimeMs: null }], start)
    expect(result[0].latencyMs).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// isRapidGuess / thresholds
// ---------------------------------------------------------------------------
describe('rapid-guess thresholds', () => {
  it('matrices threshold is 3000ms, deductive is 4000ms', () => {
    expect(RAPID_GUESS_THRESHOLD_MS.figural_matrix).toBe(3000)
    expect(RAPID_GUESS_THRESHOLD_MS.deductive).toBe(4000)
  })

  it('flags a matrix response below 3000ms and not at or above it', () => {
    expect(isRapidGuess(2999, 'figural_matrix')).toBe(true)
    expect(isRapidGuess(3000, 'figural_matrix')).toBe(false)
  })

  it('flags a deductive response below 4000ms and not at or above it', () => {
    expect(isRapidGuess(3999, 'deductive')).toBe(true)
    expect(isRapidGuess(4000, 'deductive')).toBe(false)
  })

  it('never flags a missing latency', () => {
    expect(isRapidGuess(null, 'figural_matrix')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// computeRTE / classifyRTETier
// ---------------------------------------------------------------------------
describe('computeRTE', () => {
  it('computes the proportion of scored items at or above their threshold', () => {
    const items = [
      { countsTowardScore: true, latencyMs: 5000, kind: 'figural_matrix' as const }, // above
      { countsTowardScore: true, latencyMs: 1000, kind: 'figural_matrix' as const }, // below
      { countsTowardScore: true, latencyMs: null, kind: 'figural_matrix' as const }, // omitted -> below
      { countsTowardScore: true, latencyMs: 10000, kind: 'figural_matrix' as const }, // above
      { countsTowardScore: false, latencyMs: 1, kind: 'figural_matrix' as const }, // excluded, ignored
    ]
    const result = computeRTE(items)
    expect(result.itemsUsed).toBe(4)
    expect(result.rte).toBeCloseTo(0.5, 10)
    expect(result.belowThreshold).toBe(2)
  })

  it('defaults to RTE=1 (no penalty) when there are no counted items', () => {
    expect(computeRTE([])).toEqual({ rte: 1, itemsUsed: 0, belowThreshold: 0 })
  })

  it('tiers: >=0.90 normal, 0.80-0.89 advisory, <0.80 blocking', () => {
    expect(classifyRTETier(1)).toBe('normal')
    expect(classifyRTETier(0.9)).toBe('normal')
    expect(classifyRTETier(0.89)).toBe('advisory')
    expect(classifyRTETier(0.8)).toBe('advisory')
    expect(classifyRTETier(0.79)).toBe('blocking')
    expect(classifyRTETier(0)).toBe('blocking')
  })
})
