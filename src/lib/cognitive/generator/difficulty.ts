/**
 * Doc 03-item-generation-pipeline.md §3.7's difficulty model, implemented
 * verbatim (weights and formula copied from doc 03-logical-reasoning-design
 * .md §4.4). `predictedB` is the ONLY place a `predicted_difficulty` value is
 * computed — it is never hand-typed into a spec, and QA gate G-14 asserts
 * `spec.radicals` reproduces it.
 *
 * IMPORTANT — never claim this predicts anything real. Doc 03-item-
 * generation-pipeline.md's own framing note (top of that document) applies
 * word for word: "No validation claims are made anywhere in this document
 * ... Every difficulty figure is a design prior ... Nothing described here
 * establishes that the generated items measure anything, discriminate
 * between anyone, or behave as the blueprint predicts." Every caller of
 * this module MUST label its output as a prior (e.g. `predicted_difficulty`,
 * never `difficulty`), per the LR-7 task's design constraints. Out-of-sample
 * rule-model R^2 is ~0.43 and ~28% of true item-difficulty variance sits
 * between clones identical on every modelled radical (doc 03-item-
 * generation-pipeline.md's framing note + the task's own instructions) — so
 * this number orders items into rough bands, it does not know their
 * difficulty.
 */
import type { RuleId } from '../spec/schema'

export type Band = 'easy' | 'moderate' | 'hard' | 'very_hard'

export interface RadicalsForDifficulty {
  ruleIds: readonly RuleId[]
  ruleCount: number
  crossLayer: boolean
  perceptualLoad: number
  nearMissCount: number
}

const W: Partial<Record<RuleId, number>> = {
  R0: 0,
  R1: 0.0,
  R2: 0.3,
  R8: 0.2,
  R9: 0.2,
  R3: 0.6,
  R4: 0.8,
  R5: 0.8,
  R6: 0.9,
  R7: 1.6,
}

const BETA0 = -2.0
const GAMMA = 0.5
const LAMBDA = 0.5
const PI = 0.3
const DELTA = 0.15

/**
 * OQ-1, RESOLVED (issue #346): doc 03-item-generation-pipeline.md §3.7
 * flagged that doc 03-logical-reasoning-design.md's own hand-typed exemplar
 * b values did not reconcile with this formula run over those items'
 * declared radicals (M1 -2.0 vs the formula's -1.5 under the doc's
 * ORIGINAL "2 rules" reading of M1's double progression; M6 +0.7 vs +0.5;
 * M8 +2.2 vs +0.9 with the actual family's radicals). **This module's
 * formula is authoritative.** The weights below are NOT adjusted to hit
 * the original prose figures — doing so would mean fitting an ad hoc
 * function to three hand-picked anchor points instead of keeping the
 * simple, auditable linear composite §12 (of doc 03-logical-reasoning-
 * design.md) describes as a design prior, and it would be indistinguishable
 * from silently relabelling items as harder without making them so.
 * Instead: (a) doc 03-logical-reasoning-design.md's per-item prose figures
 * for M1/M6/M8 were corrected to match what this formula actually computes
 * from each item's own (in M6's/M8's case, ALSO corrected — see those
 * items' "Correction" notes for the duplicate-cell fix) radicals — see that
 * doc's §4.4 and §6 "Correction" notes; (b) the resulting gap in very-hard
 * coverage (neither M6 nor M8 reaches b >= 1.5 once computed honestly) is
 * closed by two NEW families with genuinely more rule content
 * (`families/lrm-xor-dist-xlayer.ts`, `families/lrm-3r-xlayer.ts`), not by
 * changing a weight here. See `tests/unit/cognitive-generator-
 * difficulty.test.ts` for the worked reconciliation and the very-hard
 * acceptance test.
 */
export function predictedB(rad: RadicalsForDifficulty, opts: { nonCardinalAsymmetricRotation: boolean }): number {
  const ruleSum = rad.ruleIds.reduce((s, id) => s + (W[id] ?? 0), 0) + (opts.nonCardinalAsymmetricRotation ? 0.3 : 0)
  return BETA0 + ruleSum + GAMMA * (rad.ruleCount - 1) + LAMBDA * (rad.crossLayer ? 1 : 0) + PI * rad.perceptualLoad + DELTA * Math.max(0, rad.nearMissCount - 2)
}

export function band(b: number): Band {
  return b < -1.0 ? 'easy' : b < 0.5 ? 'moderate' : b < 1.5 ? 'hard' : 'very_hard'
}
