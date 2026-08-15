'use server'

/**
 * Item bank admin Server Actions (LR-8 / #347).
 *
 * Every export here is platform-admin only: `requireAdminScope()` runs BEFORE
 * `createAdminClient()` in every one of them, with no exceptions and no
 * entry in `tests/architecture/admin-actions-authz.test.ts`'s allowlist.
 * That matters more than usual on this surface — `getItemForReview` returns
 * answer keys and per-distractor error labels, which is the one thing #347
 * says must never reach a page a non-admin can open.
 *
 * The lifecycle state machine is NOT reimplemented here. `transitionItemLifecycle`
 * issues the UPDATE and reports what the database said: `items_lifecycle_guard()`
 * owns which transitions are legal (reading
 * `item_lifecycle_legal_transitions()`), and `items_review_signoff_guard()`
 * owns whether the required sign-offs exist. Both raise messages written to be
 * read by a human, so they are surfaced verbatim rather than translated into a
 * second, drifting vocabulary of error codes.
 *
 * @module
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logActionError } from '@/lib/security/action-errors'
import { logAuditEventSafe } from '@/lib/auth/support-sessions'
import {
  getGenerationRun,
  getItemBankOverview,
  getLifecycleTransitionGraph,
  listFamilyItems,
  listGenerationRuns,
  listItemFamilies,
  listGenerationTargets,
  listItemsByLifecycleState,
  type BankItemSummary,
  type GenerationTargets,
  type GenerationRunDetail,
  type GenerationRunSummary,
  type ItemBankOverview,
  type ItemFamilyOverview,
  type ItemLifecycleState,
} from '@/lib/dal/item-bank-admin'
import { getItemForReview as getItemForReviewDal, type ItemForReview } from '@/lib/dal/item-bank-review'
import { parseBankFile, BankFileError } from '@/lib/item-bank/bank-file'
import { BankIngestConflictError, ingestGeneratedBank } from '@/lib/item-bank/ingest'
import { createSupabaseItemBankStore } from '@/lib/item-bank/store'
import { bankFromGeneration } from '@/lib/item-bank/from-generation'
import { generateBatch } from '@/lib/cognitive/generator/index'
import { ALL_FAMILIES } from '@/lib/cognitive/generator/families/index'
import {
  generateAndIngestBankSchema,
  ingestGeneratedBankSchema,
  recordItemReviewSchema,
  transitionItemLifecycleSchema,
  type GenerateAndIngestBankInput,
  type IngestGeneratedBankInput,
  type RecordItemReviewInput,
  type TransitionItemLifecycleInput,
} from '@/lib/validations/item-bank'

/**
 * URL path of the admin item bank surface, for `revalidatePath`.
 *
 * `/item-bank`, NOT `/dashboard/item-bank`: the pages live under
 * `src/app/(dashboard)/item-bank/`, and `(dashboard)` is a ROUTE GROUP, so it
 * contributes nothing to the URL — exactly as its siblings `/items` and
 * `/generate` do. `revalidatePath` matches on the URL, so the previous value
 * pointed at a path that does not exist and silently revalidated nothing.
 */
const ITEM_BANK_PATH = '/item-bank'

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

function failure(error: string): { ok: false; error: string } {
  return { ok: false, error }
}

/**
 * Postgres messages raised by the two lifecycle guards are already written for
 * a human ("item X cannot enter operational — no fairness review has been
 * recorded"). Pass them through; only unrecognised failures get a generic
 * message, so an internal detail never leaks while a guard verdict always
 * reaches the reviewer.
 */
const GUARD_MESSAGE_MARKERS = [
  'illegal item lifecycle transition',
  'cannot enter',
  'content is frozen',
  'operational items must have status',
  'retired items must have status',
  'append-only',
]

function guardMessage(message: string | undefined, fallback: string): string {
  if (!message) return fallback
  return GUARD_MESSAGE_MARKERS.some((marker) => message.includes(marker)) ? message : fallback
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getBankOverview(): Promise<ItemBankOverview> {
  await requireAdminScope()
  return getItemBankOverview(createAdminClient())
}

export async function getBankFamilies(): Promise<ItemFamilyOverview[]> {
  await requireAdminScope()
  return listItemFamilies(createAdminClient())
}

export async function getFamilyItems(familyId: string): Promise<BankItemSummary[]> {
  await requireAdminScope()
  return listFamilyItems(createAdminClient(), familyId)
}

export async function getReviewQueue(state: ItemLifecycleState = 'draft'): Promise<BankItemSummary[]> {
  await requireAdminScope()
  return listItemsByLifecycleState(createAdminClient(), state)
}

/**
 * ADMIN-SCOPED KEY PATH. Returns the answer key and the per-distractor error
 * labels — the whole point of review. Gated by `requireAdminScope()` above the
 * client, pinned by tests/architecture/admin-answer-key-isolation.test.ts.
 */
export async function getItemForReview(itemId: string): Promise<ItemForReview | null> {
  await requireAdminScope()
  return getItemForReviewDal(createAdminClient(), itemId)
}

export async function getBankGenerationRuns(limit = 50): Promise<GenerationRunSummary[]> {
  await requireAdminScope()
  return listGenerationRuns(createAdminClient(), limit)
}

export async function getBankGenerationRun(runId: string): Promise<GenerationRunDetail | null> {
  await requireAdminScope()
  return getGenerationRun(createAdminClient(), runId)
}

export async function getGenerationTargets(): Promise<GenerationTargets> {
  await requireAdminScope()
  return listGenerationTargets(createAdminClient())
}

/**
 * Which transitions the UI should OFFER out of each state. Read from the
 * database function the enforcing trigger itself consults — there is no
 * TypeScript copy of the state machine anywhere in this codebase.
 */
export async function getItemLifecycleTransitions(): Promise<Record<string, string[]>> {
  await requireAdminScope()
  const graph = await getLifecycleTransitionGraph(createAdminClient())
  return Object.fromEntries(graph)
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Record a content or fairness sign-off. The two are separate rows with
 * separate actors and timestamps; `reviewed_content_hash` is stamped by the
 * database from the item's current content, not supplied here, so a sign-off
 * can never claim to have reviewed content the reviewer did not see.
 */
export async function recordItemReview(input: RecordItemReviewInput): Promise<ActionResult> {
  const scope = await requireAdminScope()
  const parsed = recordItemReviewSchema.safeParse(input)
  if (!parsed.success) return failure('Invalid review submission.')

  const actorId = scope.actor?.id
  if (!actorId) return failure('Could not identify the reviewer.')

  const db = createAdminClient()
  const { error } = await db.from('item_reviews').insert({
    item_id: parsed.data.itemId,
    review_kind: parsed.data.reviewKind,
    decision: parsed.data.decision,
    reviewer_profile_id: actorId,
    notes: parsed.data.notes ?? null,
  })

  if (error) {
    logActionError('itemBank.recordItemReview', error)
    return failure(guardMessage(error.message, 'Could not record the review.'))
  }

  await logAuditEventSafe({
    actorProfileId: actorId,
    eventType: `item_review.${parsed.data.reviewKind}.${parsed.data.decision}`,
    targetTable: 'items',
    targetId: parsed.data.itemId,
    metadata: { reviewKind: parsed.data.reviewKind, decision: parsed.data.decision },
  })

  revalidatePath(ITEM_BANK_PATH)
  return { ok: true, data: undefined }
}

/**
 * Move an item along the lifecycle. Two database triggers decide whether this
 * is allowed; this function only makes the attempt and reports the verdict.
 *
 * The `status` writes below are NOT policy duplication — they are the data
 * consequence the guard demands (`operational` requires `status='active'`,
 * `retired` requires `status='archived'`). Omitting them would make every
 * promotion to those states fail on a constraint the caller cannot satisfy
 * from the UI.
 */
export async function transitionItemLifecycle(
  input: TransitionItemLifecycleInput,
): Promise<ActionResult<{ lifecycleState: string }>> {
  const scope = await requireAdminScope()
  const parsed = transitionItemLifecycleSchema.safeParse(input)
  if (!parsed.success) return failure('Invalid lifecycle transition request.')

  const { itemId, targetState } = parsed.data
  const patch: Record<string, unknown> = { lifecycle_state: targetState }
  if (targetState === 'operational') patch.status = 'active'
  if (targetState === 'retired') {
    patch.status = 'archived'
    patch.retired_at = new Date().toISOString()
  }

  const db = createAdminClient()
  const { data, error } = await db.from('items').update(patch).eq('id', itemId).select('lifecycle_state').maybeSingle()

  if (error) {
    logActionError('itemBank.transitionItemLifecycle', error)
    return failure(guardMessage(error.message, 'Could not change the lifecycle state of this item.'))
  }
  if (!data) return failure('Item not found.')

  await logAuditEventSafe({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'item_lifecycle.transition',
    targetTable: 'items',
    targetId: itemId,
    metadata: { targetState },
  })

  revalidatePath(ITEM_BANK_PATH)
  return { ok: true, data: { lifecycleState: String(data.lifecycle_state) } }
}

/**
 * Ingest a generated bank (`items.json` + `summary.json`).
 *
 * Idempotent by content hash: re-submitting the same bank writes nothing at
 * all, not even a generation-run row. A bank containing an item whose
 * (family, seed) identity already exists under different content is refused
 * outright, before the first insert — see src/lib/item-bank/plan.ts for why
 * that is the safe choice rather than skipping or auto-versioning.
 */
export async function ingestBank(input: IngestGeneratedBankInput): Promise<
  ActionResult<{
    generationRunId: string | null
    itemsInserted: number
    itemsSkipped: number
    familiesCreated: number
  }>
> {
  const scope = await requireAdminScope()
  const parsed = ingestGeneratedBankSchema.safeParse(input)
  if (!parsed.success) return failure('Invalid ingest request.')

  let bank
  try {
    bank = parseBankFile(parsed.data.items, parsed.data.summary)
  } catch (error) {
    if (error instanceof BankFileError) return failure(error.message)
    logActionError('itemBank.ingestBank.parse', error)
    return failure('Could not read the generated bank files.')
  }

  const db = createAdminClient()
  try {
    const result = await ingestGeneratedBank(createSupabaseItemBankStore(db), {
      bank,
      constructId: parsed.data.constructId,
      responseFormatId: parsed.data.responseFormatId,
      purpose: parsed.data.purpose,
      requestedByProfileId: scope.actor?.id ?? null,
      gitSha: parsed.data.gitSha ?? null,
      stem: parsed.data.stem,
    })

    await logAuditEventSafe({
      actorProfileId: scope.actor?.id ?? null,
      eventType: 'item_bank.ingest',
      targetTable: 'cognitive_generation_runs',
      targetId: result.generationRunId,
      metadata: {
        seed: bank.summary.seed,
        itemsInserted: result.itemsInserted,
        itemsSkipped: result.itemsSkipped,
        familiesCreated: result.familiesCreated,
      },
    })

    revalidatePath(ITEM_BANK_PATH)
    return {
      ok: true,
      data: {
        generationRunId: result.generationRunId,
        itemsInserted: result.itemsInserted,
        itemsSkipped: result.itemsSkipped,
        familiesCreated: result.familiesCreated,
      },
    }
  } catch (error) {
    logActionError('itemBank.ingestBank', error)
    if (error instanceof BankIngestConflictError) return failure(error.message)
    return failure('The bank could not be ingested.')
  }
}

export interface GenerateAndIngestResult {
  generationRunId: string | null
  itemsGenerated: number
  itemsInserted: number
  itemsSkipped: number
  familiesCreated: number
  /** Accepted-item counts by difficulty prior band, for the result summary. */
  bandDistribution: Record<string, number>
  /** QA gate that rejected each discarded candidate, by gate id. */
  rejectionReasons: Record<string, number>
}

/**
 * Generate a bank from a seed and ingest it in one step.
 *
 * The same two functions the CLI uses — `generateBatch` then
 * `ingestGeneratedBank` — with `bankFromGeneration` in between, so a seed run
 * here and a seed run from a terminal produce identical content hashes. That
 * equality is what makes this safe to re-run: ingest skips every item it has
 * already written, so pointing this at a seed that is half-loaded finishes the
 * load instead of duplicating it.
 *
 * Generating does NOT make anything takeable. Every item lands `draft`, and the
 * lifecycle guards refuse to move it further until a person records content and
 * fairness sign-offs against it in the review queue.
 */
export async function generateAndIngestBank(
  input: GenerateAndIngestBankInput,
): Promise<ActionResult<GenerateAndIngestResult>> {
  const scope = await requireAdminScope()
  const parsed = generateAndIngestBankSchema.safeParse(input)
  if (!parsed.success) return failure('Invalid generation request.')

  const startedAt = new Date().toISOString()
  let bank
  let generated
  try {
    generated = generateBatch(ALL_FAMILIES, parsed.data.seed, parsed.data.perFamily)
    if (generated.items.length === 0) {
      return failure('The generator produced no items that cleared QA. Try a different seed.')
    }
    bank = bankFromGeneration(generated, ALL_FAMILIES, {
      seed: parsed.data.seed,
      perFamily: parsed.data.perFamily,
      startedAt,
      finishedAt: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof BankFileError) return failure(error.message)
    logActionError('itemBank.generateAndIngestBank.generate', error)
    return failure('The bank could not be generated.')
  }

  const db = createAdminClient()
  try {
    const result = await ingestGeneratedBank(createSupabaseItemBankStore(db), {
      bank,
      constructId: parsed.data.constructId,
      responseFormatId: parsed.data.responseFormatId,
      purpose: parsed.data.purpose,
      requestedByProfileId: scope.actor?.id ?? null,
      stem: parsed.data.stem,
    })

    await logAuditEventSafe({
      actorProfileId: scope.actor?.id ?? null,
      eventType: 'item_bank.generate_and_ingest',
      targetTable: 'cognitive_generation_runs',
      targetId: result.generationRunId,
      metadata: {
        seed: parsed.data.seed,
        perFamily: parsed.data.perFamily,
        constructId: parsed.data.constructId,
        itemsGenerated: bank.items.length,
        itemsInserted: result.itemsInserted,
        itemsSkipped: result.itemsSkipped,
        familiesCreated: result.familiesCreated,
      },
    })

    revalidatePath(ITEM_BANK_PATH)

    const rejectionReasons: Record<string, number> = {}
    for (const perFamily of Object.values(generated.rejects)) {
      for (const [gate, count] of Object.entries(perFamily)) {
        rejectionReasons[gate] = (rejectionReasons[gate] ?? 0) + count
      }
    }

    return {
      ok: true,
      data: {
        generationRunId: result.generationRunId,
        itemsGenerated: bank.items.length,
        itemsInserted: result.itemsInserted,
        itemsSkipped: result.itemsSkipped,
        familiesCreated: result.familiesCreated,
        bandDistribution: bank.summary.bandDistribution,
        rejectionReasons,
      },
    }
  } catch (error) {
    logActionError('itemBank.generateAndIngestBank', error)
    if (error instanceof BankIngestConflictError) return failure(error.message)
    return failure('The generated bank could not be ingested.')
  }
}
