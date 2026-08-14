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
 * doc 03-item-generation-pipeline.md §3.7 flags that doc 03-logical-
 * reasoning-design.md's own stated exemplar b values do NOT reconcile with
 * this formula (M1 -2.0 vs the formula's -1.5, M6 +0.7 vs +0.5, M8 +2.2 vs
 * +0.6 — a 1.6-logit gap the pi/delta terms can't close). That is
 * open question OQ-1 in the pipeline doc, explicitly unresolved and left for
 * a future revision of the weights. This implementation does NOT attempt to
 * "fix" the weights — it implements §3.7 exactly as specified, so this
 * module's numbers reproduce the doc's own formula (verifiable against its
 * worked M1-M8 predicted-b figures) while remaining honest that the doc's
 * OWN prose values for those same items disagree with it. See the LR-7
 * report for this finding; resolving OQ-1 is out of this task's scope
 * (it is a blueprint-authoring decision, not a generator bug).
 */
export function predictedB(rad: RadicalsForDifficulty, opts: { nonCardinalAsymmetricRotation: boolean }): number {
  const ruleSum = rad.ruleIds.reduce((s, id) => s + (W[id] ?? 0), 0) + (opts.nonCardinalAsymmetricRotation ? 0.3 : 0)
  return BETA0 + ruleSum + GAMMA * (rad.ruleCount - 1) + LAMBDA * (rad.crossLayer ? 1 : 0) + PI * rad.perceptualLoad + DELTA * Math.max(0, rad.nearMissCount - 2)
}

export function band(b: number): Band {
  return b < -1.0 ? 'easy' : b < 0.5 ? 'moderate' : b < 1.5 ? 'hard' : 'very_hard'
}
