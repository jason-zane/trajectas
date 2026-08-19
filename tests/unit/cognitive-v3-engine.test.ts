/**
 * v3 engine additions (docs/superpowers/specs/2026-08-19-cognitive-v3-build-plan.md §2):
 * wider shape vocabulary, grey fill, reflection (R10) as a flip attribute +
 * verifier rule, intersection (R11) and count arithmetic (R12) as verifier
 * rules, and the `strokes` / `nest` elements. Each block pins the property a
 * family author relies on, not the pixel output.
 */
import { describe, expect, it } from 'vitest'
import { Element, CognitiveOptionSpec } from '@/lib/cognitive/spec/schema'
import { renderCellSvg } from '@/lib/cognitive/render/matrix-svg'
import { shapeGeometry, hatchSegments, GREY_FILL } from '@/lib/cognitive/render/primitives'
import { isConvex, clipLineToPolygonEvenOdd, mirror } from '@/lib/cognitive/render/geometry'
import { readAxis, axesPresentIn, cellComplexity, enumVal, numVal, setVal, buildLattice, type AxisLattice } from '@/lib/cognitive/generator/axes'
import { reflectionRule, arithmeticRule, setOperatorRule, composeFlip, ruleSpaceFor, applySetOp } from '@/lib/cognitive/generator/rules'
import { cellInkFraction, inkCoverageGate, renderLegibilityGate } from '@/lib/cognitive/generator/qa/density'
import { predictedB } from '@/lib/cognitive/generator/difficulty'
import { symmetryInvisibleCheck } from '@/lib/cognitive/generator/qa/degeneracy'

const RENDER = { styleVersion: 'v1' as const, canvas: 100 as const, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 }
const FORBIDDEN = [/<script/i, /\btransform=/i, /\bid="/, /<defs/i, /<use\b/i, /href=/i]

function shape(over: Partial<Extract<Element, { type: 'shape' }>> = {}): Element {
  return { type: 'shape', layer: 'outer', shape: 'flag', fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0, ...over } as Element
}

describe('v3 shape vocabulary', () => {
  const NEW_SHAPES = ['hexagon', 'star', 'cross', 'semicircle', 'flag', 'lshape'] as const

  it('parses, renders without forbidden tokens, and clears the ink floor at L for every new shape and every fill', () => {
    for (const sh of NEW_SHAPES) {
      for (const fill of ['outline', 'hatched', 'grey', 'solid'] as const) {
        const el = shape({ shape: sh, fill })
        expect(Element.safeParse(el).success).toBe(true)
        const svg = renderCellSvg([el], RENDER)
        for (const re of FORBIDDEN) expect(svg).not.toMatch(re)
        expect(renderLegibilityGate({ elements: [el] }, RENDER).status).toBe('pass')
        expect(cellInkFraction({ elements: [el] }, RENDER.strokeWidth)).toBeGreaterThanOrEqual(0.04)
      }
    }
  })

  it('grey fills with the fixed mid tone AND strokes the boundary in ink', () => {
    const svg = renderCellSvg([shape({ shape: 'hexagon', fill: 'grey' })], RENDER)
    expect(svg).toContain(`fill="${GREY_FILL}"`)
    expect(svg).toMatch(/fill="#8E9299" stroke="#111827"/)
  })

  it('hatches non-convex shapes by even-odd clipping (segments land inside the polygon, not across its concavities)', () => {
    const star = shapeGeometry('star', 50, 50, 60, 0)
    expect(star.kind).toBe('polygon')
    if (star.kind !== 'polygon') return
    expect(isConvex(star.points)).toBe(false)
    const segs = hatchSegments(star, 4)
    expect(segs.length).toBeGreaterThan(8)
    // A chord through the star's centre crosses it in several runs, whereas
    // Cyrus-Beck could only ever return one segment per chord.
    const runs = clipLineToPolygonEvenOdd([0, 100], [100, 0], star.points)
    expect(runs.length).toBeGreaterThanOrEqual(1)
    // The convex shapes still go through the single-segment path.
    const hex = shapeGeometry('hexagon', 50, 50, 60, 0)
    expect(hex.kind === 'polygon' && isConvex(hex.points)).toBe(true)
  })

  it('records the rotational-symmetry order of each new shape for SYMMETRY_INVISIBLE', () => {
    expect(symmetryInvisibleCheck('hexagon', 60).status).toBe('fail')
    expect(symmetryInvisibleCheck('hexagon', 45).status).toBe('pass')
    expect(symmetryInvisibleCheck('cross', 90).status).toBe('fail')
    expect(symmetryInvisibleCheck('star', 72).status).toBe('fail')
    for (const sh of ['semicircle', 'flag', 'lshape']) expect(symmetryInvisibleCheck(sh, 90).status).toBe('pass')
  })
})

describe('R10 reflection — flip attribute, geometry and verifier rule', () => {
  it('flip mirrors the rotated polygon about the anchor; the four states of an asymmetric glyph are pairwise distinct; hv equals a half turn', () => {
    const states = ['none', 'h', 'v', 'hv'] as const
    const geoms = states.map((f) => shapeGeometry('flag', 50, 50, 60, 0, f))
    const key = (g: ReturnType<typeof shapeGeometry>) => (g.kind === 'polygon' ? g.points.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).sort().join(';') : '')
    const keys = geoms.map(key)
    expect(new Set(keys).size).toBe(4)
    const half = shapeGeometry('flag', 50, 50, 60, 180, 'none')
    expect(key(half)).toBe(keys[3])
    expect(mirror(10, 20, 50, 50, 'h')).toEqual([90, 20])
    expect(mirror(10, 20, 50, 50, 'hv')).toEqual([90, 80])
  })

  it('a symmetric glyph does not change under the flip its symmetry absorbs (why MIRROR draws only asymmetric glyphs)', () => {
    const a = shapeGeometry('arrow', 50, 50, 40, 0, 'none')
    const b = shapeGeometry('arrow', 50, 50, 40, 0, 'h')
    const key = (g: ReturnType<typeof shapeGeometry>) => (g.kind === 'polygon' ? g.points.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).sort().join(';') : '')
    expect(key(a)).toBe(key(b))
  })

  it('flip is optional in the spec (absent = none) and readable as an axis', () => {
    const withFlip = shape({ flip: 'v' })
    const without = shape()
    expect(CognitiveOptionSpec.safeParse({ slot: 'A', elements: [withFlip] }).success).toBe(true)
    expect(readAxis({ elements: [withFlip] }, 'outer.flip')).toEqual(enumVal('v'))
    expect(readAxis({ elements: [without] }, 'outer.flip')).toEqual(enumVal('none'))
    expect(axesPresentIn({ elements: [without] })).toContain('outer.flip')
  })

  it('composeFlip is the Klein four-group', () => {
    expect(composeFlip('h', 'h')).toBe('none')
    expect(composeFlip('h', 'v')).toBe('hv')
    expect(composeFlip('hv', 'v')).toBe('h')
    expect(composeFlip('none', 'hv')).toBe('hv')
  })

  it('reflectionRule(h>v, row) explains a grid whose rows start anywhere and implies the transported state at (3,3); the wrong op pair does not', () => {
    // rows: none,h,hv / v,hv,h / h,none,v  → (3,3) = v
    const lat: AxisLattice = [
      [enumVal('none'), enumVal('h'), enumVal('hv')],
      [enumVal('v'), enumVal('hv'), enumVal('h')],
      [enumVal('h'), enumVal('none'), null],
    ]
    const good = reflectionRule('outer.flip', 'h', 'v', 'row')
    expect(good.explains(lat)).toBe(true)
    expect(good.implies(lat, 3, 3)).toEqual(enumVal('v'))
    const swapped = reflectionRule('outer.flip', 'v', 'h', 'row')
    expect(swapped.explains(lat)).toBe(false)
    // Through the rule space for a 'reflection' domain exactly one op pair survives in the row direction.
    const survivors = ruleSpaceFor('outer.flip', { kind: 'reflection' }, lat).filter((r) => r.explains(lat) && r.implies(lat, 3, 3))
    const implied = new Set(survivors.map((r) => JSON.stringify(r.implies(lat, 3, 3))))
    expect(implied.size).toBe(1)
  })
})

describe('R11 intersection and R12 count arithmetic — verifier rules', () => {
  it('applySetOp intersection, and the set-operator rule space includes it', () => {
    expect(applySetOp('intersection', ['TL', 'TR', 'CTR'], ['TR', 'BL', 'CTR'])).toEqual(['CTR', 'TR'])
    const lat: AxisLattice = [
      [setVal(['TL', 'TR', 'CTR']), setVal(['TR', 'BL', 'CTR']), setVal(['CTR', 'TR'])],
      [setVal(['BL', 'BR']), setVal(['BL', 'TL']), setVal(['BL'])],
      [setVal(['TL', 'BR', 'CTR']), setVal(['BR', 'CTR', 'TR']), null],
    ]
    const rule = setOperatorRule('outer.anchors', 'intersection', 'row_operator')
    expect(rule.id).toBe('R11')
    expect(rule.explains(lat)).toBe(true)
    expect(rule.implies(lat, 3, 3)).toEqual(setVal(['BR', 'CTR']))
    const ids = ruleSpaceFor('outer.anchors', { kind: 'set' }, lat).map((r) => r.id)
    expect(ids).toContain('R11')
  })

  it('arithmeticRule sum explains c3 = c1 + c2 row-wise and is distinct from every progression; difference yields no reading below one', () => {
    // (1,1) ≠ (2,2) on purpose: a main-diagonal constancy probe would
    // otherwise also explain the grid and imply a different (3,3) — the
    // SUM family's sampler has to avoid exactly that coincidence.
    const lat: AxisLattice = [
      [numVal(1), numVal(3), numVal(4)],
      [numVal(2), numVal(2), numVal(4)],
      [numVal(3), numVal(2), null],
    ]
    const sum = arithmeticRule('outer.count', 'sum', 'row_operator')
    expect(sum.id).toBe('R12')
    expect(sum.explains(lat)).toBe(true)
    expect(sum.implies(lat, 3, 3)).toEqual(numVal(5))
    // Column 3 happens to be constant (4, 4) here, so the column-constancy
    // probe also explains and implies 4 ≠ 5 — the second coincidence the SUM
    // family's sampler has to design out (and the exact reason Level A is
    // worth having). With distinct row sums, R12 is the only survivor.
    const lat2: AxisLattice = [
      [numVal(1), numVal(3), numVal(4)],
      [numVal(2), numVal(4), numVal(6)],
      [numVal(3), numVal(2), null],
    ]
    const survivors = ruleSpaceFor('outer.count', { kind: 'numeric-linear' }, lat2).filter((r) => r.explains(lat2) && r.implies(lat2, 3, 3))
    expect(survivors.map((r) => r.id)).toEqual(['R12'])
    const diff = arithmeticRule('outer.count', 'difference', 'row_operator')
    const latDiff: AxisLattice = [
      [numVal(3), numVal(1), numVal(2)],
      [numVal(4), numVal(3), numVal(1)],
      [numVal(2), numVal(2), null],
    ]
    expect(diff.explains(latDiff)).toBe(true)
    expect(diff.implies(latDiff, 3, 3)).toBeNull()
  })

  it('a progression item that a sum also explains implies the same (3,3) under both readings (so adding R12 never breaks Level A on existing families)', () => {
    const lat = buildLattice(
      [1, 2, 3].flatMap((r) => [1, 2, 3].map((c) => ({ row: r, col: c }))).filter((x) => !(x.row === 3 && x.col === 3)),
      (_r, c) => numVal(c), // 1,2,3 in every row: base = step, stepRow = 0
    )
    const survivors = ruleSpaceFor('outer.count', { kind: 'numeric-linear' }, lat).filter((r) => r.explains(lat) && r.implies(lat, 3, 3))
    expect(survivors.some((r) => r.id === 'R12')).toBe(true)
    expect(survivors.some((r) => r.id === 'R1')).toBe(true)
    expect(new Set(survivors.map((r) => JSON.stringify(r.implies(lat, 3, 3)))).size).toBe(1)
  })

  it('difficulty weights exist for R10–R12 (0.5 / 0.8 / 0.7)', () => {
    const base = { ruleCount: 1, crossLayer: false, perceptualLoad: 0, nearMissCount: 0 }
    expect(predictedB({ ...base, ruleIds: ['R10'] }, { nonCardinalAsymmetricRotation: false })).toBeCloseTo(-1.5)
    expect(predictedB({ ...base, ruleIds: ['R11'] }, { nonCardinalAsymmetricRotation: false })).toBeCloseTo(-1.2)
    expect(predictedB({ ...base, ruleIds: ['R12'] }, { nonCardinalAsymmetricRotation: false })).toBeCloseTo(-1.3)
  })
})

describe('strokes and nest elements', () => {
  it('strokes: parse, set-valued axis, render as lines/polylines, line-only cells are exempt from the ink floor', () => {
    const el: Element = { type: 'strokes', layer: 'outer', strokes: ['ARC_T', 'H', 'D1'] }
    expect(Element.safeParse(el).success).toBe(true)
    expect(readAxis({ elements: [el] }, 'outer.strokes')).toEqual(setVal(['ARC_T', 'D1', 'H']))
    expect(axesPresentIn({ elements: [el] })).toEqual(['outer.strokes'])
    expect(cellComplexity({ elements: [el] })).toBe(3)
    const svg = renderCellSvg([el], RENDER)
    expect(svg).toContain('<polyline')
    expect((svg.match(/<line /g) ?? []).length).toBe(2)
    for (const re of FORBIDDEN) expect(svg).not.toMatch(re)
    const one: Element = { type: 'strokes', layer: 'outer', strokes: ['V'] }
    expect(inkCoverageGate([{ elements: [one] }, { elements: [el] }], RENDER.strokeWidth).status).toBe('pass')
  })

  it('nest: parse (outer two rings outline-only, ring shapes restricted), set-valued rings axis, concentric render largest first', () => {
    const el: Element = { type: 'nest', layer: 'outer', rings: ['R3', 'R1'], ringShapes: ['square', 'circle', 'diamond'], ringFills: ['outline', 'outline', 'solid'] }
    expect(Element.safeParse(el).success).toBe(true)
    expect(Element.safeParse({ ...el, ringFills: ['solid', 'outline', 'outline'] }).success).toBe(false)
    expect(Element.safeParse({ ...el, ringShapes: ['triangle', 'circle', 'diamond'] }).success).toBe(false)
    expect(readAxis({ elements: [el] }, 'outer.rings')).toEqual(setVal(['R1', 'R3']))
    expect(cellComplexity({ elements: [el] })).toBe(2)
    const svg = renderCellSvg([el], RENDER)
    const polyIdx = svg.indexOf('<polygon')
    const lastPolyIdx = svg.lastIndexOf('<polygon')
    expect(polyIdx).toBeGreaterThan(-1)
    expect(lastPolyIdx).toBeGreaterThan(polyIdx) // square (R1, outline) then diamond (R3, solid)
    expect(svg).not.toContain('<circle') // R2 absent
    const single: Element = { type: 'nest', layer: 'outer', rings: ['R3'], ringShapes: ['square', 'circle', 'diamond'], ringFills: ['outline', 'outline', 'outline'] }
    const all: Element = { ...el, rings: ['R1', 'R2', 'R3'] }
    expect(inkCoverageGate([{ elements: [single] }, { elements: [all] }], RENDER.strokeWidth).status).toBe('pass')
  })
})
