import 'server-only'
import type {
  FiguralMatrixItemSpec,
  CognitiveOptionSpec,
  Grid,
  OptionSpec,
  RenderDirectives,
} from './schema'

/**
 * What the renderer is allowed to see. Deliberately narrower than
 * `FiguralMatrixItemSpec` — no `rules`, no `radicals`. Those describe the
 * axis structure and would hand a multimodal model (or a candidate reading
 * page source) the answer structure, per doc 02 (platform-architecture) §2.1.
 */
export type RenderSpec = {
  specVersion: 1
  kind: 'figural_matrix'
  grid: Grid
  options: OptionSpec[]
  render: RenderDirectives
}

/**
 * The ONLY function that turns a stored item spec + its option specs into
 * something a renderer may consume for client-bound output. Explicitly
 * allow-lists `grid | options | render` — built key-by-key, never by
 * spreading the input object, so a future widening of `FiguralMatrixItemSpec`
 * (or a stray extra property on a row read with a wider `select`) cannot leak
 * through silently. Every caller on the delivery path MUST go through this
 * function rather than reading `.spec` fields directly — see
 * tests/architecture/answer-key-isolation.test.ts and
 * src/lib/dal/cognitive-items.ts, the only DAL module allowed to touch
 * `cognitive_item_specs` / `cognitive_option_specs`.
 */
export function toRenderSpec(
  itemSpec: FiguralMatrixItemSpec,
  optionSpecs: readonly CognitiveOptionSpec[],
): RenderSpec {
  return {
    specVersion: itemSpec.specVersion,
    kind: itemSpec.kind,
    grid: {
      rows: itemSpec.grid.rows,
      cols: itemSpec.grid.cols,
      blank: { row: itemSpec.grid.blank.row, col: itemSpec.grid.blank.col },
      cells: itemSpec.grid.cells.map((cell) => ({
        row: cell.row,
        col: cell.col,
        elements: cell.elements,
      })),
    },
    options: optionSpecs.map((option) => ({
      slot: option.slot,
      elements: option.elements,
    })),
    render: {
      styleVersion: itemSpec.render.styleVersion,
      canvas: itemSpec.render.canvas,
      strokeWidth: itemSpec.render.strokeWidth,
      hatchPitch: itemSpec.render.hatchPitch,
      minElementUnits: itemSpec.render.minElementUnits,
    },
  }
}
