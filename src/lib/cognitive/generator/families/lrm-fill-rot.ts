/**
 * LRM-FILL-ROT — fill Latin square (cheap) × 45° rotation progression (hard),
 * cross-attribute on ONE element (moderate; predicted b with cheap discount =
 * −2 + 0.45 (R6 halved) + 0.3 (R2) + 0.5 (second rule) + 0.3 (non-cardinal
 * asymmetric rotation) = −0.45).
 *
 * TWO-RULE CONTRACT, SAME ELEMENT (v3 build-plan §1.1):
 * Cheap axis = outer.fill (R6 Latin square); hard axis = outer.rotation (R2).
 * D1–D4 match the key's fill; each carries a distinct rotation error from the
 * grid or derived from rotation steps (stall/IR, wrong-step/WR). D5 carries
 * exactly one cheap axis wrong (stall fill at R3C2) with D1's rotation.
 *
 * Modal arithmetic (N=6 options):
 *   - Fills: f*×5 (key, D1–D4) + altFill×1 (D5) → modal fill = f*
 *   - Rotations: r*×1 (key), r2×2 (D1, D5), rPrev×1 (D3), rWrongStep×1 (D2), rOver×1 (D4)
 *     → modal rotation = r2 (appears twice)
 *   - Modal composition = (f*, r2) = D1 → pHit = 0 ✓
 *   - Centroid: D1 shares rotation with key; D5 shares fill with D1; key not closest ✓
 *   - Complexity: all six options have 1 element (shape) → spread = 0 ✓
 *   - G-20: cheap axis (fill) holders = 5 of 6 (all but D5) ✓
 *   - G-19: key's rotation class is novel (r* = base + 90 + 180 never appears
 *     in 8-cell grid which realises base + {0,45,90,90,135,180,180,225}) ✓
 */

import type { Element, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal, numVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import { chimera, incompleteRule } from '../distractors'
import type { Rng } from '../rng'
import { uniquelySolvable } from './bitgrid'
import { cellEq } from '../axes'
import { copyEliminationOk, eliminationResistanceOk, keyBulkExtremumCheck, optionComplexitySpreadCheck } from '../qa/degeneracy'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'

const FILL_AXIS = 'outer.fill'
const ROT_AXIS = 'outer.rotation'

const GLYPHS = ['flag', 'lshape', 'trapezoid', 'arrow'] as const
const FILL_SET_OPTIONS = [
  ['outline', 'hatched', 'grey'],
  ['outline', 'hatched', 'solid'],
  ['outline', 'grey', 'solid'],
  ['hatched', 'grey', 'solid'],
] as const

const STEP_COL_MAG = 45
const STEP_ROW_MAG = 90

export interface FillRotParams {
  glyph: (typeof GLYPHS)[number]
  fillSet: readonly [string, string, string]
  rowOffset: 1 | 2
  base: number
  sign: 1 | -1
}

type FillValue = 'outline' | 'hatched' | 'grey' | 'solid'

function shapeCell(fill: string, rotation: number, glyph: string): Element[] {
  return [
    {
      type: 'shape',
      layer: 'outer',
      shape: glyph as ShapeId,
      fill: fill as FillValue, // fill is guaranteed to be from FILL_SET_OPTIONS
      size: 'L',
      anchor: 'CTR',
      rotation: ((rotation % 360) + 360) % 360,
    },
  ]
}

function fillAt(fillSet: readonly [string, string, string], rowOffset: number, row: number, col: number): string {
  return fillSet[(col - 1 + rowOffset * (row - 1)) % 3]
}

function rotationAt(params: Pick<FillRotParams, 'base' | 'sign'>, row: number, col: number): number {
  const stepCol = STEP_COL_MAG * params.sign
  const stepRow = STEP_ROW_MAG * params.sign
  return (((params.base + stepCol * (col - 1) + stepRow * (row - 1)) % 360) + 360) % 360
}

export const LRM_FILL_ROT: FamilyTemplate<FillRotParams> = {
  code: 'LRM-FILL-ROT',
  axes: [FILL_AXIS, ROT_AXIS],
  cheapAxes: [FILL_AXIS],
  domains: () => ({
    [FILL_AXIS]: { kind: 'unordered-enum' } as AxisDomain,
    [ROT_AXIS]: { kind: 'numeric-angle' } as AxisDomain,
  }),
  valueAt: (axis, row, col, params) => {
    if (axis === FILL_AXIS) return enumVal(fillAt(params.fillSet, params.rowOffset, row, col))
    if (axis === ROT_AXIS) return numVal(rotationAt(params, row, col))
    throw new Error(`unknown axis ${axis}`)
  },
  ruleSpecs: (params): RuleSpec[] => {
    const stepCol = STEP_COL_MAG * params.sign
    const stepRow = STEP_ROW_MAG * params.sign
    return [
      {
        id: 'R6',
        axis: FILL_AXIS,
        direction: 'both',
        params: { values: [...params.fillSet], rowOffset: params.rowOffset },
        statement: `Fill forms a Latin square: each of ${params.fillSet.join(', ')} appears exactly once per row and once per column.`,
      },
      {
        id: 'R2',
        axis: ROT_AXIS,
        direction: 'both',
        params: { base: params.base, stepPerColumn: stepCol, stepPerRow: stepRow, modulus: 360 },
        statement: `The figure turns ${Math.abs(stepCol)} degrees ${stepCol > 0 ? 'clockwise' : 'anticlockwise'} per column and ${Math.abs(stepRow)} degrees per row, from a base of ${params.base} degrees; fill is read separately.`,
      },
    ]
  },
  radicals: { ruleCount: 2, ruleIds: ['R6', 'R2'], crossLayer: false, perceptualLoad: 0, elementTypes: 2, nearMissCount: 3 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['IR', 'WR', 'IR', 'WR', 'PM'],
  sampleParams(rng: Rng): FillRotParams {
    for (let attempt = 0; attempt < 200; attempt++) {
      const glyph = rng.pick(GLYPHS)
      const fillSet = rng.pick(FILL_SET_OPTIONS) as readonly [string, string, string]
      const rowOffset = rng.pick([1, 2] as const)
      const base = rng.int(0, 7) * 45
      const sign = rng.pick([1, -1] as const)
      const params: FillRotParams = { glyph, fillSet, rowOffset, base, sign }

      // Build grid for uniquelySolvable check and cell distinctness
      const cells = ([1, 2, 3] as const)
        .flatMap((r) =>
          ([1, 2, 3] as const)
            .filter((c) => !(r === 3 && c === 3))
            .map((c) => ({
              row: r,
              col: c,
              elements: shapeCell(fillAt(params.fillSet, params.rowOffset, r, c), rotationAt(params, r, c), params.glyph),
            }))
        )

      // Check uniquely solvable (Level A)
      if (!uniquelySolvable(cells, [FILL_AXIS, ROT_AXIS], { [FILL_AXIS]: { kind: 'unordered-enum' }, [ROT_AXIS]: { kind: 'numeric-angle' } })) {
        continue
      }

      // Check for cell duplicates (G-12): all 8 cells must be pairwise distinct
      let hasDuplicate = false
      for (let i = 0; i < cells.length && !hasDuplicate; i++) {
        for (let j = i + 1; j < cells.length && !hasDuplicate; j++) {
          if (cellEq(cells[i], cells[j])) hasDuplicate = true
        }
      }
      if (hasDuplicate) continue

      // Check key doesn't equal any context cell
      const keyFill = fillAt(params.fillSet, params.rowOffset, 3, 3)
      const keyRot = rotationAt(params, 3, 3)
      const keyCell = shapeCell(keyFill, keyRot, params.glyph)
      const keyEqualsCell = cells.some((c) => cellEq({ elements: c.elements }, { elements: keyCell }))
      if (keyEqualsCell) continue

      return params
    }
    throw new Error('LRM-FILL-ROT: could not sample a valid grid in 200 attempts')
  },
  buildCell(values, params) {
    const fill = values[FILL_AXIS]
    const rot = values[ROT_AXIS]
    if (fill.t !== 'enum' || rot.t !== 'num') throw new Error('fill/rotation must be enum/num')
    return shapeCell(fill.v, rot.v, params.glyph)
  },
  buildDistractors(ctx: DistractorCtx<FillRotParams>) {
    const keyFill = ctx.valueAt(FILL_AXIS, 3, 3)
    const keyRot = ctx.valueAt(ROT_AXIS, 3, 3)
    if (keyFill.t !== 'enum' || keyRot.t !== 'num') throw new Error('fill/rotation must be enum/num')

    const stepCol = STEP_COL_MAG * ctx.params.sign
    const stepRow = STEP_ROW_MAG * ctx.params.sign

    // Build context for gate checks
    const contextCells = ctx.grid.map((gc) => ({ elements: gc.elements }))

    const validSet = (cands: DistractorCandidate[]): boolean => {
      if (cands.some((c) => c.wrongAxes.length === 0)) return false
      if (cands.some((c) => cellEq({ elements: c.elements }, ctx.keyCell))) return false
      for (let i = 0; i < cands.length; i++)
        for (let j = i + 1; j < cands.length; j++)
          if (cellEq({ elements: cands[i].elements }, { elements: cands[j].elements })) return false
      const cells = [{ elements: ctx.keyCell.elements }, ...cands.map((c) => ({ elements: c.elements }))]
      if (optionComplexitySpreadCheck(cells, false).status !== 'pass') return false
      if (keyBulkExtremumCheck(cells, 0).status !== 'pass') return false
      if (!copyEliminationOk(contextCells, cells, 0)) return false
      if (!eliminationResistanceOk(contextCells, cells, 0, ctx.axes)) return false
      if (!contextBlindGate(cells, 0, ctx.axes).ok) return false
      return giveawayPairGate(cells, ctx.axes).ok
    }

    // Compute rotation values at key reference points
    const r2 = ctx.valueAt(ROT_AXIS, 3, 2)
    const rPrev = ctx.valueAt(ROT_AXIS, 2, 3)
    if (r2.t !== 'num' || rPrev.t !== 'num') throw new Error('rotations must be numeric')

    const rWrongStep = (((keyRot.v - stepCol + stepRow) % 360) + 360) % 360
    const rOver = (((keyRot.v + stepCol) % 360) + 360) % 360

    // Get altFill (fill at R3C2, different from keyFill)
    const altFill = ctx.valueAt(FILL_AXIS, 3, 2)
    if (altFill.t !== 'enum') throw new Error('fill must be enum')

    // Collect all candidate rotations and ensure uniqueness
    const rotationSet = new Set([keyRot.v, r2.v, rPrev.v, rWrongStep, rOver])

    // Prepare rotation fallback list
    const fallbackRotations = new Set<number>()
    for (let k = 2; k <= 7; k++) {
      const candidate = (((keyRot.v + k * 45) % 360) + 360) % 360
      if (!rotationSet.has(candidate)) {
        fallbackRotations.add(candidate)
      }
    }

    // Ensure r2, rWrongStep, rPrev, rOver are all distinct and differ from keyRot
    let finalR2 = r2.v
    let finalRWrongStep = rWrongStep
    let finalRPrev = rPrev.v
    let finalROver = rOver

    // Function to check if a value is already used
    const isUsed = (val: number): boolean => {
      return val === keyRot.v || val === finalR2 || val === finalRWrongStep || val === finalRPrev || val === finalROver
    }

    // Resolve r2
    if (isUsed(finalR2) || finalR2 === keyRot.v) {
      for (const fb of fallbackRotations) {
        if (!new Set([keyRot.v, finalRWrongStep, finalRPrev, finalROver]).has(fb)) {
          finalR2 = fb
          fallbackRotations.delete(fb)
          break
        }
      }
    }

    // Resolve rWrongStep
    if (isUsed(finalRWrongStep) || finalRWrongStep === keyRot.v) {
      for (const fb of fallbackRotations) {
        if (!new Set([keyRot.v, finalR2, finalRPrev, finalROver]).has(fb)) {
          finalRWrongStep = fb
          fallbackRotations.delete(fb)
          break
        }
      }
    }

    // Resolve rPrev
    if (isUsed(finalRPrev) || finalRPrev === keyRot.v) {
      for (const fb of fallbackRotations) {
        if (!new Set([keyRot.v, finalR2, finalRWrongStep, finalROver]).has(fb)) {
          finalRPrev = fb
          fallbackRotations.delete(fb)
          break
        }
      }
    }

    // Resolve rOver
    if (isUsed(finalROver) || finalROver === keyRot.v) {
      for (const fb of fallbackRotations) {
        if (!new Set([keyRot.v, finalR2, finalRWrongStep, finalRPrev]).has(fb)) {
          finalROver = fb
          fallbackRotations.delete(fb)
          break
        }
      }
    }

    // D1: IR stall at R3C2 (rotation)
    const d1 = incompleteRule('stall:outer.rotation@R3C2', shapeCell(keyFill.v, finalR2, ctx.params.glyph), ROT_AXIS, keyRot, r2)

    // D2: WR wrong-step rotation
    const d2: DistractorCandidate = {
      elements: shapeCell(keyFill.v, finalRWrongStep, ctx.params.glyph),
      label: 'WR',
      mechanism: 'wrongRule:appliesRowStepAsColumnStep',
      wrongAxes: finalRWrongStep === keyRot.v ? [] : [ROT_AXIS],
    }

    // D3: IR stall at R2C3 (rotation)
    const d3 = incompleteRule('stall:outer.rotation@R2C3', shapeCell(keyFill.v, finalRPrev, ctx.params.glyph), ROT_AXIS, keyRot, rPrev)

    // D4: WR one step too far
    const d4: DistractorCandidate = {
      elements: shapeCell(keyFill.v, finalROver, ctx.params.glyph),
      label: 'WR',
      mechanism: 'wrongRule:oneStepTooFar',
      wrongAxes: finalROver === keyRot.v ? [] : [ROT_AXIS],
    }

    // D5: PM wrong fill + R3C2 rotation
    const d5 = chimera('incompleteCorrelate:wrongFill+R3C2rotation', shapeCell(altFill.v, finalR2, ctx.params.glyph), altFill.v === keyFill.v ? [] : [FILL_AXIS])

    const planned = [d1, d2, d3, d4, d5]
    if (validSet(planned)) return planned

    // Fallback: if the planned set doesn't pass gates, try to construct one that does
    // by varying the rotation values slightly
    const allRotations = [finalR2, finalRWrongStep, finalRPrev, finalROver]
      .concat(Array.from(fallbackRotations))
      .filter((r) => r !== keyRot.v)

    for (const r1 of allRotations) {
      for (const r2_cand of allRotations.filter((r) => r !== r1)) {
        for (const r3 of allRotations.filter((r) => r !== r1 && r !== r2_cand)) {
          for (const r4 of allRotations.filter((r) => r !== r1 && r !== r2_cand && r !== r3)) {
            const candidates: DistractorCandidate[] = [
              { elements: shapeCell(keyFill.v, r1, ctx.params.glyph), label: 'IR', mechanism: 'stall:outer.rotation', wrongAxes: r1 === keyRot.v ? [] : [ROT_AXIS] },
              { elements: shapeCell(keyFill.v, r2_cand, ctx.params.glyph), label: 'WR', mechanism: 'wrongstep:outer.rotation', wrongAxes: r2_cand === keyRot.v ? [] : [ROT_AXIS] },
              { elements: shapeCell(keyFill.v, r3, ctx.params.glyph), label: 'IR', mechanism: 'stall:outer.rotation', wrongAxes: r3 === keyRot.v ? [] : [ROT_AXIS] },
              { elements: shapeCell(keyFill.v, r4, ctx.params.glyph), label: 'WR', mechanism: 'wrongstep:outer.rotation', wrongAxes: r4 === keyRot.v ? [] : [ROT_AXIS] },
              chimera('incompleteCorrelate:wrongFill', shapeCell(altFill.v, r1, ctx.params.glyph), altFill.v === keyFill.v ? [] : [FILL_AXIS]),
            ]
            if (validSet(candidates)) return candidates
          }
        }
      }
    }

    throw new Error(`LRM-FILL-ROT: no distractor construction cleared all gates for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => true,
  // structuralExtra includes the parameters that make two items visually and structurally
  // distinct (not just relabellings or symmetries): glyph (shape choice), base rotation,
  // sign (rotation direction), rowOffset (Latin square order), and fillSet (which fills).
  structuralExtra: (params: FillRotParams) => ({ glyph: params.glyph, base: params.base, sign: params.sign, rowOffset: params.rowOffset, fillSet: Array.from(params.fillSet) }),
}
