/**
 * Unit tests for likert anchor → option-value derivation and normalization.
 *
 * Pins the fix for an off-by-one: the response-format admin form saves
 * anchors as a plain array, and consumers that used Object.entries() over it
 * produced 0-indexed option values (array indices) against the format's
 * 1-based scoring bounds — so "Strongly Agree" on a UI-created 5-point scale
 * scored 75 POMP instead of 100, and "Strongly Disagree" went negative.
 */

import { describe, expect, it } from 'vitest'
import { likertAnchorOptions, normalizeLikertAnchors } from '@/lib/assess/likert-anchors'

describe('likertAnchorOptions', () => {
  it('maps record-shaped anchors (canonical DB shape) to their keyed values', () => {
    expect(
      likertAnchorOptions({ '1': 'Strongly Disagree', '2': 'Disagree', '3': 'Agree' }),
    ).toEqual([
      { label: 'Strongly Disagree', value: 1 },
      { label: 'Disagree', value: 2 },
      { label: 'Agree', value: 3 },
    ])
  })

  it('sorts record-shaped anchors by numeric key', () => {
    expect(likertAnchorOptions({ '10': 'Ten', '2': 'Two' })).toEqual([
      { label: 'Two', value: 2 },
      { label: 'Ten', value: 10 },
    ])
  })

  it('maps array-shaped anchors to 1-based values, not 0-based indices', () => {
    expect(likertAnchorOptions(['Never', 'Sometimes', 'Always'])).toEqual([
      { label: 'Never', value: 1 },
      { label: 'Sometimes', value: 2 },
      { label: 'Always', value: 3 },
    ])
  })

  it('covers the full range of a 7-point array-shaped scale', () => {
    const options = likertAnchorOptions(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
    expect(options[0]).toEqual({ label: 'a', value: 1 })
    expect(options[6]).toEqual({ label: 'g', value: 7 })
  })

  it('returns empty for missing or non-object anchors', () => {
    expect(likertAnchorOptions(undefined)).toEqual([])
    expect(likertAnchorOptions(null)).toEqual([])
    expect(likertAnchorOptions('Agree')).toEqual([])
  })
})

describe('normalizeLikertAnchors', () => {
  it('re-keys array anchors to the 1-based record shape', () => {
    expect(
      normalizeLikertAnchors({ points: 3, anchors: ['Low', 'Mid', 'High'] }),
    ).toEqual({ points: 3, anchors: { '1': 'Low', '2': 'Mid', '3': 'High' } })
  })

  it('leaves record-shaped anchors untouched', () => {
    const config = { points: 2, anchors: { '1': 'No', '2': 'Yes' } }
    expect(normalizeLikertAnchors(config)).toBe(config)
  })

  it('leaves configs without anchors untouched', () => {
    const config = { maxLength: 500 }
    expect(normalizeLikertAnchors(config)).toBe(config)
  })
})
