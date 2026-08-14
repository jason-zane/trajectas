import { FiguralMatrixItemSpec, CognitiveOptionSpec } from '@/lib/cognitive/spec/schema'

/**
 * M1 — Double count progression. Doc 03-logical-reasoning-design.md §6 M1.
 * Family LRM-PROG-COUNT, rule R1 (count, rows + columns), easy band.
 *
 * HISTORICAL NOTE, resolved by issue #344: this fixture used to substitute
 * a schema-valid "5 hatched circles" for doc 03-logical-reasoning-design.md
 * §6 M1's own option D ("6 solid circles", the wrong-rule distractor —
 * "assumes the step size itself grows"), because `RepeatElement.count`
 * capped at 5 at the time. That substitution meant M1 carried TWO
 * perceptual-match distractors (the substitute, plus doc's own option E)
 * and ZERO wrong-rule distractors — the exact defect #344 reported. #344
 * raised the count cap to 6 (`src/lib/cognitive/spec/schema.ts`,
 * `render/primitives.ts`'s `repeatPositions`), so this fixture now carries
 * doc's own literal values again: one of each distractor type (IR, RP, WR,
 * PM), matching §5.3's grammar exactly.
 *
 * This fixture is a hand-pinned exemplar for the renderer/schema/hash
 * tests, not a generator output — it is not required to clear the QA
 * battery (see `src/lib/cognitive/generator/families/lrm-prog-count.ts`'s
 * header comment for why doc's literal 4-option grammar in fact CANNOT
 * clear gate G-08 on this single-rule-axis family, and how the generator's
 * own distractor construction differs from doc's for that reason).
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
    elements: [{ type: 'repeat', layer: 'outer', shape: 'circle', fill: 'solid', size: 'S', count: 6, rotation: 0 }],
  }),
  CognitiveOptionSpec.parse({
    slot: 'E',
    elements: [{ type: 'repeat', layer: 'outer', shape: 'square', fill: 'solid', size: 'S', count: 5, rotation: 0 }],
  }),
]
