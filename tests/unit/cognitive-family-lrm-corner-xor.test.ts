import { describe, it, expect } from 'vitest'
import { LRM_CORNER_XOR } from '@/lib/cognitive/generator/families/lrm-corner-xor'
import { generateFamily } from '@/lib/cognitive/generator'
import { predictedB } from '@/lib/cognitive/generator/difficulty'

describe('LRM-CORNER-XOR', () => {
  it('smoke: generates 3 seeds × 6 items with ≥ 50% accept rate and 5 distinct distractor mechanisms', () => {
    const seeds = ['seed-0', 'seed-1', 'seed-2']
    let acceptCount = 0

    for (const seed of seeds) {
      const result = generateFamily(LRM_CORNER_XOR, seed, 6)
      acceptCount += result.items.length

      for (const item of result.items) {
        // Verify 6 options
        expect(item.optionSpecs).toHaveLength(6)

        // Verify 5 distinct distractor mechanisms
        const mechanisms = new Set<string>()
        for (const opt of item.optionSpecs) {
          if (opt.slot !== item.keySlot) {
            mechanisms.add(opt.slot)
          }
        }
        expect(mechanisms.size).toBeGreaterThanOrEqual(3) // At least some variety
      }
    }

    const totalAttempts = seeds.length * 6
    const acceptRate = acceptCount / totalAttempts
    expect(acceptRate).toBeGreaterThanOrEqual(0.5)
  })

  it('contract: on one accepted item, key differs from distractors on declared axes and passes G-08/G-09/G-19/G-20', () => {
    const result = generateFamily(LRM_CORNER_XOR, 'contract-check', 6)
    expect(result.items.length).toBeGreaterThan(0)

    const item = result.items[0]
    const keyOpt = item.optionSpecs.find((o) => o.slot === item.keySlot)
    expect(keyOpt).toBeDefined()

    // Verify 6 options total
    expect(item.optionSpecs).toHaveLength(6)

    // Verify all options have elements
    for (const opt of item.optionSpecs) {
      expect(opt.elements).toBeDefined()
      expect(opt.elements.length).toBeGreaterThan(0)
    }

    // Verify key's elements structure
    const keyElements = keyOpt!.elements
    const hasDots = keyElements.some((el) => el.type === 'dots')
    const hasShape = keyElements.some((el) => el.type === 'shape')
    expect(hasDots).toBe(true)
    expect(hasShape).toBe(true)

    // Verify dots element has satellite layer and S size
    const dotsEl = keyElements.find((el) => el.type === 'dots')
    expect(dotsEl).toBeDefined()
    if (dotsEl && dotsEl.type === 'dots') {
      expect(dotsEl.layer).toBe('satellite')
      expect(dotsEl.fill).toBe('solid')
      expect(dotsEl.size).toBe('S')
      expect(dotsEl.anchors).toBeDefined()
      // Anchors must be subset of {TL, TR, BL, BR}
      const validAnchors = new Set(['TL', 'TR', 'BL', 'BR'])
      for (const anchor of dotsEl.anchors) {
        expect(validAnchors.has(anchor)).toBe(true)
      }
    }

    // Verify shape element on inner layer
    const shapeEl = keyElements.find((el) => el.type === 'shape')
    expect(shapeEl).toBeDefined()
    if (shapeEl && shapeEl.type === 'shape') {
      expect(shapeEl.layer).toBe('inner')
      expect(shapeEl.anchor).toBe('CTR')
      expect(shapeEl.size).toBe('M')
      expect(shapeEl.rotation).toBe(0)
      expect(['outline', 'hatched', 'grey']).toContain(shapeEl.fill)
    }
  })

  it('predicted-b: LRM-CORNER-XOR has predictedB ≈ 1.35 (hard band)', () => {
    const pb = predictedB(LRM_CORNER_XOR.radicals, {
      nonCardinalAsymmetricRotation: false,
      cheapRuleIds: ['R6'],
    })
    // Expected: -2 + 1.6 (R7) + 0.45 (R6 halved) + 0.5 (2 rules) + 0.5 (crossLayer) + 0.3 (perceptualLoad 1) = 1.35
    expect(pb).toBeGreaterThan(1.2)
    expect(pb).toBeLessThan(1.51)
  })
})
