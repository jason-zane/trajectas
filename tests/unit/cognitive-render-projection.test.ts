import { describe, it, expect } from 'vitest'
import { toRenderSpec } from '@/lib/cognitive/spec/project'
import { m1ItemSpec, m1OptionSpecs } from '../fixtures/cognitive/m1'
import { m6ItemSpec, m6OptionSpecs } from '../fixtures/cognitive/m6'

describe('toRenderSpec — the only allowed path from a stored spec to a renderer', () => {
  it('strips rules and radicals', () => {
    const rendered = toRenderSpec(m1ItemSpec, m1OptionSpecs)
    expect(rendered).not.toHaveProperty('rules')
    expect(rendered).not.toHaveProperty('radicals')
    const serialised = JSON.stringify(rendered)
    expect(serialised).not.toMatch(/"rules"/)
    expect(serialised).not.toMatch(/"radicals"/)
  })

  it('keeps grid, options, render, specVersion, kind — nothing else', () => {
    const rendered = toRenderSpec(m6ItemSpec, m6OptionSpecs)
    expect(Object.keys(rendered).sort()).toEqual(['grid', 'kind', 'options', 'render', 'specVersion'])
  })

  it('carries all 5 options through, in the order given', () => {
    const rendered = toRenderSpec(m6ItemSpec, m6OptionSpecs)
    expect(rendered.options.map((o) => o.slot)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('never leaks key-shaped tokens even if a caller widens the input object', () => {
    const widened = { ...m1ItemSpec, rules: m1ItemSpec.rules, distractorPlan: { A: 'IR' } } as typeof m1ItemSpec
    const rendered = toRenderSpec(widened, m1OptionSpecs)
    expect(JSON.stringify(rendered)).not.toMatch(/distractorPlan/)
  })
})
