/**
 * Batch-level QA gates (doc 03-item-generation-pipeline.md §7's G-16/G-17),
 * formalised as real pass/fail gates rather than left as test-only
 * assertions. `generateBatch` (generator/index.ts) calls `runBatchGates`
 * after assembling a run and throws if either fails — "gates fail the run,
 * not just the item" (doc §7's own framing), now actually enforced for the
 * batch-level gates the same way per-item gates already are.
 *
 * G-17, RECONCILED (issue #346, item 3). Doc 03-item-generation-pipeline.md
 * §4.4/§7 defines G-17 as "blind-scorer hit rate within the exact binomial
 * 95% interval around 0.200" — i.e. a batch of context-blind-solvable-ish
 * items should look statistically like chance guessing. But G-08 (this
 * same module's `contextBlindGate`) already REJECTS every individual item
 * where either blind scorer recovers the key, and it runs on every item
 * before it can be accepted into a batch. Once G-08 holds for every
 * accepted item, the batch-level hit COUNT is mechanically driven to
 * exactly 0 (see `contextblind.ts`'s own header comment on
 * `batchBlindHitRate` for the full derivation) — which sits far outside
 * doc's stated ~20%-of-chance acceptance interval for any bank of
 * meaningful size. The two gates, taken literally, are in tension: G-08
 * (per item) mechanically falsifies G-17 (per batch) as doc states it.
 *
 * RESOLUTION: G-17 is REDEFINED, not dropped, to the criterion that is
 * actually satisfiable and actually meaningful once G-08 is enforced
 * per-item: the batch-level hit count must be exactly 0, confirming G-08's
 * per-item guarantee held for every accepted item in the run, with no
 * exceptions. `batchBlindHitRate`'s literal binomial-interval computation
 * is still reported alongside, as calibration context for a future world
 * where G-08 is relaxed or an item's option set is edited post-generation
 * — but it is no longer the pass/fail criterion. This is doc §9's own
 * license for gate reconciliation ("Reconcile G-08 and G-17 so both are
 * satisfiable, or replace one with something that is") applied directly:
 * G-17 is replaced with the strictly weaker, always-satisfiable-once-G-08-
 * holds statement, not dropped.
 */
import type { GateStatus } from './index'
import { batchBlindHitRate, type BatchBlindResult } from './contextblind'
import type { AxisId } from '../axes'
import type { CellLike } from '../axes'

export interface BatchGateEntry {
  status: GateStatus
  detail?: Record<string, unknown>
}

export interface BatchQaReport {
  gates: Record<'G-16' | 'G-17', BatchGateEntry>
}

export interface KeySlotCounts {
  A: number
  B: number
  C: number
  D: number
  E: number
}

/** G-16 (batch): key slot counts across the run differ by <= 1 (doc §9 rule 2). Guaranteed by construction here (distractors.ts's round-robin `keySlotIndex`), so this re-checks the guarantee rather than searching for a fix. */
export function keySlotBalanceGate(slots: readonly ('A' | 'B' | 'C' | 'D' | 'E')[]): BatchGateEntry {
  const counts: KeySlotCounts = { A: 0, B: 0, C: 0, D: 0, E: 0 }
  for (const s of slots) counts[s]++
  const values = Object.values(counts)
  const spread = Math.max(...values) - Math.min(...values)
  return spread <= 1 ? { status: 'pass', detail: { counts } } : { status: 'fail', detail: { counts, spread } }
}

/**
 * G-17 (batch), reconciled per this file's header comment: the hit count
 * from BOTH blind scorers, across the whole batch, must be exactly 0 — the
 * batch-level confirmation that G-08's per-item guarantee held throughout.
 * The theoretical ~20%-of-chance interval from doc's original wording is
 * still computed and returned for visibility (`chanceInterval`), but it is
 * informational, not the pass/fail criterion.
 */
export function batchBlindGuaranteeGate(items: readonly { options: readonly CellLike[]; keyIndex: number; axes: readonly AxisId[] }[]): BatchGateEntry {
  const result: BatchBlindResult = batchBlindHitRate(items)
  return result.hits === 0
    ? { status: 'pass', detail: { hits: result.hits, n: result.n, chanceInterval: [result.lowerBound, result.upperBound] } }
    : { status: 'fail', detail: { hits: result.hits, n: result.n, chanceInterval: [result.lowerBound, result.upperBound] } }
}

export function runBatchGates(input: { keySlots: readonly ('A' | 'B' | 'C' | 'D' | 'E')[]; blindItems: readonly { options: readonly CellLike[]; keyIndex: number; axes: readonly AxisId[] }[] }): BatchQaReport {
  return {
    gates: {
      'G-16': keySlotBalanceGate(input.keySlots),
      'G-17': batchBlindGuaranteeGate(input.blindItems),
    },
  }
}
