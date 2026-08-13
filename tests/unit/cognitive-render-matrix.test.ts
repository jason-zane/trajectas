import { describe, it, expect } from 'vitest'
import { renderMatrixGrid, renderOptionTile } from '@/lib/cognitive/render/matrix-svg'
import { toRenderSpec } from '@/lib/cognitive/spec/project'
import { m1ItemSpec, m1OptionSpecs } from '../fixtures/cognitive/m1'
import { m6ItemSpec, m6OptionSpecs } from '../fixtures/cognitive/m6'

/** Tokens doc 03 (item-generation-pipeline) §6.6 forbids from renderer output. */
const FORBIDDEN_TOKEN_PATTERNS: RegExp[] = [
  /<script/i,
  /<foreignObject/i,
  /\bon\w+=/i, // onclick=, onerror=, ...
  /\bhref=/i,
  /xlink:/i,
  /\bid="/,
  /<defs/i,
  /<use\b/i,
  /<text/i,
  /font-/i,
  /\btransform=/i,
]

/** Every numeric literal appearing inside an attribute value, e.g. cx="12.5". */
function numericAttributeValues(svg: string): number[] {
  const values: number[] = []
  const attrRe = /="(-?[0-9][0-9.,\s-]*)"/g
  let m: RegExpExecArray | null
  while ((m = attrRe.exec(svg))) {
    for (const token of m[1].split(/[,\s]+/)) {
      if (token === '') continue
      const n = Number(token)
      if (!Number.isNaN(n)) values.push(n)
    }
  }
  return values
}

const FIXTURES = [
  { name: 'M1', spec: toRenderSpec(m1ItemSpec, m1OptionSpecs) },
  { name: 'M6', spec: toRenderSpec(m6ItemSpec, m6OptionSpecs) },
]

describe('renderMatrixGrid / renderOptionTile — determinism and output discipline', () => {
  for (const { name, spec } of FIXTURES) {
    describe(name, () => {
      it('renders byte-identical grid SVG across repeated calls (determinism)', () => {
        const a = renderMatrixGrid(spec)
        const b = renderMatrixGrid(spec)
        expect(a).toBe(b)
      })

      it('renders byte-identical option SVG across repeated calls (determinism)', () => {
        for (const option of spec.options) {
          const a = renderOptionTile(option.elements, spec.render)
          const b = renderOptionTile(option.elements, spec.render)
          expect(a).toBe(b)
        }
      })

      it('produces exactly 8 grid cells', () => {
        const grid = renderMatrixGrid(spec)
        expect((grid.match(/<div class="cog-cell">/g) ?? []).length).toBe(8)
        expect((grid.match(/<svg/g) ?? []).length).toBe(8)
      })

      it('never emits a forbidden token', () => {
        const grid = renderMatrixGrid(spec)
        const options = spec.options.map((o) => renderOptionTile(o.elements, spec.render)).join('')
        for (const pattern of FORBIDDEN_TOKEN_PATTERNS) {
          expect(grid, `grid SVG matched forbidden pattern ${pattern}`).not.toMatch(pattern)
          expect(options, `option SVG matched forbidden pattern ${pattern}`).not.toMatch(pattern)
        }
      })

      it('every emitted numeric attribute is finite', () => {
        const grid = renderMatrixGrid(spec)
        const options = spec.options.map((o) => renderOptionTile(o.elements, spec.render)).join('')
        for (const n of [...numericAttributeValues(grid), ...numericAttributeValues(options)]) {
          expect(Number.isFinite(n)).toBe(true)
        }
      })

      it('meets the doc 03 §7.3 legibility floor (stroke >= 1.5, min element extent >= 8 canvas units)', () => {
        expect(spec.render.strokeWidth).toBeGreaterThanOrEqual(1.5)
        expect(spec.render.minElementUnits).toBeGreaterThanOrEqual(8)
      })

      it('matches the committed golden snapshot (renderer changes become visible in code review)', () => {
        expect(renderMatrixGrid(spec)).toMatchSnapshot('grid')
        for (const option of spec.options) {
          expect(renderOptionTile(option.elements, spec.render)).toMatchSnapshot(`option-${option.slot}`)
        }
      })
    })
  }

  it('produces different SVG for different specs (sanity: not a constant string)', () => {
    const m1 = toRenderSpec(m1ItemSpec, m1OptionSpecs)
    const m6 = toRenderSpec(m6ItemSpec, m6OptionSpecs)
    expect(renderMatrixGrid(m1)).not.toBe(renderMatrixGrid(m6))
  })

  it('hatched fills draw at least one internal hatch line (M3-style hatching, exercised via a synthetic cell)', () => {
    const hatchedSpec = {
      specVersion: 1 as const,
      kind: 'figural_matrix' as const,
      grid: m1ItemSpec.grid,
      options: [
        {
          slot: 'A' as const,
          elements: [
            { type: 'shape' as const, layer: 'outer' as const, shape: 'square' as const, fill: 'hatched' as const, size: 'L' as const, anchor: 'CTR' as const, rotation: 45 },
          ],
        },
      ],
      render: m1ItemSpec.render,
    }
    const svg = renderOptionTile(hatchedSpec.options[0].elements, hatchedSpec.render)
    // One boundary <polygon> (outline) plus at least one hatch <line>.
    expect((svg.match(/<line/g) ?? []).length).toBeGreaterThan(0)
    expect(svg).toContain('<polygon')
  })

  it('renders bars clipped to an outer shape without throwing (M8-style cross-layer clipToOuter)', () => {
    const spec = {
      specVersion: 1 as const,
      kind: 'figural_matrix' as const,
      grid: m1ItemSpec.grid,
      options: [
        {
          slot: 'A' as const,
          elements: [
            { type: 'shape' as const, layer: 'outer' as const, shape: 'pentagon' as const, fill: 'outline' as const, size: 'L' as const, anchor: 'CTR' as const, rotation: 0 },
            { type: 'bars' as const, layer: 'inner' as const, bars: ['H' as const, 'V' as const], clipToOuter: true },
          ],
        },
      ],
      render: m1ItemSpec.render,
    }
    const svg = renderOptionTile(spec.options[0].elements, spec.render)
    expect(svg).toContain('<line')
    expect(svg).toContain('<polygon')
  })
})
