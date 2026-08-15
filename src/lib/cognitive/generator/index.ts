/**
 * `generateFamily()` — doc 03-item-generation-pipeline.md §0's "stages 2-6
 * are one synchronous function call... `generateFamily` returns only items
 * that passed everything; rejects are counted ... and are never written."
 */
import { FiguralMatrixItemSpec, CognitiveOptionSpec, type FiguralMatrixItemSpec as ItemSpecType, type CognitiveOptionSpec as OptionSpecType } from '../spec/schema'
import { composeItem, GeneratorError, type FamilyTemplate } from './compose'
import { type DistractorCandidate, gateDistractor, placeOptions, repairBalance } from './distractors'
import { detectAllAxes, levelA } from './qa/uniqueness'
import { runQaBattery, type QaReport } from './qa/index'
import { runBatchGates, type BatchQaReport } from './qa/batch'
import { makeRng } from './rng'
import type { AxisId } from './axes'

const SLOTS = ['A', 'B', 'C', 'D', 'E'] as const

export interface GeneratedItem {
  familyCode: string
  seed: string
  itemSpec: ItemSpecType
  optionSpecs: OptionSpecType[]
  keySlot: (typeof SLOTS)[number]
  qa: QaReport
}

export interface GenerateFamilyOptions {
  existingContentHashes?: ReadonlySet<string>
  existingStructuralHashes?: ReadonlySet<string>
  /** Round-robin offset into A..E for the first item's key slot — callers doing a multi-family batch pass a running counter here so G-16 balances across the WHOLE batch, not just within one family. */
  keySlotOffset?: number
  now?: string
}

export interface GenerateFamilyResult {
  items: GeneratedItem[]
  /** Per-reason reject tally — never written to `items`, per doc §0. */
  rejects: Record<string, number>
  attempted: number
}

function tally(rejects: Record<string, number>, reason: string) {
  rejects[reason] = (rejects[reason] ?? 0) + 1
}

/**
 * `seed` + `n` -> up to `n` accepted items. An item that fails ANY gate is
 * dropped, not repaired-and-kept (repair is limited to `repairBalance`'s
 * distractor mutation, per doc §4.5/§9's "never the key"). This function
 * itself never throws on a per-item QA failure — it tallies and continues —
 * but DOES throw `GeneratorError` on a genuine family-authoring bug (an
 * axis collision, an unsolvable-at-generation grid, or a distractor gate
 * rejecting a family-authored candidate), because those indicate the family
 * template itself is wrong, not that this one draw was unlucky. This
 * mirrors doc §3.5's "these are generation-time preconditions... a family
 * that trips them frequently is misauthored."
 */
export function generateFamily<P>(template: FamilyTemplate<P>, seed: string, n: number, opts: GenerateFamilyOptions = {}): GenerateFamilyResult {
  const existingContentHashes = new Set(opts.existingContentHashes ?? [])
  const existingStructuralHashes = new Set(opts.existingStructuralHashes ?? [])
  const familyStructuralHashes = new Set<string>()
  const items: GeneratedItem[] = []
  const rejects: Record<string, number> = {}
  const keySlotOffset = opts.keySlotOffset ?? 0
  // Round-robins over ACCEPTED items only — a rejected draw must not
  // consume a slot, or the balance guarantee (doc §9 rule 2 / gate G-16)
  // breaks the moment any item in the run fails a gate (the common case).
  let acceptedCount = 0

  for (let i = 0; i < n; i++) {
    const itemSeed = `${seed}/${template.code}/${i}`
    const rng = makeRng(itemSeed)
    const composed = composeItem(template, rng)

    const axes: AxisId[] = [...new Set([...template.axes, ...detectAllAxes(composed.grid)])]
    const la = levelA(composed.grid, axes, composed.domains)
    if (!la.ok) {
      // The family's OWN generated grid is unsolvable by its own verifier —
      // a generation bug, not bad luck. Loud failure, matching doc §3.5.
      throw new GeneratorError('UNSOLVABLE_AT_GENERATION', { family: template.code, seed: itemSeed, reason: la.reason, detail: la.detail })
    }

    const ctx = {
      grid: composed.grid,
      keyCell: composed.keyCell,
      axes: template.axes,
      valueAt: composed.valueAt,
      params: composed.params,
      template,
    }
    const distractorRng = rng.sub('distractors')
    const candidates = template.buildDistractors(ctx, distractorRng)
    if (candidates.length !== template.distractorPlan.length) {
      throw new GeneratorError('DISTRACTOR_PLAN_MISMATCH', { family: template.code, seed: itemSeed, expected: template.distractorPlan.length, got: candidates.length })
    }

    const accepted: DistractorCandidate[] = []
    for (const c of candidates) {
      const gate = gateDistractor(c, { keyCell: composed.keyCell, accepted, admissibleTuples: la.admissibleTuples, axes: template.axes })
      if (!gate.ok) {
        throw new GeneratorError('DISTRACTOR_REJECTED', { family: template.code, seed: itemSeed, mechanism: c.mechanism, reason: gate.reason })
      }
      accepted.push(c)
    }

    const repaired = repairBalance(composed.keyCell, accepted, template.axes, () => null)
    if (!repaired.ok) {
      // No generic regeneration strategy is wired for these families (see
      // distractors.ts's header note) — a repair-worthy failure here means
      // the family's own distractorPlan needs re-authoring, so this throws
      // rather than shipping a context-blind-solvable item.
      throw new GeneratorError('CONTEXT_BLIND_UNREPAIRABLE', { family: template.code, seed: itemSeed })
    }

    // Tentative — only advances `acceptedCount` (and so the slot sequence)
    // once this item actually clears the QA battery below.
    const keySlotIndex = (keySlotOffset + acceptedCount) % 5
    const placed = placeOptions(composed.keyCell, repaired.accepted, keySlotIndex, rng.sub('keyPosition'))

    const qa = runQaBattery({
      item: composed,
      placedOptions: placed,
      keySlot: SLOTS[keySlotIndex],
      existingContentHashes,
      existingStructuralHashes,
      familyStructuralHashes,
      nonCardinalAsymmetricRotation: template.nonCardinalAsymmetricRotation(composed.params),
      now: opts.now,
    })

    if (!qa.ok) {
      tally(rejects, qa.firstFailure ?? 'UNKNOWN')
      continue
    }

    const itemSpec = FiguralMatrixItemSpec.parse({
      specVersion: 1,
      kind: 'figural_matrix',
      grid: { rows: 3, cols: 3, blank: { row: 3, col: 3 }, cells: composed.grid },
      rules: composed.rules,
      radicals: template.radicals,
      render: template.render,
    })
    const optionSpecs = placed.map((p) => CognitiveOptionSpec.parse({ slot: p.slot, elements: p.elements }))

    familyStructuralHashes.add(qa.report.structuralHash)
    existingContentHashes.add(qa.report.contentHash)
    acceptedCount++

    items.push({ familyCode: template.code, seed: itemSeed, itemSpec, optionSpecs, keySlot: SLOTS[keySlotIndex], qa: qa.report })
  }

  return { items, rejects, attempted: n }
}

export interface GenerateBatchOptions {
  existingContentHashes?: ReadonlySet<string>
  existingStructuralHashes?: ReadonlySet<string>
  now?: string
}

export interface GenerateBatchResult {
  items: GeneratedItem[]
  rejects: Record<string, Record<string, number>> // familyCode -> reason -> count
  attempted: Record<string, number>
  /** G-16/G-17, the batch-level gates (doc §7) — see qa/batch.ts for what G-17 was reconciled to mean. */
  batchQa: BatchQaReport
}

/**
 * Generate several families in one run, sharing a batch-wide key-slot
 * round-robin so G-16 balances across the whole bank, not per family.
 *
 * "Gates fail the run, not just the item" (doc §7): after assembling every
 * family's items, G-16 and G-17 are checked over the WHOLE batch via
 * `runBatchGates` (qa/batch.ts), and this throws if either fails — matching
 * how `generateFamily` already throws on a per-item invariant violation.
 * Both are guaranteed to pass by construction as this generator is written
 * (G-16 by the round-robin key-slot offset below; G-17, reconciled, by
 * every accepted item already having cleared G-08) — the check exists so a
 * future change to either mechanism fails loudly here rather than shipping
 * a skewed or context-blind-leaky bank silently.
 */
export function generateBatch(families: readonly FamilyTemplate<unknown>[], seed: string, perFamily: number, opts: GenerateBatchOptions = {}): GenerateBatchResult {
  const items: GeneratedItem[] = []
  const rejects: Record<string, Record<string, number>> = {}
  const attempted: Record<string, number> = {}
  const existingContentHashes = new Set(opts.existingContentHashes ?? [])
  const existingStructuralHashes = new Set(opts.existingStructuralHashes ?? [])
  let keySlotOffset = 0

  for (const family of families) {
    const result = generateFamily(family, seed, perFamily, {
      existingContentHashes,
      existingStructuralHashes,
      keySlotOffset,
      now: opts.now,
    })
    for (const item of result.items) {
      existingContentHashes.add(item.qa.contentHash)
      existingStructuralHashes.add(item.qa.structuralHash)
    }
    items.push(...result.items)
    rejects[family.code] = result.rejects
    attempted[family.code] = result.attempted
    keySlotOffset += result.items.length
  }

  const familyByCode = new Map(families.map((f) => [f.code, f]))
  const blindItems = items.map((item) => {
    const keyIndex = item.optionSpecs.findIndex((o) => o.slot === item.keySlot)
    const family = familyByCode.get(item.familyCode)!
    return { options: item.optionSpecs.map((o) => ({ elements: o.elements })), keyIndex, axes: family.axes }
  })
  const batchQa = runBatchGates({ keySlots: items.map((i) => i.keySlot), blindItems })
  const failed = Object.entries(batchQa.gates).find(([, g]) => g.status === 'fail')
  if (failed) {
    throw new GeneratorError('BATCH_GATE_FAILED', { gate: failed[0], detail: failed[1].detail })
  }

  return { items, rejects, attempted, batchQa }
}

export { GeneratorError }
export type { FamilyTemplate }
