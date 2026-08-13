import { describe, it, expect } from 'vitest'
import {
  FiguralMatrixItemSpec,
  CognitiveOptionSpec,
  Element,
} from '@/lib/cognitive/spec/schema'
import { m1ItemSpec, m1OptionSpecs } from '../fixtures/cognitive/m1'
import { m6ItemSpec, m6OptionSpecs } from '../fixtures/cognitive/m6'

describe('FiguralMatrixItemSpec / CognitiveOptionSpec — .strict() key-isolation', () => {
  it('parses the M1 and M6 fixtures', () => {
    expect(m1ItemSpec.kind).toBe('figural_matrix')
    expect(m1OptionSpecs).toHaveLength(5)
    expect(m6ItemSpec.grid.cells).toHaveLength(8)
    expect(m6OptionSpecs).toHaveLength(5)
  })

  it('rejects an unknown top-level key on the item spec', () => {
    const withExtra = { ...m1ItemSpec, extra: 'nope' }
    expect(FiguralMatrixItemSpec.safeParse(withExtra).success).toBe(false)
  })

  for (const badKey of ['key', 'answer', 'correctOption', 'keyIndex', 'solution', 'isCorrect']) {
    it(`rejects a "${badKey}" key on the item spec`, () => {
      const withKey = { ...m1ItemSpec, [badKey]: 'B' }
      expect(FiguralMatrixItemSpec.safeParse(withKey).success).toBe(false)
    })

    it(`rejects a "${badKey}" key on an option spec`, () => {
      const withKey = { ...m1OptionSpecs[0], [badKey]: true }
      expect(CognitiveOptionSpec.safeParse(withKey).success).toBe(false)
    })
  }

  it('rejects an unknown key nested inside an element', () => {
    const tampered = {
      ...m1OptionSpecs[0],
      elements: [{ ...m1OptionSpecs[0].elements[0], isCorrect: true }],
    }
    expect(CognitiveOptionSpec.safeParse(tampered).success).toBe(false)
  })

  it('requires exactly 8 grid cells', () => {
    const tooFew = { ...m1ItemSpec, grid: { ...m1ItemSpec.grid, cells: m1ItemSpec.grid.cells.slice(0, 7) } }
    expect(FiguralMatrixItemSpec.safeParse(tooFew).success).toBe(false)
  })

  it('requires at least one rule', () => {
    const noRules = { ...m1ItemSpec, rules: [] }
    expect(FiguralMatrixItemSpec.safeParse(noRules).success).toBe(false)
  })

  it('caps rules at 3', () => {
    const tooMany = { ...m1ItemSpec, rules: [m1ItemSpec.rules[0], m1ItemSpec.rules[0], m1ItemSpec.rules[0], m1ItemSpec.rules[0]] }
    expect(FiguralMatrixItemSpec.safeParse(tooMany).success).toBe(false)
  })

  it('enforces the closed shape vocabulary', () => {
    const invalidShape = {
      ...m1OptionSpecs[0],
      elements: [{ type: 'shape', layer: 'outer', shape: 'hexagon', fill: 'solid', size: 'S', anchor: 'CTR', rotation: 0 }],
    }
    expect(CognitiveOptionSpec.safeParse(invalidShape).success).toBe(false)
  })

  it('enforces rotation range 0-359', () => {
    const badRotation = {
      ...m1OptionSpecs[0],
      elements: [{ type: 'tick', layer: 'inner', length: 30, rotation: 360 }],
    }
    expect(CognitiveOptionSpec.safeParse(badRotation).success).toBe(false)
  })

  it('caps repeat.count at 5', () => {
    const sixCircles = {
      ...m1OptionSpecs[0],
      elements: [{ type: 'repeat', layer: 'outer', shape: 'circle', fill: 'solid', size: 'S', count: 6, rotation: 0 }],
    }
    expect(CognitiveOptionSpec.safeParse(sixCircles).success).toBe(false)
  })

  it('caps elements per cell at 4', () => {
    const el = m6ItemSpec.grid.cells[0].elements[0]
    const tooMany = { ...m1OptionSpecs[0], elements: [el, el, el, el, el] }
    expect(CognitiveOptionSpec.safeParse(tooMany).success).toBe(false)
  })

  it('rejects a rule axis that does not match <layer>.<attribute>', () => {
    const badAxis = { ...m1ItemSpec, rules: [{ ...m1ItemSpec.rules[0], axis: 'Outer.Count' }] }
    expect(FiguralMatrixItemSpec.safeParse(badAxis).success).toBe(false)
  })

  it('discriminated Element union rejects a variant mixing fields from two types', () => {
    const mixed = { type: 'shape', layer: 'outer', shape: 'circle', fill: 'solid', size: 'S', anchor: 'CTR', rotation: 0, bars: ['H'] }
    expect(Element.safeParse(mixed).success).toBe(false)
  })
})
