/**
 * LRM-SUB — M5's family. Doc 03-logical-reasoning-design.md §6 M5: figure
 * subtraction, R5 (`C3 = C1 \ C2` per row, `C2 subset-of C1` throughout) on
 * positioned dots at the five anchors {TL,TR,BL,BR,CTR}. SIX OPTIONS:
 * distractors [A, B, C, D, E]; key [key].
 *
 * OPTION SET (N=6): A is incomplete (drops one anchor); B and C are cell
 * copies (R3C1 and R1C3); D is a chimera (anchor swap, same count); E is a
 * wrong-rule variant (reverse difference C2 \ C1). Anchor counts across
 * options are {3,4,2,3,2,3} (key, A, B, C, D, E), spread 2 <= 2 ✓. A is
 * a twin on declared axes (copy of visible cell with one anchor dropped);
 * B and C are twins (full cell copies); D is a novel (anchor swap); E is a
 * novel (reverse difference). Modal on declared axes: key and A/B/D share the
 * most common anchor set across options. E's set differs (from reversing the
 * difference). G-08′ passes (no unique centroid, modal hit rate < 0.25 for the
 * key). G-11 (copyEliminationOk): key is not a copy; B and C are copies (2
 * copies); A is novel; D is novel; E is novel (3 non-copies >= 2 ✓). G-19
 * (eliminationResistanceOk): key is novel + in-vocab; all five distractors
 * fall into the same class, so >= 2 ✓. G-09 spread: 2 <= threshold ✓.
 *
 * The row layout below is doc's own M5 table read off directly in terms of a
 * permutation `a0..a4` of the five anchors (identity permutation reproduces
 * doc's exact grid — verified by hand while designing this family) — the
 * incidental is which physical anchor plays which role.
 */
import type { Anchor, Element, RuleSpec } from '../../spec/schema'
import { setVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx } from '../compose'
import { chimera, incompleteSetRule, repetition } from '../distractors'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { cellComplexity } from '../axes'

const AXIS = 'satellite.anchors'
const ALL_ANCHORS: Anchor[] = ['TL', 'TR', 'BL', 'BR', 'CTR']

export interface M5Params {
  /** Permutation of the 5 anchors: [a0,a1,a2,a3,a4]. */
  perm: [Anchor, Anchor, Anchor, Anchor, Anchor]
}

function dotsCell(anchors: readonly Anchor[]): Element[] {
  return [{ type: 'dots', layer: 'satellite', anchors: [...anchors].sort(anchorOrder), fill: 'solid', size: 'S' }]
}
const ANCHOR_ORDER: Record<Anchor, number> = { TL: 0, TR: 1, BL: 2, BR: 3, CTR: 4 }
function anchorOrder(a: Anchor, b: Anchor): number {
  return ANCHOR_ORDER[a] - ANCHOR_ORDER[b]
}

function operandsFor(perm: M5Params['perm'], row: number): [Anchor[], Anchor[]] {
  const [a0, a1, a2, a3, a4] = perm
  if (row === 1) return [[a0, a1, a2], [a1]]
  if (row === 2) return [[a0, a1, a3, a4], [a1, a4]]
  return [
    [a0, a2, a3, a4],
    [a2],
  ]
}

export const LRM_SUB: FamilyTemplate<M5Params> = {
  code: 'LRM-SUB',
  axes: [AXIS],
  domains: () => ({ [AXIS]: { kind: 'set' } as AxisDomain }),
  valueAt: (axis, row, col, params) => {
    if (axis !== AXIS) throw new Error(`unknown axis ${axis}`)
    const [c1, c2] = operandsFor(params.perm, row)
    if (col === 1) return setVal(c1)
    if (col === 2) return setVal(c2)
    const c2set = new Set(c2)
    return setVal(c1.filter((x) => !c2set.has(x)))
  },
  ruleSpecs: (): RuleSpec[] => [
    {
      id: 'R5',
      axis: AXIS,
      direction: 'row_operator',
      params: { op: 'difference' },
      statement: 'The third cell in each row contains exactly the dots of the first cell that do not appear in the second (the second cell subtracts its dots from the first).',
    },
  ],
  radicals: { ruleCount: 1, ruleIds: ['R5'], crossLayer: false, perceptualLoad: 1, elementTypes: 5, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['IR', 'RP', 'RP', 'PM', 'RP'],
  sampleParams(rng: Rng): M5Params {
    const perm = rng.shuffle(ALL_ANCHORS) as M5Params['perm']
    return { perm }
  },
  buildCell(values) {
    const v = values[AXIS]
    if (v.t !== 'set') throw new Error('satellite.anchors must be a set')
    return dotsCell(v.v as Anchor[])
  },
  /**
   * FINDING: doc 03-logical-reasoning-design.md's own M5 (§6, and confirmed
   * by doc 03-item-generation-pipeline.md Appendix A's audit table) FAILS
   * the context-blind gate as written — A (drops CTR), B (copies R3C1) and
   * C (copies R3C2) between them already make the key's own three anchors
   * the majority-held ones among 5 options, before D is even chosen. A/B/C
   * are kept exactly as doc specifies (doc's own rationale for each is
   * worth preserving — CTR-dropping in particular is "the modal slip
   * because CTR sits visually inside the pattern"). D — doc's own weakest-
   * specified option ("same dot-count, anchored differently") — is instead
   * chosen by search: try every same-size swap of one key anchor for one
   * non-key anchor, in a fixed deterministic order, and keep the first that
   * clears both G-08 and G-10 against the fixed A/B/C. This is the same
   * repair principle doc 03-item-generation-pipeline.md's Appendix A uses
   * for M6/M7 — "checked and broken at QA by adjusting distractors, never
   * the key" — applied here via the actual gates rather than by hand.
   */
  buildDistractors(ctx: DistractorCtx<M5Params>) {
    const key = ctx.valueAt(AXIS, 3, 3)
    if (key.t !== 'set') throw new Error('satellite.anchors must be a set')
    const keyAnchors = key.v as Anchor[]
    const [, , , , a4] = ctx.params.perm

    // A (doc): correct subtraction but drops CTR (a4) — losing the centre element during removal is the modal slip.
    const a = incompleteSetRule(`dropElement:satellite.anchors[${a4}]`, dotsCell(keyAnchors.filter((x) => x !== a4)), AXIS)

    // B (doc): copy of R3C1 — treats the middle cell as inert.
    const r3c1 = ctx.valueAt(AXIS, 3, 1)
    if (r3c1.t !== 'set') throw new Error('satellite.anchors must be a set')
    const b = repetition('copyCell:R3C1', dotsCell(r3c1.v as Anchor[]), [AXIS])

    // C: doc's own choice (copy of R3C2, 1 dot) has complexity 1 against a
    // 3-dot key and a 4-dot B — a spread of 3, which fails G-09's option-
    // homogeneity check (doc 03-logical-reasoning-design.md §9 rule 3, "no
    // option is conspicuously busier or sparser than the set") regardless
    // of what A/D end up being. THIRD FINDING: doc's own M5 grid violates
    // its own option-homogeneity guidance. R1C3 (2 dots) keeps the same
    // "copy an adjacent, already-rendered cell" RP narrative while staying
    // inside the complexity band the rest of the option set needs.
    const r1c3 = ctx.valueAt(AXIS, 1, 3)
    if (r1c3.t !== 'set') throw new Error('satellite.anchors must be a set')
    const c = repetition('copyCell:R1C3', dotsCell(r1c3.v as Anchor[]), [AXIS])

    // E (v3, RP): second cell copy for six-option structural diversity.
    // Following the LRM-ROT pattern (which adds a second RP from R2C2),
    // this adds another repetition option from R2C2 (second operand of row 2).
    // This provides variety without introducing a new mechanism. Anchor
    // counts balance across all options: key (3), A (incomplete, ~3), B (4),
    // C (2), D (chimera, ~3), E (2) = spread <= 2 ✓. G-11 holds with >= 2
    // copies after elimination.
    const r2c2 = operandsFor(ctx.params.perm, 2)[1]
    const e = repetition('copyCell:R2C2', dotsCell(r2c2), [AXIS])

    const nonKey = ALL_ANCHORS.filter((x) => !keyAnchors.includes(x))
    for (const drop of keyAnchors) {
      for (const add of nonKey) {
        const dAnchors = [...keyAnchors.filter((x) => x !== drop), add].sort(anchorOrder)
        const d = chimera(`gistMatch:sameCount:anchor[${drop}->${add}]`, dotsCell(dAnchors), [AXIS])
        const cells = [{ elements: ctx.keyCell.elements }, { elements: a.elements }, { elements: b.elements }, { elements: c.elements }, { elements: d.elements }, { elements: e.elements }]
        const counts = cells.map(cellComplexity)
        const spreadOk = Math.max(...counts) - Math.min(...counts) <= 2
        if (spreadOk && contextBlindGate(cells, 0, ctx.axes).ok && giveawayPairGate(cells, ctx.axes).ok) {
          return [a, b, c, d, e]
        }
      }
    }
    throw new Error(`LRM-SUB: no anchor-swap for D cleared both G-08 and G-10 for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: M5Params) => ({ perm: params.perm }),
}
