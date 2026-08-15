import 'server-only'
import { buildIngestPlan, familySeedKey, itemContentHash, type BankIngestPlan, type PlannedItem } from './plan'
import type { ParsedBank } from './bank-file'
import type { DifficultyPriorBand } from './bank-file'
import type { ItemBankStore, OptionDiagnosticInsert } from './store'

/**
 * Bank ingest orchestration (LR-8 / #347 scope item 1).
 *
 * Writes a generated cognitive bank into `items` / `item_options` /
 * `cognitive_item_specs` / `cognitive_option_specs` / `item_answer_keys` /
 * `item_option_diagnostics` / `item_families`, all linked to one
 * `cognitive_generation_runs` row.
 *
 * Idempotency, the conflict policy, and the reasoning behind both live in
 * plan.ts's header — that is where the decisions are, and they are pure.
 * This module is the ordering and the I/O:
 *
 *   families -> item -> options -> item spec -> option specs -> answer key
 *   -> option diagnostics
 *
 * The order is forced by the schema, not chosen: `cognitive_option_specs`
 * and `item_option_diagnostics` are keyed by `item_options.id`, and
 * `item_answer_keys` has a COMPOSITE foreign key `(correct_option_id,
 * item_id) -> item_options (id, item_id)` — the FK itself is what proves the
 * keyed option belongs to the item it is the key for.
 *
 * ---------------------------------------------------------------------------
 * NOT TRANSACTIONAL — what that means in practice
 * ---------------------------------------------------------------------------
 * The Supabase JS client speaks PostgREST, which has no multi-statement
 * transaction. Per-item writes are therefore not atomic: a failure partway
 * through item N leaves items 1..N-1 fully written and item N partial.
 *
 * That is survivable precisely BECAUSE ingest is content-hash idempotent —
 * re-running after a fixed failure skips everything already complete. The one
 * genuinely partial row is item N, which is caught on the re-run by the
 * identity check (same family+seed, and a NULL/absent spec) or, more simply,
 * by the fact that it has no `cognitive_item_specs` row and so never appears
 * on the delivery path. The alternative — a SECURITY DEFINER SQL function
 * doing the whole bank in one transaction — is a real option if partial rows
 * ever become a nuisance, and is noted here rather than built now.
 */

export class BankIngestConflictError extends Error {
  readonly conflicts: BankIngestPlan['conflicts']
  readonly hashMismatches: BankIngestPlan['hashMismatches']
  constructor(plan: BankIngestPlan) {
    const parts: string[] = []
    if (plan.conflicts.length > 0) {
      parts.push(
        `${plan.conflicts.length} item(s) already exist under the same (family, seed) with different content: ` +
          plan.conflicts
            .slice(0, 5)
            .map((c) => `${c.familyCode}/${c.generatorSeed}`)
            .join(', '),
      )
    }
    if (plan.hashMismatches.length > 0) {
      parts.push(
        `${plan.hashMismatches.length} item(s) have a content hash that disagrees with their own spec ` +
          `(the file was edited after generation): ` +
          plan.hashMismatches
            .slice(0, 5)
            .map((m) => `${m.familyCode}/${m.generatorSeed}`)
            .join(', '),
      )
    }
    super(`Bank ingest refused — nothing was written. ${parts.join(' ')}`)
    this.name = 'BankIngestConflictError'
    this.conflicts = plan.conflicts
    this.hashMismatches = plan.hashMismatches
  }
}

export type IngestBankInput = {
  bank: ParsedBank
  /** The construct every ingested item is scored onto. */
  constructId: string
  /** A `cognitive`-typed `response_formats` row. */
  responseFormatId: string
  purpose?: 'construct' | 'practice' | 'seed'
  requestedByProfileId?: string | null
  gitSha?: string | null
  generatorName?: string
  stem?: string
  /** Injected for deterministic tests; defaults to the real clock. */
  now?: () => string
}

export type IngestBankResult = {
  /** Null when the bank was already fully present — a no-op writes no run row. */
  generationRunId: string | null
  itemsInserted: number
  itemsSkipped: number
  familiesCreated: number
  /** ids of the items written by THIS ingest, in bank order. */
  insertedItemIds: string[]
  /** Whether anything at all was written. */
  wroteAnything: boolean
}

/** Legacy coarse `items.difficulty` enum, derived from the four-band design prior. */
function coarseDifficulty(band: DifficultyPriorBand): 'easy' | 'medium' | 'hard' {
  if (band === 'easy') return 'easy'
  if (band === 'moderate') return 'medium'
  return 'hard'
}

export async function ingestGeneratedBank(
  store: ItemBankStore,
  input: IngestBankInput,
): Promise<IngestBankResult> {
  const now = input.now ?? (() => new Date().toISOString())
  const { bank } = input

  const familyCodes = [...new Set(bank.items.map((i) => i.familyCode))]
  const contentHashes = bank.items.map(itemContentHash)

  const existing = await store.loadExistingState(familyCodes, contentHashes)
  const plan = buildIngestPlan(bank, existing, { stem: input.stem })

  // All-or-nothing: refuse before the first write. See plan.ts's header for
  // why a changed item sharing an identity errors rather than versioning.
  if (plan.conflicts.length > 0 || plan.hashMismatches.length > 0) {
    throw new BankIngestConflictError(plan)
  }

  // Fully-present bank: the re-ingest case. Nothing is written at all, not
  // even a generation-run row, so "re-running the same bank cannot duplicate
  // it" holds for every table including provenance.
  if (plan.itemsToInsert.length === 0) {
    return {
      generationRunId: null,
      itemsInserted: 0,
      itemsSkipped: plan.skipped.length,
      familiesCreated: 0,
      insertedItemIds: [],
      wroteAnything: false,
    }
  }

  const generatorVersion =
    bank.summary.generatorVersion ?? bank.items[0]?.qa.generatorVersion ?? 'unknown'

  const runId = await store.createGenerationRun({
    kind: 'figural_matrix',
    generatorName: input.generatorName ?? 'matrix-sgmt',
    generatorVersion,
    gitSha: input.gitSha ?? null,
    seed: bank.summary.seed,
    params: {
      perFamilyRequested: bank.summary.perFamilyRequested,
      families: familyCodes,
      batteryVersion: bank.summary.batteryVersion,
      generatorStartedAt: bank.summary.startedAt,
      generatorFinishedAt: bank.summary.finishedAt,
    },
    requestedByProfileId: input.requestedByProfileId ?? null,
    startedAt: now(),
  })

  const familyIdByCode = new Map(plan.existingFamilyIdByCode)
  const newFamilyIds = new Set<string>()
  for (const family of plan.familiesToCreate) {
    const id = await store.createFamily({
      code: family.code,
      constructId: input.constructId,
      kind: family.kind,
      rules: family.rules,
      radicals: family.radicals,
      difficultyPriorB: family.difficultyPriorB,
      difficultyPriorBand: family.difficultyPriorBand,
      notes: null,
    })
    familyIdByCode.set(family.code, id)
    newFamilyIds.add(id)
  }

  const insertedItemIds: string[] = []
  let displayOrder = 0
  try {
    for (const planned of plan.itemsToInsert) {
      const familyId = familyIdByCode.get(planned.familyCode)
      if (!familyId) throw new Error(`no family row for ${planned.familyCode}`)

      const itemId = await writeItem(store, {
        planned,
        familyId,
        runId,
        displayOrder: displayOrder++,
        constructId: input.constructId,
        responseFormatId: input.responseFormatId,
        purpose: input.purpose ?? 'construct',
        createdByProfileId: input.requestedByProfileId ?? null,
      })
      insertedItemIds.push(itemId)

      // First item written for a family this ingest created becomes its
      // exemplar — the reviewer's "show me what this family looks like".
      if (newFamilyIds.has(familyId)) {
        await store.setFamilyExemplar(familyId, itemId)
        newFamilyIds.delete(familyId)
      }
    }
  } catch (error) {
    await store.finishGenerationRun(runId, {
      status: 'failed',
      itemsProposed: bank.summary.totalAttempted,
      itemsAccepted: insertedItemIds.length,
      itemsRejected: bank.summary.totalAttempted - bank.summary.totalAccepted,
      qaSummary: buildQaSummary(bank, plan, insertedItemIds.length),
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: now(),
    })
    throw error
  }

  await store.finishGenerationRun(runId, {
    status: 'succeeded',
    itemsProposed: bank.summary.totalAttempted,
    itemsAccepted: bank.summary.totalAccepted,
    itemsRejected: bank.summary.totalAttempted - bank.summary.totalAccepted,
    qaSummary: buildQaSummary(bank, plan, insertedItemIds.length),
    errorMessage: null,
    completedAt: now(),
  })

  return {
    generationRunId: runId,
    itemsInserted: insertedItemIds.length,
    itemsSkipped: plan.skipped.length,
    familiesCreated: plan.familiesToCreate.length,
    insertedItemIds,
    wroteAnything: true,
  }
}

async function writeItem(
  store: ItemBankStore,
  args: {
    planned: PlannedItem
    familyId: string
    runId: string
    displayOrder: number
    constructId: string
    responseFormatId: string
    purpose: 'construct' | 'practice' | 'seed'
    createdByProfileId: string | null
  },
): Promise<string> {
  const { planned } = args

  const itemId = await store.createItem({
    responseFormatId: args.responseFormatId,
    constructId: args.constructId,
    familyId: args.familyId,
    stem: planned.stem,
    purpose: args.purpose,
    difficulty: coarseDifficulty(planned.difficultyPriorBand),
    contentHash: planned.contentHash,
    displayOrder: args.displayOrder,
  })

  const optionIds = await store.createOptions(
    planned.options.map((option) => ({
      itemId,
      label: option.label,
      value: option.value,
      displayOrder: option.displayOrder,
    })),
  )

  await store.createItemSpec({
    itemId,
    kind: 'figural_matrix',
    spec: planned.itemSpec,
    generationRunId: args.runId,
    generatorSeed: planned.generatorSeed,
    qa: planned.qa,
    contentHash: planned.contentHash,
  })

  await store.createOptionSpecs(
    planned.options.map((option, i) => ({ optionId: optionIds[i], itemId, spec: option.spec })),
  )

  const keyIndex = planned.options.findIndex((o) => o.isKey)
  if (keyIndex < 0) throw new Error(`planned item ${planned.generatorSeed} has no key option`)
  await store.createAnswerKey({
    itemId,
    correctOptionId: optionIds[keyIndex],
    rationale: null,
    createdByProfileId: args.createdByProfileId,
  })

  // Only options the bank file actually labelled — the key never is, and an
  // older bank file may carry none at all, in which case the reviewer sees
  // "not recorded" rather than a wrong label. Banks shaped by
  // `bankFromGeneration` carry a label and rationale for all four distractors.
  const diagnostics: OptionDiagnosticInsert[] = []
  planned.options.forEach((option, i) => {
    if (!option.errorLabel) return
    diagnostics.push({
      optionId: optionIds[i],
      itemId,
      errorLabel: option.errorLabel,
      rationale: option.errorRationale,
    })
  })
  await store.createOptionDiagnostics(diagnostics)

  return itemId
}

function buildQaSummary(bank: ParsedBank, plan: BankIngestPlan, inserted: number): unknown {
  // Per-gate pass/fail tallies across the accepted items, plus the generator's
  // own per-family reject reasons. #347 scope item 5 wants a run traceable to
  // "QA pass/fail tallies and rejection reasons".
  const gateTallies: Record<string, { pass: number; fail: number; skip: number }> = {}
  for (const item of bank.items) {
    for (const [gate, entry] of Object.entries(item.qa.gates)) {
      const tally = (gateTallies[gate] ??= { pass: 0, fail: 0, skip: 0 })
      tally[entry.status] += 1
    }
  }

  const rejectionReasons: Record<string, number> = {}
  for (const family of Object.values(bank.summary.perFamily)) {
    for (const [reason, count] of Object.entries(family.rejects)) {
      rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + count
    }
  }

  return {
    gates: gateTallies,
    rejectionReasons,
    perFamily: bank.summary.perFamily,
    /** Design-prior bands, not measured difficulty. */
    difficultyPriorBandDistribution: bank.summary.bandDistribution,
    ingest: {
      inserted,
      skippedAlreadyPresent: plan.skipped.length,
      familiesCreated: plan.familiesToCreate.length,
    },
  }
}

export { familySeedKey }
