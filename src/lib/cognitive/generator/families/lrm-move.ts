/**
 * LRM-MOVE — R3 movement, doc 03-logical-reasoning-design.md §3: "An
 * element translates along a defined path across cells (clockwise around
 * cell corners...)". A single dot moves clockwise around the four corner
 * anchors {TL,TR,BR,BL}, `stepCol` positions per column and `stepRow` per
 * row (mod 4).
 *
 * SIX OPTIONS (v3): five distractors with two IR stalls (from different
 * grid positions), one PM (cycle offset with altFill), and two RPs
 * (repetition from distinct grid cells). All are searched deterministically
 * until a valid combination passes G-08/G-10/OQ-3. The search tries
 * multiple (stallPos1, stallPos2, mirrorSteps, rp1Pos, rp2Pos) tuples to
 * find one set where all 6 options are distinct, all distractors are
 * wrong on the axis, >= 2 cells copy grid cells (OQ-3 mitigation), and
 * modal hit rate <= 0.25. Anchor multiset typically has 3-4 distinct values
 * across 6 options, modal anchors from stalls/RPs, key anchor not modal.
 *
 * FINDING (load-bearing, not a bug to fix): an exhaustive search over
 * every (base, stepCol, stepRow) with stepCol, stepRow in [-3,3] \ {0}, for
 * BOTH a period-4 corner cycle and a period-3 {TL,CTR,BR} cycle (doc's own
 * alternative path), found ZERO combinations where the key's anchor is not
 * already held by some context cell. This is not incidental bad luck: with
 * only 3 or 4 distinct positions spread across 9 grid cells, any single
 * moving element is a genuine Latin square (or a linear progression with a
 * DENSER-than-count wraparound) on ONE attribute — and unlike doc's own
 * count/rotation progressions (which have 5-8 distinct values, enough
 * headroom for the extremal cell to be unique), a 3- or 4-position cycle
 * mathematically forces the key's position to recur elsewhere in a 3x3
 * grid. This is precisely doc 03-item-generation-pipeline.md's own open
 * question OQ-3 ("KEY_EQUALS_CELL forbids the key duplicating a context
 * cell... recommend permitting full coincidence in a controlled minority
 * ... with a gate requiring >= 2 cell-copying options so the heuristic
 * cannot isolate") — R3 movement is the concrete family that FORCES OQ-3's
 * resolution rather than leaving it optional. This family sets
 * `permitKeyEqualsCell: true` and satisfies OQ-3's own mitigation directly
 * (qa/index.ts's G-11 enforces >= 2 copying options whenever that flag is
 * set — see that file's comment).
 */
import type { Anchor, Element, Fill, RuleSpec } from '../../spec/schema'
import { enumVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import { repetition } from '../distractors'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { cellEq } from '../axes'

const AXIS = 'satellite.anchor'
const CYCLE: Anchor[] = ['TL', 'TR', 'BR', 'BL']

export interface MoveParams {
  base: number // 0-3
  stepCol: number // nonzero mod 4
  stepRow: number // nonzero mod 4
  fill: Fill
  altFill: Fill
}

function idxOf(anchor: Anchor): number {
  return CYCLE.indexOf(anchor)
}
function anchorAt(params: MoveParams, row: number, col: number): Anchor {
  const idx = (((params.base + params.stepCol * (col - 1) + params.stepRow * (row - 1)) % 4) + 4) % 4
  return CYCLE[idx]
}

function dotCell(anchor: Anchor, fill: Fill): Element[] {
  return [{ type: 'shape', layer: 'satellite', shape: 'circle', fill, size: 'S', anchor, rotation: 0 }]
}

const FILLS: Fill[] = ['solid', 'outline', 'hatched']

export const LRM_MOVE: FamilyTemplate<MoveParams> = {
  code: 'LRM-MOVE',
  axes: [AXIS],
  domains: () => ({ [AXIS]: { kind: 'ordered-enum', ladder: CYCLE.map(enumVal) } as AxisDomain }),
  valueAt: (axis, row, col, params) => {
    if (axis !== AXIS) throw new Error(`unknown axis ${axis}`)
    return enumVal(anchorAt(params, row, col))
  },
  ruleSpecs: (params): RuleSpec[] => [
    {
      id: 'R3',
      axis: AXIS,
      direction: 'both',
      params: { cycle: CYCLE, stepPerColumn: params.stepCol, stepPerRow: params.stepRow, base: params.base },
      statement: `The dot moves clockwise around the four corners, ${params.stepCol} step(s) per column and ${params.stepRow} step(s) per row.`,
    },
  ],
  radicals: { ruleCount: 1, ruleIds: ['R3'], crossLayer: false, perceptualLoad: 0, elementTypes: 2, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['IR', 'PM', 'RP', 'RP', 'IR'],
  permitKeyEqualsCell: true,
  sampleParams(rng: Rng): MoveParams {
    const base = rng.int(0, 3)
    // step=2 (mod 4) has order 2 — it only ever reaches 2 of the 4 cycle
    // positions, which starves the distractor search of enough distinct
    // anchors to satisfy G-08 (found empirically: stepCol=stepRow=2 is the
    // one combination the search below cannot clear). {1,3} are the two
    // steps coprime with 4 (full period). For six options, stepCol=1 is
    // preferred as stepCol=3 sometimes fails the 5-distractor search;
    // this is a known limitation of the 4-anchor cyclic space.
    const stepCol = 1 // restrict to 1 for six-option stability
    const stepRow = rng.pick([1, 3])
    const fill = rng.pick(FILLS)
    const altFill = rng.pick(FILLS.filter((f) => f !== fill))
    return { base, stepCol, stepRow, fill, altFill }
  },
  buildCell(values, params) {
    const v = values[AXIS]
    if (v.t !== 'enum') throw new Error('satellite.anchor must be enum')
    return dotCell(v.v as Anchor, params.fill)
  },
  /**
   * Deterministic search for a valid set of 5 distractors. First searches
   * for the original 4-distractor combination (IR, PM, RP1, RP2), then adds
   * a 5th IR from a predetermined stall position. The search tries multiple
   * combinations of stall position, mirror steps, and RP positions until
   * finding one that passes G-08/G-10/OQ-3 gates.
   */
  buildDistractors(ctx: DistractorCtx<MoveParams>) {
    const key = ctx.valueAt(AXIS, 3, 3)
    if (key.t !== 'enum') throw new Error('satellite.anchor must be enum')
    const { params } = ctx

    const validSet = (candidates: DistractorCandidate[]): boolean => {
      if (candidates.some((cd) => cd.wrongAxes.length === 0)) return false
      for (let i = 0; i < candidates.length; i++)
        for (let j = i + 1; j < candidates.length; j++) if (cellEq({ elements: candidates[i].elements }, { elements: candidates[j].elements })) return false
      const cells = [ctx.keyCell, ...candidates.map((x) => ({ elements: x.elements }))]
      const copiesCount = cells.filter((c) => ctx.grid.some((gc) => cellEq(gc, c))).length
      if (copiesCount < 2) return false // OQ-3 mitigation
      return contextBlindGate(cells, 0, ctx.axes).ok && giveawayPairGate(cells, ctx.axes).ok
    }

    const stallPositions = [
      [3, 2],
      [2, 3],
      [1, 3],
      [3, 1],
    ] as const

    for (const stallPos of stallPositions) {
      const stall = ctx.valueAt(AXIS, stallPos[0], stallPos[1])
      if (stall.t !== 'enum') continue
      for (const mirrorSteps of [1, 2, 3]) {
        const mirrorAnchor = CYCLE[(idxOf(key.v as Anchor) + mirrorSteps) % 4]
        for (const rp1Pos of ctx.grid) {
          for (const rp2Pos of ctx.grid) {
            if (rp1Pos === rp2Pos) continue
            const rp1v = ctx.valueAt(AXIS, rp1Pos.row, rp1Pos.col)
            const rp2v = ctx.valueAt(AXIS, rp2Pos.row, rp2Pos.col)
            if (rp1v.t !== 'enum' || rp2v.t !== 'enum') continue
            // First, check if the 4-distractor base set (IR, PM, RP1, RP2) is valid
            const baseCandidates: DistractorCandidate[] = [
              { elements: dotCell(stall.v as Anchor, params.fill), label: 'IR', mechanism: `stall:satellite.anchor@R${stallPos[0]}C${stallPos[1]}`, wrongAxes: stall.v === key.v ? [] : [AXIS] },
              { elements: dotCell(mirrorAnchor, params.altFill), label: 'PM', mechanism: `cyclePosition:+${mirrorSteps}+wrongFill`, wrongAxes: mirrorAnchor === key.v ? [] : [AXIS] },
              repetition(`copyCell:R${rp1Pos.row}C${rp1Pos.col}`, dotCell(rp1v.v as Anchor, params.fill), rp1v.v === key.v ? [] : [AXIS]),
              repetition(`copyCell:R${rp2Pos.row}C${rp2Pos.col}`, dotCell(rp2v.v as Anchor, params.fill), rp2v.v === key.v ? [] : [AXIS]),
            ]
            if (validSet(baseCandidates)) {
              // Base set is valid, now add a 5th mechanism. Try a second IR first,
              // but if that fails, use a deterministic 5th RP (copy of first RP with altFill).
              for (const stallPos2 of stallPositions) {
                if (stallPos2 === stallPos) continue
                const stall2 = ctx.valueAt(AXIS, stallPos2[0], stallPos2[1])
                if (stall2.t !== 'enum') continue
                const candidates: DistractorCandidate[] = [
                  ...baseCandidates,
                  { elements: dotCell(stall2.v as Anchor, params.fill), label: 'IR', mechanism: `stall:satellite.anchor@R${stallPos2[0]}C${stallPos2[1]}`, wrongAxes: stall2.v === key.v ? [] : [AXIS] },
                ]
                if (validSet(candidates)) return candidates
              }
              // Fallback: use a deterministic 5th RP (copy of rp1Pos with altFill)
              const rp5 = repetition(`copyCell:R${rp1Pos.row}C${rp1Pos.col}+altFill`, dotCell(rp1v.v as Anchor, params.altFill), rp1v.v === key.v ? [] : [AXIS])
              const candidates: DistractorCandidate[] = [...baseCandidates, rp5]
              if (validSet(candidates)) return candidates
            }
          }
        }
      }
    }
    throw new Error(`LRM-MOVE: no distractor construction cleared G-08/G-10/OQ-3 for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: MoveParams) => ({ base: params.base, stepCol: params.stepCol, stepRow: params.stepRow, fill: params.fill, altFill: params.altFill }),
}
