import { describe, expect, it } from 'vitest'
import {
  parseCritiqueResponse,
} from '@/lib/instrument/critique'

describe('critique response parsing', () => {
  it('parses a valid keep verdict', () => {
    const json = '{ "verdict": "keep", "reason": "Good fit for construct", "revisedStem": null }'
    const result = parseCritiqueResponse(json)
    expect(result).toEqual({
      verdict: 'keep',
      reason: 'Good fit for construct',
    })
  })

  it('parses a revise verdict', () => {
    const json = '{ "verdict": "revise", "reason": "Wording is awkward", "revisedStem": "Updated stem" }'
    const result = parseCritiqueResponse(json)
    expect(result).toEqual({
      verdict: 'revise',
      reason: 'Wording is awkward',
    })
  })

  it('parses a drop verdict', () => {
    const json = '{ "verdict": "drop", "reason": "Overlaps too much with contrast construct", "revisedStem": null }'
    const result = parseCritiqueResponse(json)
    expect(result).toEqual({
      verdict: 'drop',
      reason: 'Overlaps too much with contrast construct',
    })
  })

  it('returns null for invalid verdict', () => {
    const json = '{ "verdict": "reject", "reason": "Invalid" }'
    const result = parseCritiqueResponse(json)
    expect(result).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    const json = '{ broken json'
    const result = parseCritiqueResponse(json)
    expect(result).toBeNull()
  })

  it('strips markdown code fences', () => {
    const json = '```json\n{ "verdict": "keep", "reason": "Good" }\n```'
    const result = parseCritiqueResponse(json)
    expect(result).toEqual({
      verdict: 'keep',
      reason: 'Good',
    })
  })

  it('tolerates missing reason field', () => {
    const json = '{ "verdict": "keep" }'
    const result = parseCritiqueResponse(json)
    expect(result).toEqual({
      verdict: 'keep',
    })
  })

  it('returns null if verdict is not a string', () => {
    const json = '{ "verdict": 123, "reason": "Bad type" }'
    const result = parseCritiqueResponse(json)
    expect(result).toBeNull()
  })

  it('returns null if not an object', () => {
    const json = '["verdict", "keep"]'
    const result = parseCritiqueResponse(json)
    expect(result).toBeNull()
  })

  it('returns null if verdict field is missing', () => {
    const json = '{ "reason": "No verdict", "revisedStem": null }'
    const result = parseCritiqueResponse(json)
    expect(result).toBeNull()
  })

  it('case-sensitive verdict matching', () => {
    const json = '{ "verdict": "Keep", "reason": "Wrong case" }'
    const result = parseCritiqueResponse(json)
    expect(result).toBeNull()
  })

  it('handles null input gracefully', () => {
    const result = parseCritiqueResponse('null')
    expect(result).toBeNull()
  })

  it('ignores revisedStem in response even when present', () => {
    const json = '{ "verdict": "keep", "reason": "Fine", "revisedStem": "ignored" }'
    const result = parseCritiqueResponse(json)
    expect(result).toEqual({
      verdict: 'keep',
      reason: 'Fine',
    })
  })

  it('handles whitespace around JSON', () => {
    const json = '   { "verdict": "keep", "reason": "Good" }   '
    const result = parseCritiqueResponse(json)
    expect(result).toEqual({
      verdict: 'keep',
      reason: 'Good',
    })
  })

  it('rejects unknown verdicts in the set', () => {
    for (const invalid of ['unknown', 'maybe', 'skip', 'accept', 'reject']) {
      const json = `{ "verdict": "${invalid}", "reason": "Test" }`
      const result = parseCritiqueResponse(json)
      expect(result).toBeNull()
    }
  })

  it('handles empty reason string', () => {
    const json = '{ "verdict": "keep", "reason": "" }'
    const result = parseCritiqueResponse(json)
    expect(result).toEqual({
      verdict: 'keep',
      reason: '',
    })
  })
})
