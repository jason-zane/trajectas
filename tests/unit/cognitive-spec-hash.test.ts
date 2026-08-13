import { describe, it, expect } from 'vitest'
import { canonicalJson, contentHash } from '@/lib/cognitive/spec/hash'
import { m1ItemSpec } from '../fixtures/cognitive/m1'
import { m6ItemSpec } from '../fixtures/cognitive/m6'

describe('canonicalJson / contentHash', () => {
  it('is stable regardless of key order', () => {
    const a = { z: 1, a: 2, nested: { b: 1, a: 2 } }
    const b = { a: 2, z: 1, nested: { a: 2, b: 1 } }
    expect(canonicalJson(a)).toBe(canonicalJson(b))
  })

  it('preserves array order (order is meaningful — grid.cells, rules)', () => {
    const a = { list: [1, 2, 3] }
    const b = { list: [3, 2, 1] }
    expect(canonicalJson(a)).not.toBe(canonicalJson(b))
  })

  it('produces a stable sha256: prefixed digest for the same spec', () => {
    const h1 = contentHash(m1ItemSpec)
    const h2 = contentHash(m1ItemSpec)
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('produces different hashes for different specs', () => {
    expect(contentHash(m1ItemSpec)).not.toBe(contentHash(m6ItemSpec))
  })

  it('is insensitive to how the object literal was constructed (key order)', () => {
    // Deep-clone with every object's keys inserted in REVERSED order — JS
    // preserves string-key insertion order on enumeration, so this actually
    // changes iteration order unless canonicalJson sorts it back out.
    function reverseKeysDeep(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(reverseKeysDeep)
      if (value !== null && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const key of Object.keys(value as Record<string, unknown>).reverse()) {
          out[key] = reverseKeysDeep((value as Record<string, unknown>)[key])
        }
        return out
      }
      return value
    }
    const reordered = reverseKeysDeep(m1ItemSpec)
    expect(contentHash(reordered)).toBe(contentHash(m1ItemSpec))
  })
})
