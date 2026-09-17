import { describe, expect, it } from 'vitest'
import { validatePicks } from '@/lib/public-builds/validation'

const ranked = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9']

describe('validatePicks', () => {
  it('accepts a subset of the ranking within 4..8', () => {
    const result = validatePicks(ranked, ['f1', 'f2', 'f3', 'f4'])
    expect(result).toEqual({ ok: true, picks: ['f1', 'f2', 'f3', 'f4'] })
  })

  it('dedupes repeated picks', () => {
    const result = validatePicks(ranked, ['f1', 'f1', 'f2', 'f3', 'f4'])
    expect(result.ok).toBe(true)
    expect(result.ok && result.picks).toEqual(['f1', 'f2', 'f3', 'f4'])
  })

  it('rejects fewer than 4 picks', () => {
    const result = validatePicks(ranked, ['f1', 'f2', 'f3'])
    expect(result.ok).toBe(false)
  })

  it('rejects more than 8 picks', () => {
    const result = validatePicks(ranked, ranked)
    expect(result.ok).toBe(false)
  })

  it('rejects a pick outside the ranking', () => {
    const result = validatePicks(ranked, ['f1', 'f2', 'f3', 'unknown-factor'])
    expect(result.ok).toBe(false)
  })

  it('accepts exactly 8 picks', () => {
    const result = validatePicks(ranked, ranked.slice(0, 8))
    expect(result.ok).toBe(true)
  })
})
