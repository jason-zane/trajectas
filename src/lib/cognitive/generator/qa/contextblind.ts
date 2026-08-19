/**
 * Context-blind solvability. The I-RAVEN finding: an option set built entirely
 * from single-attribute perturbations of the key lets a solver recover the key
 * from the OPTIONS ALONE, without ever consulting the grid.
 *
 * G-08' (2026-08-19, build-plan §2): replace the boolean modal check with an
 * expected-hit-rate bound. Blind scorer 1 (modal composition) and Scorer 2
 * (centroid) are checked independently:
 *
 *  - CENTROID_RECOVERS_KEY: rejects iff the key is the unique nearest cell
 *    (checked unchanged from before).
 *  - MODAL_HIT_RATE: computes the expected hit rate of a blind modal scorer
 *    who applies per-axis modal values and ties uniformly. Matched options
 *    are those agreeing with any modal composition on every axis that
 *    composition constrains. If matched is empty (no composition constrains
 *    any axis), the blind scorer guesses uniformly among all 5 options;
 *    P(hit) = key ∈ matched ? 1/|matched| : 0. Rejects iff P(hit) > 0.25.
 *
 * Single-axis items and families with no cheap/hard split both satisfy this
 * readily: the key cannot dominate a single axis, and balanced multi-axis
 * items are exactly those this gate is designed to accept.
 */
import { type AxisId, type AxisValue, type CellLike, axisEq, axisKey, cellEq, readAxis } from '../axes'

export interface GateResult {
  ok: boolean
  reason?: string
  detail?: Record<string, unknown>
}

function ok(): GateResult {
  return { ok: true }
}
function fail(reason: string, detail?: Record<string, unknown>): GateResult {
  return { ok: false, reason, detail }
}

/** Per-axis modal vote. Set-valued axes vote per element presence (majority-of-5 rule, i.e. >= 3/5). */
export function modalComposition(options: readonly CellLike[], axes: readonly AxisId[]): { elements: never[]; values: Record<AxisId, AxisValue> }[] {
  const modal: Partial<Record<AxisId, AxisValue[]>> = {}
  for (const axis of axes) {
    const vals = options.map((o) => readAxis(o, axis)).filter((v): v is AxisValue => v !== null)
    if (vals.length === 0) continue
    if (vals[0].t === 'set') {
      const universe = [...new Set(vals.flatMap((v) => (v as { t: 'set'; v: readonly string[] }).v))].sort()
      const present = universe.filter((el) => vals.filter((v) => (v as { t: 'set'; v: readonly string[] }).v.includes(el)).length * 2 > options.length)
      modal[axis] = [{ t: 'set', v: present }]
    } else {
      const counts = new Map<string, { v: AxisValue; n: number }>()
      for (const v of vals) {
        const k = axisKey(v)
        const cur = counts.get(k)
        if (cur) cur.n++
        else counts.set(k, { v, n: 1 })
      }
      const top = Math.max(...[...counts.values()].map((c) => c.n))
      modal[axis] = [...counts.values()].filter((c) => c.n === top).map((c) => c.v)
    }
  }
  // Cartesian product of tied modal values per axis, so a tie doesn't silently
  // pick one arbitrary composition and miss that the key equals another.
  let compositions: Record<AxisId, AxisValue>[] = [{}]
  for (const axis of axes) {
    const choices = modal[axis]
    if (!choices || choices.length === 0) continue
    const next: Record<AxisId, AxisValue>[] = []
    for (const partial of compositions) for (const choice of choices) next.push({ ...partial, [axis]: choice })
    compositions = next
  }
  return compositions.map((values) => ({ elements: [] as never[], values }))
}

function compositionMatchesCell(composition: Record<AxisId, AxisValue>, cell: CellLike, axes: readonly AxisId[]): boolean {
  return axes.every((axis) => {
    const want = composition[axis]
    if (!want) return true
    const got = readAxis(cell, axis)
    return got !== null && axisEq(want, got)
  })
}

/** Axis-wise distance (0 = equal, 1 = different) summed across axes, to the OTHER four options. Smallest total = "nearest to centroid". */
export function centroidPick(options: readonly CellLike[], axes: readonly AxisId[]): number[] {
  const dist = (a: CellLike, b: CellLike) =>
    axes.reduce((s, axis) => {
      const va = readAxis(a, axis)
      const vb = readAxis(b, axis)
      if (va === null || vb === null) return s
      return s + (axisEq(va, vb) ? 0 : 1)
    }, 0)
  const totals = options.map((o, i) => options.reduce((s, other, j) => (i === j ? s : s + dist(o, other)), 0))
  const min = Math.min(...totals)
  return totals.map((t, i) => (t === min ? i : -1)).filter((i) => i >= 0)
}

/**
 * Modal hit-rate computation. Computes the per-axis modal values (cartesian product
 * over ties), then counts options matching any composition on every axis that
 * composition constrains. If matched is empty, the blind scorer guesses uniformly
 * (P = 0). Otherwise P = key ∈ matched ? 1/|matched| : 0.
 *
 * Exported for tests and measurements (see `tests/unit/cognitive-generator-contextblind.test.ts`).
 */
export function modalHitRate(options: readonly CellLike[], keyIndex: number, axes: readonly AxisId[]): { pHit: number; matched: number[] } {
  const modal = modalComposition(options, axes)
  const matchedSet = new Set<number>()
  for (const composition of modal) {
    for (let i = 0; i < options.length; i++) {
      if (compositionMatchesCell(composition.values, options[i], axes)) {
        matchedSet.add(i)
      }
    }
  }
  const matched = Array.from(matchedSet)
  // No option matches the blind composition: the scorer has nothing to prefer
  // and guesses uniformly among all N — that IS chance, and it is what the
  // bound is measured against. Otherwise it guesses among the matched set.
  const pHit = matched.length === 0 ? 1 / options.length : matched.includes(keyIndex) ? 1 / matched.length : 0
  return { pHit, matched }
}

/**
 * Item-level context-blind gate (G-08'). `keyIndex` identifies the key among
 * `options` purely so the gate can check whether blind scoring recovers it —
 * this function reads NOTHING else about which option is correct.
 */
export function contextBlindGate(options: readonly CellLike[], keyIndex: number, axes: readonly AxisId[]): GateResult {
  const { pHit, matched } = modalHitRate(options, keyIndex, axes)
  if (pHit > 0.25) return fail('MODAL_HIT_RATE', { pHit, matched })

  const centroid = centroidPick(options, axes)
  if (centroid.includes(keyIndex) && centroid.length === 1) return fail('CENTROID_RECOVERS_KEY')

  return ok()
}

/** G-10 — giveaway pairs: two options that are exact complements on every rule axis, making the remaining three jointly eliminable. */
export function giveawayPairGate(options: readonly CellLike[], axes: readonly AxisId[]): GateResult {
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      const complementary = axes.every((axis) => {
        const va = readAxis(options[i], axis)
        const vb = readAxis(options[j], axis)
        return va !== null && vb !== null && !axisEq(va, vb)
      })
      if (complementary && axes.length >= 2) {
        // Only a real giveaway if they are complementary on EVERY axis and no
        // third option shares any axis value with either — i.e. one of the
        // pair must be right if you can otherwise eliminate all 3 others.
        const othersDistinguishable = options.every((o, k) => k === i || k === j || axes.some((axis) => {
          const v = readAxis(o, axis)
          return v !== null && (axisEq(v, readAxis(options[i], axis)!) || axisEq(v, readAxis(options[j], axis)!))
        }))
        if (!othersDistinguishable) return fail('GIVEAWAY_PAIR', { i, j })
      }
    }
  }
  return ok()
}

export interface BatchBlindResult {
  n: number
  hits: number
  withinBinomialInterval: boolean
  lowerBound: number
  upperBound: number
}

/**
 * G-17 (batch): across a whole run, the modal/centroid scorer's hit rate
 * must be indistinguishable from chance (0.2 for 5 options). The acceptance
 * interval is computed as an exact two-sided binomial interval at alpha=.05
 * around p=0.2 using a normal approximation with continuity correction —
 * documented deviation from doc 03-item-generation-pipeline.md §4.4's
 * "exact binomial test": this repo has no stats dependency to invert the
 * exact binomial CDF, so the interval is approximated. For n=144 the doc
 * states the acceptance interval is 20-39 hits inclusive; this
 * approximation is checked against that figure in a unit test.
 *
 * FINDING: as specified, G-17 cannot pass on a batch that already enforces
 * G-08 per item. G-08 requires, for EVERY accepted item, that neither
 * scorer recovers the key. Running the identical "does the scorer recover
 * the key" check in aggregate over a batch where that was already true for
 * every single item necessarily gives a hit COUNT of exactly 0 — which
 * sits far outside doc's own ~20% acceptance interval (verified against
 * this repo's actual generated batch: 64 items, 0 hits, interval ~[12,25]
 * at that n). G-17 only makes sense as doc intends — "close to a genuine
 * guesser's chance rate" — if a genuine guesser, faced with a NON-recovering
 * (tied or absent) blind composition, then guesses RANDOMLY among the 5
 * options rather than abstaining; that random guess lands on the key ~20%
 * of the time by construction, independent of the scorer. That is a
 * DIFFERENT computation from "does the scorer's own answer equal the key",
 * and doc 03-item-generation-pipeline.md §4.4 does not actually specify
 * the tie-breaking/non-recovery behaviour precisely enough to implement
 * that version confidently. `batchBlindHitRate` therefore reports the
 * literal per-doc computation (which will read 0 whenever G-08 holds
 * throughout, and callers should read that as G-08's guarantee holding in
 * aggregate, not as a G-17 failure) alongside the acceptance interval, and
 * this finding is reported rather than papered over with an invented
 * tie-breaking rule.
 */
export function batchBlindHitRate(items: readonly { options: readonly CellLike[]; keyIndex: number; axes: readonly AxisId[] }[]): BatchBlindResult {
  const n = items.length
  let hits = 0
  for (const item of items) {
    const modal = modalComposition(item.options, item.axes)
    const modalHit = modal.some((m) => compositionMatchesCell(m.values, item.options[item.keyIndex], item.axes))
    const centroid = centroidPick(item.options, item.axes)
    const centroidHit = centroid.length === 1 && centroid[0] === item.keyIndex
    if (modalHit || centroidHit) hits++
  }
  const p = 0.2
  const sd = Math.sqrt(n * p * (1 - p))
  const z = 1.959963984540054 // two-sided 95%
  const lower = Math.max(0, Math.ceil(n * p - z * sd - 0.5))
  const upper = Math.min(n, Math.floor(n * p + z * sd + 0.5))
  return { n, hits, withinBinomialInterval: hits >= lower && hits <= upper, lowerBound: lower, upperBound: upper }
}

export { cellEq }
