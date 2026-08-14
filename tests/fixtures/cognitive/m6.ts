import { FiguralMatrixItemSpec, CognitiveOptionSpec } from '@/lib/cognitive/spec/schema'

/**
 * M6 — Two rules, cross-layer: shape distribution + inner rotation. Doc
 * 03-logical-reasoning-design.md §6 M6 / doc 03-item-generation-pipeline.md
 * §2.4's fully-worked JSON example (converted here to the two-table storage
 * split — item spec vs. per-option specs — see the deviation note in
 * src/lib/cognitive/spec/schema.ts).
 *
 * HISTORICAL NOTE, resolved by issue #346: the doc's original table (90deg
 * tick step) contained a genuine duplicate — (1,3), (2,2) and (3,1) were
 * all "diamond, tick 180deg", because 90deg x 4 = 360deg wraps on a 3x3
 * grid. This fixture now carries the CORRECTED table (45deg tick step,
 * same key: circle, tick pointing up) documented under the "Correction"
 * note in doc 03-logical-reasoning-design.md §6 M6, and reproduced exactly
 * by `src/lib/cognitive/generator/families/lrm-2r-xlayer.ts` for the same
 * (shapeSet, kShape=1, startShape=0, rotBase=0, colSign=1, rowSign=-1)
 * parametrisation.
 *
 * The item-generation-pipeline doc itself flags that M6-as-originally-
 * written failed gate G-08 (context-blind solvability). The option set
 * below is the one `LRM_2R_XLAYER.buildDistractors` actually produces for
 * this exact grid (verified directly against `qa/contextblind.ts` while
 * fixing this fixture) — it falls back to whole-cell recombination (three
 * PM copies plus one RP), which is what that family's own search does
 * whenever doc's hand-derived IR/IR/PM/RP repair (§4.5) does not carry over
 * to a given parametrisation. This option set DOES pass G-08/G-10.
 */

const cell = (row: number, col: number, shape: 'square' | 'circle' | 'diamond', tickDeg: number) => ({
  row,
  col,
  elements: [
    { type: 'shape' as const, layer: 'outer' as const, shape, fill: 'outline' as const, size: 'L' as const, anchor: 'CTR' as const, rotation: 0 },
    { type: 'tick' as const, layer: 'inner' as const, length: 30, rotation: tickDeg },
  ],
})

const option = (slot: 'A' | 'B' | 'C' | 'D' | 'E', shape: 'square' | 'circle' | 'diamond', tickDeg: number) => ({
  slot,
  elements: [
    { type: 'shape' as const, layer: 'outer' as const, shape, fill: 'outline' as const, size: 'L' as const, anchor: 'CTR' as const, rotation: 0 },
    { type: 'tick' as const, layer: 'inner' as const, length: 30, rotation: tickDeg },
  ],
})

export const m6ItemSpec = FiguralMatrixItemSpec.parse({
  specVersion: 1,
  kind: 'figural_matrix',
  grid: {
    rows: 3,
    cols: 3,
    blank: { row: 3, col: 3 },
    cells: [
      cell(1, 1, 'square', 0),
      cell(1, 2, 'circle', 45),
      cell(1, 3, 'diamond', 90),
      cell(2, 1, 'circle', 315),
      cell(2, 2, 'diamond', 0),
      cell(2, 3, 'square', 45),
      cell(3, 1, 'diamond', 270),
      cell(3, 2, 'square', 315),
    ],
  },
  rules: [
    {
      id: 'R6',
      axis: 'outer.shape',
      direction: 'both',
      params: { values: ['square', 'circle', 'diamond'], rowOffset: 1 },
      statement: 'Outer shape forms a Latin square: each of square, circle, diamond appears exactly once per row and once per column.',
    },
    {
      id: 'R2',
      axis: 'inner.rotation',
      direction: 'both',
      params: { base: 0, stepPerColumn: 45, stepPerRow: -45, modulus: 360 },
      statement: 'Inner tick rotation = 45 * (col - 1) - 45 * (row - 1), mod 360.',
    },
  ],
  radicals: { ruleCount: 2, ruleIds: ['R6', 'R2'], crossLayer: true, perceptualLoad: 1, elementTypes: 3, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 10 },
})

export const m6OptionSpecs: CognitiveOptionSpec[] = [
  CognitiveOptionSpec.parse(option('A', 'square', 0)),
  CognitiveOptionSpec.parse(option('B', 'circle', 0)),
  CognitiveOptionSpec.parse(option('C', 'square', 45)),
  CognitiveOptionSpec.parse(option('D', 'square', 315)),
  CognitiveOptionSpec.parse(option('E', 'circle', 45)),
]
