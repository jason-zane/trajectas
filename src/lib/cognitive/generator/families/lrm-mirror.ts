/**
 * LRM-MIRROR — reflection as an operation (easy, predicted b ≈ −1.5).
 *
 * MEASURE: D4 orientation tracking through successive reflection operations.
 * Surface: ONE shape on layer `outer`, size `L`, glyph constant per item
 * from {flag, lshape, trapezoid} (the three glyphs with no rotational
 * symmetry, so all eight flip states are visually distinct). Fill constant
 * per item from {solid, grey, outline}. The ONLY rule axis is `outer.flip`
 * (D4 orientation).
 *
 * RULE R10 (reflection operations):
 * Along the operator direction (row or column):
 *   cell[2] = reflect(cell[1], op1)
 *   cell[3] = reflect(cell[2], op2)
 * where op1, op2 ∈ {h, v, d1, d2} are reflection axes (horizontal, vertical,
 * top-left to bottom-right diagonal, top-right to bottom-left diagonal), and
 * each line (row/column) has its own starting orientation. Two successive
 * reflections compose to a rotation in D4.
 *
 * DISTRACTOR PLAN (six options, deterministic order):
 *
 * D1 (IR mechanism `stall:outer.flip@pos2`) — the state at position 2 of
 *   the key's line (second reflection not applied).
 *
 * D2 (WR mechanism; first rule, second rule):
 *   - If op1 ≠ op2 and they commute (both v, both h, etc.): WR applies them
 *     in the opposite order. If this equals the key, fall through to:
 *   - Otherwise: WR applies the first op twice: composeFlip(composeFlip(
 *     start, op1), op1) — but since reflections are self-inverse this equals
 *     start, so use instead: reflect about one of the TWO unused axes (first
 *     in FLIP_OPS order not in {op1, op2}).
 *
 * D3 (PM mechanism `mirror:keyAboutUnusedAxis`) — reflect the key about the
 *   OTHER unused axis (not the one used in D2).
 *
 * D4 (RP mechanism `copyCell:R2C3` / `copyCell:R3C2`) — the state at
 *   position 3 of line 2 (opposite direction, same position index within line).
 *
 * D5 (RP mechanism `copyCell:R1C3` / `copyCell:R3C1`) — the state at
 *   position 3 of line 1.
 *
 * Fallback: any remaining non-key state from the 8 grid cells, in a fixed
 * order, labelled `PM`, mechanism `otherOrientation:<state>`.
 *
 * Constraints (sampler redraw loop, max ~200 tries):
 * (a) The three starting orientations (per-line starting states) are pairwise
 *     distinct.
 * (b) The eight visible cells realise between 4 and 6 DISTINCT flip states
 *     (so at least two of the eight D4 states never appear).
 * (c) The key's state (position 3 of the key's line) is one of the states
 *     that DOES appear in the grid (key is a "twin", needed for G-19).
 * (d) `uniquelySolvable(cells, ['outer.flip'], { 'outer.flip': { kind: 'reflection' } })`
 *     is true (Level A gate: exactly one rule explains the grid, exactly one
 *     value at (3,3)).
 *
 * MODAL ARITHMETIC (G-08′ context-blind gate):
 * With 4–6 distinct flip states in the grid and the key as a twin:
 * - If 4 distinct states: at least one appears once (so ≤3 options share any
 *   given state → key never modal).
 * - If 6 distinct states: no state repeats in the visible grid (key alone at
 *   that value → key not modal).
 * - In all cases, the key is not the unique modal option → context-blind hit
 *   rate P(hit) ≤ ¼ ✓.
 *
 * SYMMETRY & COVERAGE:
 * All six options use the SAME glyph/fill/size as the key (only flip differs,
 * the rule axis). Distractors D1, D4, D5 are grid cells (twins), satisfying
 * G-19's requirement that the key's class contains ≥1 distractor twin.
 * Every distractor wrongAxes = ['outer.flip'] (they all differ on the one
 * rule axis).
 *
 * INCIDENTALS (structuralExtra):
 * glyph ∈ {flag, lshape, trapezoid}, fill ∈ {solid, grey, outline},
 * op1, op2, direction, starts.
 *
 * LITERATURE:
 * Reflection/mirror-image items (Raven's APM set II transformation items;
 * Mittring & Rost 2008 on reflection being harder than rotation to track;
 * D4 group as the orientation space of a planar glyph).
 *
 * RADICALS:
 * ruleCount 1, ruleIds ['R10'], crossLayer false, perceptualLoad 0,
 * elementTypes 1 (only the shape element, constant across the grid),
 * nearMissCount 2 (D2 and D3 are wrong-rule + perceptual).
 * nonCardinalAsymmetricRotation = false (R10 has no rotation component).
 * predictedB = -2.0 + 0.5 (R10 weight) + 0 (ruleCount discount) + 0 + 0 + 0 = -1.5 → band 'easy'.
 */

import type { Element, RuleSpec } from '../../spec/schema'
import { enumVal } from '../axes'
import type { AxisDomain } from '../rules'
import { composeFlip, type FlipOp, FLIP_OPS, type FlipState } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import { chimera, incompleteRule, repetition, wrongRule } from '../distractors'
import type { Rng } from '../rng'
import { GeneratorError } from '../compose'
import { uniquelySolvable } from './bitgrid'
import type { GridCell } from '../../spec/schema'

const AXIS = 'outer.flip'
const GLYPHS = ['flag', 'lshape', 'trapezoid'] as const
const FILLS = ['solid', 'grey', 'outline'] as const
const ALL_FLIP_STATES: FlipState[] = ['none', 'h', 'v', 'hv', 'd1', 'd2', 'r90', 'r270']

export interface MirrorParams {
  glyph: (typeof GLYPHS)[number]
  fill: (typeof FILLS)[number]
  op1: FlipOp
  op2: FlipOp
  direction: 'row' | 'column'
  starts: FlipState[] // Three starting orientations, one per row/column
}

function mirrorCell(flip: FlipState, glyph: (typeof GLYPHS)[number], fill: (typeof FILLS)[number]): Element[] {
  const element: Extract<Element, { type: 'shape' }> = { type: 'shape', layer: 'outer', shape: glyph, fill, size: 'L', anchor: 'CTR', rotation: 0 }
  if (flip !== 'none') {
    element.flip = flip
  }
  return [element]
}

/**
 * Compute the state at position (row, col) given the starting orientation for
 * that line and the two reflection operations.
 */
function valueAt(row: number, col: number, direction: 'row' | 'column', starts: FlipState[], op1: FlipOp, op2: FlipOp): FlipState {
  const pos = direction === 'row' ? col : row
  const lineIdx = direction === 'row' ? row - 1 : col - 1

  if (lineIdx < 0 || lineIdx >= 3) throw new Error(`Invalid line index ${lineIdx}`)
  const startState = starts[lineIdx]

  // Transport from position 1 to target position along the line.
  let state = startState
  if (pos > 1) {
    if (pos >= 2) state = composeFlip(state, op1)
    if (pos >= 3) state = composeFlip(state, op2)
  }
  return state
}

export const LRM_MIRROR: FamilyTemplate<MirrorParams> = {
  code: 'LRM-MIRROR',
  axes: [AXIS],
  domains: () => ({
    [AXIS]: { kind: 'reflection' } as AxisDomain,
  }),
  valueAt: (axis, row, col, params) => {
    if (axis !== AXIS) throw new Error(`unknown axis ${axis}`)
    const state = valueAt(row, col, params.direction, params.starts, params.op1, params.op2)
    return enumVal(state)
  },
  ruleSpecs: (params): RuleSpec[] => [
    {
      id: 'R10',
      axis: AXIS,
      direction: params.direction,
      params: { op1: params.op1, op2: params.op2, starts: params.starts },
      statement: `Each ${params.direction === 'row' ? 'row' : 'column'} reflects the figure about the ${opName(params.op1)} axis to get the second cell, then about the ${opName(params.op2)} axis to get the third.`,
    },
  ],
  radicals: {
    ruleCount: 1,
    ruleIds: ['R10'],
    crossLayer: false,
    perceptualLoad: 0,
    elementTypes: 2,
    nearMissCount: 2,
  },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['IR', 'WR', 'PM', 'RP', 'RP'],

  sampleParams(rng: Rng): MirrorParams {
    let attempts = 0
    const maxAttempts = 200

    while (attempts < maxAttempts) {
      attempts++

      const glyph = rng.pick(GLYPHS)
      const fill = rng.pick(FILLS)
      const op1 = rng.pick(FLIP_OPS)
      const op2 = rng.pick(FLIP_OPS.filter((op) => op !== op1))
      const direction = rng.pick(['row', 'column'] as const)

      // Sample three distinct starting orientations.
      const shuffledStarts = rng.shuffle([...ALL_FLIP_STATES]).slice(0, 3)
      const starts = shuffledStarts as [FlipState, FlipState, FlipState]

      // Constraint (a): three starts pairwise distinct (guaranteed by shuffle).
      if (new Set(starts).size !== 3) continue

      // Build the 8 visible grid cells.
      const grid: GridCell[] = []
      const stateSet = new Set<string>()
      for (let row = 1; row <= 3; row++) {
        for (let col = 1; col <= 3; col++) {
          if (row === 3 && col === 3) continue
          const state = valueAt(row, col, direction, starts, op1, op2)
          stateSet.add(state)
          grid.push({
            row,
            col,
            elements: mirrorCell(state, glyph, fill),
          })
        }
      }

      // Constraint (b): 4–6 distinct flip states.
      const distinctStates = stateSet.size
      if (distinctStates < 4 || distinctStates > 6) continue

      // Constraint (c): key state appears in the grid.
      const keyState = valueAt(3, 3, direction, starts, op1, op2)
      if (!stateSet.has(keyState)) continue

      // Constraint (d): uniquely solvable.
      if (!uniquelySolvable(grid, [AXIS], { [AXIS]: { kind: 'reflection' } })) continue

      return { glyph, fill, op1, op2, direction, starts }
    }

    throw new GeneratorError('SAMPLER_EXHAUSTED', {
      family: 'LRM-MIRROR',
      reason: 'Could not find valid parameter combination within 200 attempts',
    })
  },

  buildCell(values, params) {
    const v = values[AXIS]
    if (v.t !== 'enum') throw new Error('outer.flip must be enum')
    const state = v.v as FlipState
    return mirrorCell(state, params.glyph, params.fill)
  },

  buildDistractors(ctx: DistractorCtx<MirrorParams>): DistractorCandidate[] {
    const { params } = ctx
    const keyState = ctx.valueAt(AXIS, 3, 3)
    if (keyState.t !== 'enum') throw new Error('outer.flip must be enum')
    const keyFlip = keyState.v as FlipState

    const candidates: DistractorCandidate[] = []
    const usedStates = new Set<string>()
    usedStates.add(keyFlip)

    // Collect all grid states for later reference
    const gridStates = new Set<string>()
    for (let row = 1; row <= 3; row++) {
      for (let col = 1; col <= 3; col++) {
        if (row === 3 && col === 3) continue
        const state = valueAt(row, col, params.direction, params.starts, params.op1, params.op2)
        gridStates.add(state)
      }
    }

    // Get unused reflection axes
    const unusedOps = FLIP_OPS.filter((op) => op !== params.op1 && op !== params.op2)

    // D1 (IR): stall at position 2 of the key's line.
    const d1State = valueAt(3, 2, params.direction, params.starts, params.op1, params.op2)
    if (d1State !== keyFlip && !usedStates.has(d1State)) {
      const d1 = incompleteRule(
        `stall:outer.flip@pos2`,
        mirrorCell(d1State, params.glyph, params.fill),
        AXIS,
        enumVal(keyFlip),
        enumVal(d1State),
      )
      candidates.push(d1)
      usedStates.add(d1State)
    }

    // D2 (WR): wrong rule mechanism.
    const reversedState = composeFlip(composeFlip(params.starts[2], params.op2), params.op1)
    let d2State: FlipState | null = null
    let d2Mechanism = ''

    if (reversedState !== keyFlip && !usedStates.has(reversedState)) {
      d2State = reversedState
      d2Mechanism = 'wrongRule:opsInWrongOrder'
    } else if (unusedOps.length > 0) {
      const alternateState = composeFlip(keyFlip, unusedOps[0])
      if (alternateState !== keyFlip && !usedStates.has(alternateState)) {
        d2State = alternateState
        d2Mechanism = 'wrongRule:appliesOtherAxis'
      }
    }

    if (d2State) {
      const d2 = wrongRule(d2Mechanism, mirrorCell(d2State, params.glyph, params.fill), AXIS)
      candidates.push(d2)
      usedStates.add(d2State)
    }

    // D3 (PM): reflect key about an unused axis.
    let d3State: FlipState | null = null
    if (unusedOps.length >= 2) {
      const candidate = composeFlip(keyFlip, unusedOps[1])
      if (!usedStates.has(candidate)) {
        d3State = candidate
      }
    }
    // Fallback if D3's preferred state is taken
    if (!d3State && unusedOps.length >= 1) {
      const fallback = composeFlip(keyFlip, unusedOps[0])
      if (!usedStates.has(fallback)) {
        d3State = fallback
      }
    }

    if (d3State) {
      const d3 = chimera(`mirror:keyAboutUnusedAxis`, mirrorCell(d3State, params.glyph, params.fill), [AXIS])
      candidates.push(d3)
      usedStates.add(d3State)
    }

    // D4 (RP): copy cell at position 3 of line 2.
    const d4LinePos = params.direction === 'row' ? { row: 2, col: 3 } : { row: 3, col: 2 }
    const d4State = valueAt(d4LinePos.row, d4LinePos.col, params.direction, params.starts, params.op1, params.op2)
    if (!usedStates.has(d4State)) {
      const d4 = repetition(
        `copyCell:${params.direction === 'row' ? 'R2C3' : 'R3C2'}`,
        mirrorCell(d4State, params.glyph, params.fill),
        [AXIS],
      )
      candidates.push(d4)
      usedStates.add(d4State)
    }

    // D5 (RP): copy cell at position 3 of line 1.
    const d5LinePos = params.direction === 'row' ? { row: 1, col: 3 } : { row: 3, col: 1 }
    const d5State = valueAt(d5LinePos.row, d5LinePos.col, params.direction, params.starts, params.op1, params.op2)
    if (!usedStates.has(d5State)) {
      const d5 = repetition(
        `copyCell:${params.direction === 'row' ? 'R1C3' : 'R3C1'}`,
        mirrorCell(d5State, params.glyph, params.fill),
        [AXIS],
      )
      candidates.push(d5)
      usedStates.add(d5State)
    }

    // Fallback: remaining grid states
    const fallbackStates = Array.from(gridStates)
      .filter((state) => !usedStates.has(state))
      .sort()

    for (const state of fallbackStates) {
      if (candidates.length >= 5) break
      const fallback = chimera(
        `otherOrientation:${state}`,
        mirrorCell(state as FlipState, params.glyph, params.fill),
        [AXIS],
      )
      candidates.push(fallback)
      usedStates.add(state)
    }

    if (candidates.length < 5) {
      throw new GeneratorError('DISTRACTOR_PLAN_FAILED', {
        family: 'LRM-MIRROR',
        candidates: candidates.length,
        needed: 5,
      })
    }

    return candidates.slice(0, 5)
  },

  nonCardinalAsymmetricRotation: () => false,
  /**
   * OQ-3 (doc 03-item-generation-pipeline.md; see qa/degeneracy.ts's
   * gridLevelDegeneracy and LRM-MOVE, the precedent): a single-axis family
   * whose axis has a small finite orbit — eight D4 orientations over eight
   * visible cells — will usually show the key's orientation somewhere in the
   * grid. The sampler REQUIRES it (constraint (c) in the header), so that
   * the key is a twin and G-11/G-19 are satisfiable with twin distractors;
   * the mitigation OQ-3 asks for is exactly that: several options are also
   * copies of visible cells, so "it appears in the grid" never singles out
   * the key.
   */
  permitKeyEqualsCell: true,
  structuralExtra: (params) => ({
    glyph: params.glyph,
    fill: params.fill,
    op1: params.op1,
    op2: params.op2,
    direction: params.direction,
  }),
}

/** Human-readable name for a reflection axis. */
function opName(op: FlipOp): string {
  switch (op) {
    case 'h':
      return 'vertical'
    case 'v':
      return 'horizontal'
    case 'd1':
      return 'TL–BR diagonal'
    case 'd2':
      return 'TR–BL diagonal'
  }
}
