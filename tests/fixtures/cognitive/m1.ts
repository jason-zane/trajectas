import { FiguralMatrixItemSpec, CognitiveOptionSpec } from '@/lib/cognitive/spec/schema'

/**
 * M1 — Double count progression. Doc 03-logical-reasoning-design.md §6 M1.
 * Family LRM-PROG-COUNT, rule R1 (count, rows + columns), easy band.
 *
 * Deviation from the worked example: doc 03-logical-reasoning-design.md's
 * option D is "6 solid circles", but doc 03-item-generation-pipeline.md
 * §2.2's `RepeatElement.count` caps at 5 (`z.number().int().min(1).max(5)`),
 * and a Cell holds at most 4 `elements` (so six individual `shape` elements
 * aren't representable either). The two spec documents disagree with each
 * other here — flagged in the LR-4 report. This fixture substitutes a
 * schema-valid distractor that keeps the same "near-miss on count" shape of
 * error without exceeding the cap: 5 HATCHED circles (right count, wrong
 * fill — still a single describable error, still visually distinct from
 * option B's 5 SOLID circles).
 */

const repeatCircle = (count: number) =>
  ({
    elements: [
      { type: 'repeat' as const, layer: 'outer' as const, shape: 'circle' as const, fill: 'solid' as const, size: 'S' as const, count, rotation: 0 },
    ],
  })

export const m1ItemSpec = FiguralMatrixItemSpec.parse({
  specVersion: 1,
  kind: 'figural_matrix',
  grid: {
    rows: 3,
    cols: 3,
    blank: { row: 3, col: 3 },
    cells: [
      { row: 1, col: 1, ...repeatCircle(1) },
      { row: 1, col: 2, ...repeatCircle(2) },
      { row: 1, col: 3, ...repeatCircle(3) },
      { row: 2, col: 1, ...repeatCircle(2) },
      { row: 2, col: 2, ...repeatCircle(3) },
      { row: 2, col: 3, ...repeatCircle(4) },
      { row: 3, col: 1, ...repeatCircle(3) },
      { row: 3, col: 2, ...repeatCircle(4) },
    ],
  },
  rules: [
    {
      id: 'R1',
      axis: 'outer.count',
      direction: 'both',
      params: { base: 0, stepPerColumn: 1, stepPerRow: 1 },
      statement: 'Count increases by 1 per column (left to right) and by 1 per row (top to bottom).',
    },
  ],
  radicals: {
    ruleCount: 1,
    ruleIds: ['R1'],
    crossLayer: false,
    perceptualLoad: 0,
    elementTypes: 2, // circle (grid + most options) and square (option E)
    nearMissCount: 2,
  },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
})

export const m1OptionSpecs: CognitiveOptionSpec[] = [
  CognitiveOptionSpec.parse({ slot: 'A', ...repeatCircle(4) }),
  CognitiveOptionSpec.parse({ slot: 'B', ...repeatCircle(5) }),
  CognitiveOptionSpec.parse({ slot: 'C', ...repeatCircle(3) }),
  CognitiveOptionSpec.parse({
    slot: 'D',
    elements: [{ type: 'repeat', layer: 'outer', shape: 'circle', fill: 'hatched', size: 'S', count: 5, rotation: 0 }],
  }),
  CognitiveOptionSpec.parse({
    slot: 'E',
    elements: [{ type: 'repeat', layer: 'outer', shape: 'square', fill: 'solid', size: 'S', count: 5, rotation: 0 }],
  }),
]
