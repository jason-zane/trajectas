import { FiguralMatrixItemSpec, CognitiveOptionSpec } from '@/lib/cognitive/spec/schema'

/**
 * M6 — Two rules, cross-layer: shape distribution + inner rotation. Doc
 * 03-logical-reasoning-design.md §6 M6 / doc 03-item-generation-pipeline.md
 * §2.4's fully-worked JSON example (converted here to the two-table storage
 * split — item spec vs. per-option specs — see the deviation note in
 * src/lib/cognitive/spec/schema.ts).
 *
 * The item-generation-pipeline doc itself flags that M6 as written fails
 * gate G-08 (context-blind solvability): the modal outer shape (circle, 3/5)
 * and modal tick rotation (0deg, 3/5) compose to the key. That gate is a
 * generator/QA concern (out of scope for LR-4, delivery); this fixture keeps
 * the doc's own encoding verbatim because it is what pins the renderer
 * against a hand-checkable worked example — not a claim that this exact
 * option set would pass QA and reach production.
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
      cell(1, 2, 'circle', 90),
      cell(1, 3, 'diamond', 180),
      cell(2, 1, 'circle', 90),
      cell(2, 2, 'diamond', 180),
      cell(2, 3, 'square', 270),
      cell(3, 1, 'diamond', 180),
      cell(3, 2, 'square', 270),
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
      params: { base: 0, stepPerColumn: 90, stepPerRow: 90, modulus: 360 },
      statement: 'Inner tick rotation = 90 * (row - 1) + 90 * (col - 1), mod 360.',
    },
  ],
  radicals: { ruleCount: 2, ruleIds: ['R6', 'R2'], crossLayer: true, perceptualLoad: 1, elementTypes: 3, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 10 },
})

export const m6OptionSpecs: CognitiveOptionSpec[] = [
  CognitiveOptionSpec.parse(option('A', 'circle', 270)),
  CognitiveOptionSpec.parse(option('B', 'circle', 0)),
  CognitiveOptionSpec.parse(option('C', 'diamond', 0)),
  CognitiveOptionSpec.parse(option('D', 'circle', 180)),
  CognitiveOptionSpec.parse(option('E', 'square', 0)),
]
