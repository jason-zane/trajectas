import 'server-only'
import type { LayerName, Element } from '../spec/schema'
import type { RenderSpec } from '../spec/project'
import { shapeGeometry, renderElement, type ShapeGeom } from './primitives'
import { PALETTE, DELIVERY_THEME, type CognitiveTheme } from './palette'

/**
 * Deterministic SVG renderer: same spec in, byte-identical SVG out. No
 * randomness, no `Date.now()`, no unstable key ordering — every ordering
 * decision below is a fixed, spec-derived sort, not iteration order of a Map
 * or object. Doc 03 (item-generation-pipeline) §6.
 */

const LAYER_RANK: Record<LayerName, number> = { outer: 0, inner: 1, satellite: 2 }

/** Stable sort by layer (outer, then inner, then satellite), doc 03 (item-generation-pipeline) §2.1 rule 4. */
function canonicalElementOrder(elements: readonly Element[]): Element[] {
  return elements
    .map((el, i) => ({ el, i }))
    .sort((a, b) => LAYER_RANK[a.el.layer] - LAYER_RANK[b.el.layer] || a.i - b.i)
    .map((x) => x.el)
}

/** The first `outer`-layer shape element in a cell, if any — used as the clip target for `bars` elements with `clipToOuter: true` (doc 03 (item-generation-pipeline) M8). */
function findOuterGeometry(elements: readonly Element[]): ShapeGeom | null {
  const outerShape = elements.find((el) => el.type === 'shape' && el.layer === 'outer')
  if (!outerShape || outerShape.type !== 'shape') return null
  const anchorXY: Record<string, [number, number]> = { TL: [20, 20], TR: [80, 20], BL: [20, 80], BR: [80, 80], CTR: [50, 50] }
  const sizePx: Record<string, number> = { S: 25, M: 40, L: 60 }
  const [cx, cy] = anchorXY[outerShape.anchor]
  return shapeGeometry(outerShape.shape, cx, cy, sizePx[outerShape.size], outerShape.rotation)
}

/**
 * Render one cell's `elements` array to a single `<svg viewBox="0 0 100 100">…</svg>`.
 * Used for both grid cells and option tiles — they share the same `{ elements }` shape.
 *
 * Emits an explicit `paper`-coloured background `<rect>` first. Doc
 * 03-logical-reasoning-design.md §6.5's "lock light mode for the pilot"
 * decision means the item's own rendering must stay legible regardless of
 * the *app's* light/dark theme — an unpainted (transparent) background would
 * leave dark-ink strokes nearly invisible against a dark page background.
 * Painting the cell's own paper colour keeps every item a small,
 * theme-independent "printed page", which is also the more literal reading
 * of "lock light mode": the stimulus does not participate in the app theme
 * at all.
 */
export function renderCellSvg(elements: readonly Element[], render: RenderSpec['render'], theme: CognitiveTheme = DELIVERY_THEME): string {
  const palette = PALETTE[theme]
  const outerGeom = findOuterGeometry(elements)
  const ordered = canonicalElementOrder(elements)
  const background = `<rect width="100" height="100" fill="${palette.paper}" />`
  const inner = ordered.flatMap((el) => renderElement(el, render, palette.ink, outerGeom)).join('')
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision">${background}${inner}</svg>`
}

/**
 * Render the full 3x3 grid (8 real cells; R3C3 is always the blank/response
 * cell and is intentionally NOT part of this output — the blank "?" marker
 * is UI chrome rendered by the CognitiveResponse component itself, not
 * spec-derived content, so it stays outside the deterministic-content
 * boundary this renderer guarantees).
 *
 * Output is a flat run of `<div class="cog-cell">…</div>` wrappers, in
 * canonical row-major order (defensively re-sorted here — the schema already
 * requires exactly 8 cells, but sorting removes any dependency on storage
 * array order). The consuming component applies `display:contents` to its
 * wrapper so these 8 divs become direct CSS grid items alongside a 9th
 * (the blank marker) — see src/components/assess/formats/cognitive-response.tsx.
 */
export function renderMatrixGrid(spec: Pick<RenderSpec, 'grid' | 'render'>, theme: CognitiveTheme = DELIVERY_THEME): string {
  const cells = [...spec.grid.cells].sort((a, b) => a.row - b.row || a.col - b.col)
  return cells.map((cell) => `<div class="cog-cell">${renderCellSvg(cell.elements, spec.render, theme)}</div>`).join('')
}

/** Render a single option tile's SVG (no wrapper — the caller places it). */
export function renderOptionTile(elements: readonly Element[], render: RenderSpec['render'], theme: CognitiveTheme = DELIVERY_THEME): string {
  return renderCellSvg(elements, render, theme)
}
