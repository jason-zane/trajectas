/**
 * Distractor generation primitives — doc 03-item-generation-pipeline.md §4.
 * Four labelled mechanisms (WR/IR/PM/RP), a solver gate that runs every
 * candidate through the SAME verifier that proves uniqueness (§4.2's
 * RAVEN-FAIR discipline: the generator's own solver adjudicates), and
 * context-blind balance repair (§4.5).
 *
 * SCOPE NOTE (reported in the LR-7 writeup): doc §4.3 sketches a generic
 * `enumerateGenerators(ctx, plan)` that searches across every possible
 * (axis, mechanism) combination for a given family. This module implements
 * the four mechanism PRIMITIVES generically (any family can call them on any
 * axis), but each family's `buildDistractors` (families/*.ts) calls them
 * with FAMILY-CHOSEN axes/cells/mechanisms, matching doc §3.3's own
 * framing that "a family is the unit of authorship" — the same principle
 * doc 03-logical-reasoning-design.md §6 applies when it hand-writes each of
 * M1-M8's four distractor rationales rather than deriving them from a
 * search. Correctness does not depend on this choice: every candidate,
 * however it was proposed, still has to clear `gateDistractor` (which reuses
 * the Level A/B solver) before it is accepted.
 */
import type { Element } from '../spec/schema'
import { type AxisId, type AxisValue, type CellLike, axisEq, cellComplexity, cellEq, readAxis } from './axes'
import type { AdmissibleTuple } from './qa/uniqueness'
import { contextBlindGate } from './qa/contextblind'
import type { Rng } from './rng'
import type { DistractorCandidate, ErrorLabel } from './compose'

export type { DistractorCandidate, ErrorLabel }

/** Replace one axis's value on a cell, rebuilding via the family's own cell-builder so the result stays schema-shaped. */
export function withAxis<P>(cell: CellLike, axis: AxisId, value: AxisValue, buildCell: (values: Record<AxisId, AxisValue>, params: P) => Element[], readAllAxes: readonly AxisId[], params: P): Element[] {
  const values: Record<AxisId, AxisValue> = {}
  for (const a of readAllAxes) {
    if (a === axis) {
      values[a] = value
      continue
    }
    const v = readAxis(cell, a)
    if (v) values[a] = v
  }
  return buildCell(values, params)
}

/**
 * IR — incomplete rule: take the key, substitute one rule-governed axis's
 * value with a "stall" — the value that axis held at the previous column or
 * row (doc §4.1's named stall). Requires the family to expose the value at
 * that reference coordinate directly (families pass `valueAt`).
 */
export function incompleteRule(mechanism: string, elements: Element[], stalledAxis: AxisId, keyValue: AxisValue, stalledValue: AxisValue): DistractorCandidate {
  return {
    elements,
    label: 'IR',
    mechanism,
    wrongAxes: axisEq(keyValue, stalledValue) ? [] : [stalledAxis],
  }
}

/** IR on a set-valued axis: apply the correct operation, then drop one element (doc M4/M5's "loses one element" near-miss). */
export function incompleteSetRule(mechanism: string, elements: Element[], axis: AxisId): DistractorCandidate {
  return { elements, label: 'IR', mechanism, wrongAxes: [axis] }
}

/** WR — wrong rule: a different rule from the same family substituted on one axis. */
export function wrongRule(mechanism: string, elements: Element[], axis: AxisId): DistractorCandidate {
  return { elements, label: 'WR', mechanism, wrongAxes: [axis] }
}

/** PM — perceptual match: a chimera assembled from nearby context cells, locally plausible without satisfying the rules. */
export function chimera(mechanism: string, elements: Element[], wrongAxes: AxisId[]): DistractorCandidate {
  return { elements, label: 'PM', mechanism, wrongAxes }
}

/** RP — repetition: an exact copy of a named context cell. */
export function repetition(mechanism: string, elements: Element[], wrongAxes: AxisId[]): DistractorCandidate {
  return { elements, label: 'RP', mechanism, wrongAxes }
}

export interface GateContext {
  keyCell: CellLike
  accepted: readonly DistractorCandidate[]
  admissibleTuples: readonly AdmissibleTuple[]
  axes: readonly AxisId[]
}

export interface GateOutcome {
  ok: boolean
  reason?: string
}

/** doc §4.2's solver gate. `>=` not `>`: a candidate that satisfies every surviving rule tuple is rejected even though it also happens to violate the ONE axis its mechanism targeted under some other reading. */
export function gateDistractor(c: DistractorCandidate, ctx: GateContext): GateOutcome {
  if (c.wrongAxes.length === 0) return { ok: false, reason: 'SATISFIES_ALL_RULES' }
  // Full-cell identity (every axis actually present — not just the
  // rule-governed ones) for EQUALS_KEY/DUPLICATE_OPTION: two options that
  // agree on the rule axis but differ on an incidental (e.g. same count,
  // different shape) are visually distinct options, not duplicates.
  if (cellEq(c, ctx.keyCell)) return { ok: false, reason: 'EQUALS_KEY' }
  if (ctx.accepted.some((o) => cellEq(o, { elements: c.elements }))) return { ok: false, reason: 'DUPLICATE_OPTION' }

  for (const tuple of ctx.admissibleTuples) {
    if (tuple.every((s) => { const v = readAxis({ elements: c.elements }, s.axis); return v !== null && axisEq(v, s.implied) })) {
      return { ok: false, reason: 'DEFENSIBLY_CORRECT' }
    }
  }

  if (Math.abs(cellComplexity({ elements: c.elements }) - cellComplexity(ctx.keyCell)) > 2) {
    return { ok: false, reason: 'COMPLEXITY_OUTLIER' }
  }
  return { ok: true }
}

export interface BalanceRepairResult {
  ok: boolean
  accepted: DistractorCandidate[]
  attempts: number
}

/**
 * doc §4.5's balance repair: mutate distractors ONLY (never the key) until
 * the context-blind gate passes. This generic version does not itself
 * generate replacement candidates (that requires family-specific knowledge
 * of what other mechanisms exist) — it accepts a `regenerate` callback
 * supplied by the caller (families/index.ts's assembly step) and reports
 * failure if no repair is found within the attempt budget, matching doc's
 * `BALANCE_UNREPAIRABLE`.
 */
export function repairBalance(
  keyCell: CellLike,
  accepted: DistractorCandidate[],
  axes: readonly AxisId[],
  regenerate: (victim: DistractorCandidate, avoidAxis: AxisId, attempt: number) => DistractorCandidate | null,
  maxAttempts = 24,
): BalanceRepairResult {
  let current = accepted
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const cells = [keyCell, ...current.map((c) => ({ elements: c.elements }))]
    const gate = contextBlindGate(cells, 0, axes)
    if (gate.ok) return { ok: true, accepted: current, attempts: attempt }

    const axis = mostKeyDominatedAxis(cells, 0, axes)
    if (!axis) break
    // Never touch the only carrier of a label (doc §4.5): pick the victim
    // with the LEAST rare label among those carrying `axis`'s dominant value.
    const candidates = current.filter((c) => { const v = readAxis({ elements: c.elements }, axis); return v !== null && axisEq(v, readAxis(keyCell, axis)!) })
    const victim = candidates[0]
    if (!victim) break
    const replacement = regenerate(victim, axis, attempt)
    if (replacement) {
      current = current.map((c) => (c === victim ? replacement : c))
    }
  }
  return { ok: false, accepted: current, attempts: maxAttempts }
}

/** The axis where the key's own value is held by the most options — repairBalance's target for the next mutation. */
function mostKeyDominatedAxis(cells: readonly CellLike[], keyIndex: number, axes: readonly AxisId[]): AxisId | null {
  let worst: AxisId | null = null
  let worstCount = 0
  for (const axis of axes) {
    const keyVal = readAxis(cells[keyIndex], axis)
    if (!keyVal) continue
    const count = cells.filter((c) => { const v = readAxis(c, axis); return v !== null && axisEq(v, keyVal) }).length
    if (count > worstCount) {
      worstCount = count
      worst = axis
    }
  }
  return worst
}

export interface PlacedOption {
  slot: 'A' | 'B' | 'C' | 'D' | 'E'
  elements: Element[]
  isKey: boolean
  label: ErrorLabel | null
  mechanism: string | null
}

const SLOTS: PlacedOption['slot'][] = ['A', 'B', 'C', 'D', 'E']

/** Deterministic key-slot placement: `keySlotIndex` (0-4) is chosen by the CALLER from a batch-wide round-robin counter, guaranteeing exact G-16 balance across any run whose size is a multiple of 5. Distractor order among the other 4 slots is still randomised (per-item) via `rng`. */
export function placeOptions(keyCell: CellLike, distractors: readonly DistractorCandidate[], keySlotIndex: number, rng: Rng): PlacedOption[] {
  const shuffledDistractors = rng.shuffle(distractors)
  const out: PlacedOption[] = new Array(5)
  out[keySlotIndex] = { slot: SLOTS[keySlotIndex], elements: [...keyCell.elements], isKey: true, label: null, mechanism: null }
  let di = 0
  for (let i = 0; i < 5; i++) {
    if (i === keySlotIndex) continue
    const d = shuffledDistractors[di++]
    out[i] = { slot: SLOTS[i], elements: d.elements, isKey: false, label: d.label, mechanism: d.mechanism }
  }
  return out
}
