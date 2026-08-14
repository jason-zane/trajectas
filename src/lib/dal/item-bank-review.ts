import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { logActionError } from '@/lib/security/action-errors'
import { FiguralMatrixItemSpec } from '@/lib/cognitive/spec/schema'
import { getCognitiveItemsForDelivery } from '@/lib/dal/cognitive-items'
import {
  listItemFormPlacements,
  loadStandingSignOffs,
  type FormPlacement,
  type ItemLifecycleState,
  type SignOffSummary,
} from '@/lib/dal/item-bank-admin'
import type { DifficultyPriorBand } from '@/lib/item-bank/bank-file'

/**
 * The reviewer's view of a single cognitive item (LR-8 / #347 scope items 2
 * and 3) — INCLUDING the answer key and the per-distractor error labels.
 *
 * ===========================================================================
 * THIS IS THE ONLY MODULE THAT MAY READ KEY MATERIAL FOR AN ADMIN
 * ===========================================================================
 * #347's constraint: "the reviewer needs to see the key — that is the point of
 * review — but it must be fetched through an admin-scoped server path, never
 * bundled into a page a non-admin can reach."
 *
 * The layers that make that true, none of which is this comment:
 *
 *   1. DATABASE. `item_answer_keys` and `item_option_diagnostics` are
 *      service-role-only: RLS with no anon/authenticated policy AND
 *      `REVOKE ALL ... FROM PUBLIC, anon, authenticated` (20260813100500).
 *      A platform_admin holding an RLS-scoped client gets SQLSTATE 42501, not
 *      an empty list — pinned by tests/integration/cognitive-key-isolation.test.ts.
 *   2. AUTHORIZATION. The only caller is
 *      `src/app/actions/item-bank.ts#getItemForReview`, which calls
 *      `requireAdminScope()` (platform admin only) before opening the
 *      service-role client.
 *   3. ARCHITECTURE TEST. `tests/architecture/admin-answer-key-isolation.test.ts`
 *      asserts that this file is the ONLY module under `src/lib/dal/**` and
 *      `src/components/**` that names key material, that it is `server-only`,
 *      that no `'use client'` module imports it, and that the admin action
 *      exposing it is authorization-gated.
 *
 * The rendering deliberately reuses `getCognitiveItemsForDelivery` — the
 * participant runner's own renderer — rather than re-implementing it. That is
 * what makes "the reviewer sees exactly what a candidate sees" true by
 * construction rather than by diligence, and it keeps the key OUT of the
 * rendering path entirely: that function has no idea which option is correct.
 */

type DbClient = SupabaseClient

export type ReviewOption = {
  optionId: string
  slot: string
  label: string
  displayOrder: number
  /** Inline SVG, rendered by the participant renderer. */
  optionSvg: string | null
  /** KEY MATERIAL — admin-scoped paths only. */
  isKey: boolean
  /** KEY MATERIAL — key-revealing by omission (the unlabelled option is the key). */
  errorLabel: string | null
  errorRationale: string | null
}

export type ReviewRuleStatement = {
  id: string
  axis: string
  direction: string
  statement: string
}

export type ItemReviewRecord = {
  reviewKind: 'content' | 'fairness'
  decision: 'approved' | 'rejected'
  reviewerProfileId: string
  reviewerName: string | null
  reviewedAt: string
  reviewedContentHash: string | null
  notes: string | null
}

export type ItemForReview = {
  itemId: string
  familyId: string | null
  familyCode: string | null
  stem: string
  lifecycleState: ItemLifecycleState
  status: string
  itemVersion: number
  contentHash: string | null
  exposureCount: number
  createdAt: string

  /** Exactly what the candidate is shown. */
  gridSvg: string | null
  ariaLabel: string | null

  /** Reviewer-only design metadata; never delivered to a candidate. */
  ruleStatements: ReviewRuleStatement[]
  radicals: Record<string, unknown> | null
  /**
   * DESIGN PRIOR from the rule-based radical model — out-of-sample R² ~0.43,
   * with ~28% of variance between clones identical on every modelled radical.
   * Never a measured or calibrated difficulty; surface it labelled as a prior.
   */
  difficultyPriorB: number | null
  difficultyPriorBand: DifficultyPriorBand | null
  qaGates: Record<string, { status: string; detail?: unknown }>
  generatorSeed: string | null
  generationRunId: string | null

  options: ReviewOption[]
  /** KEY MATERIAL. */
  keyOptionId: string | null
  keyRationale: string | null

  contentSignOff: SignOffSummary | null
  fairnessSignOff: SignOffSummary | null
  reviewHistory: ItemReviewRecord[]
  formPlacements: FormPlacement[]
}

const BANDS = ['easy', 'moderate', 'hard', 'very_hard'] as const

function asBand(value: unknown): DifficultyPriorBand | null {
  return typeof value === 'string' && (BANDS as readonly string[]).includes(value)
    ? (value as DifficultyPriorBand)
    : null
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Everything a reviewer needs for one item, in one call.
 *
 * Requires a service-role client. Callers MUST have established platform-admin
 * authorization first — see the module header.
 */
export async function getItemForReview(db: DbClient, itemId: string): Promise<ItemForReview | null> {
  const { data: itemRow, error: itemError } = await db
    .from('items')
    .select(
      'id, stem, family_id, lifecycle_state, status, item_version, content_hash, exposure_count, created_at, item_families(code)',
    )
    .eq('id', itemId)
    .is('deleted_at', null)
    .maybeSingle()

  if (itemError) {
    logActionError('itemBankReview.item', itemError)
    return null
  }
  if (!itemRow) return null

  type ItemRow = {
    id: string
    stem: string
    family_id: string | null
    lifecycle_state: string
    status: string
    item_version: number
    content_hash: string | null
    exposure_count: number
    created_at: string
    item_families: { code: string } | null
  }
  const item = itemRow as unknown as ItemRow

  const [specResult, optionResult, keyResult, diagnosticResult, renders, signOffs, placements, history] =
    await Promise.all([
      db
        .from('cognitive_item_specs')
        .select('spec, qa, generator_seed, generation_run_id')
        .eq('item_id', itemId)
        .maybeSingle(),
      db
        .from('item_options')
        .select('id, label, value, display_order')
        .eq('item_id', itemId)
        .order('display_order', { ascending: true }),
      db.from('item_answer_keys').select('correct_option_id, rationale').eq('item_id', itemId).maybeSingle(),
      db.from('item_option_diagnostics').select('option_id, error_label, rationale').eq('item_id', itemId),
      getCognitiveItemsForDelivery(db, [itemId]),
      loadStandingSignOffs(db, [{ id: itemId, contentHash: item.content_hash }]),
      listItemFormPlacements(db, [itemId]),
      loadReviewHistory(db, itemId),
    ])

  if (specResult.error) logActionError('itemBankReview.spec', specResult.error)
  if (optionResult.error) logActionError('itemBankReview.options', optionResult.error)
  if (keyResult.error) logActionError('itemBankReview.key', keyResult.error)
  if (diagnosticResult.error) logActionError('itemBankReview.diagnostics', diagnosticResult.error)

  const specRow = (specResult.data ?? null) as {
    spec: unknown
    qa: unknown
    generator_seed: string | null
    generation_run_id: string | null
  } | null

  let ruleStatements: ReviewRuleStatement[] = []
  let radicals: Record<string, unknown> | null = null
  if (specRow) {
    const parsed = FiguralMatrixItemSpec.safeParse(specRow.spec)
    if (parsed.success) {
      ruleStatements = parsed.data.rules.map((rule) => ({
        id: rule.id,
        axis: rule.axis,
        direction: rule.direction,
        statement: rule.statement,
      }))
      radicals = parsed.data.radicals as unknown as Record<string, unknown>
    } else {
      // A stored spec that no longer validates is itself a review finding —
      // surface it rather than silently showing an item with no rules.
      logActionError('itemBankReview.parseSpec', new Error(`item ${itemId}: ${parsed.error.message}`))
    }
  }

  const qa = specRow?.qa && typeof specRow.qa === 'object' ? (specRow.qa as Record<string, unknown>) : {}
  const qaGates =
    qa.gates && typeof qa.gates === 'object'
      ? (qa.gates as Record<string, { status: string; detail?: unknown }>)
      : {}

  const keyRow = (keyResult.data ?? null) as { correct_option_id: string; rationale: string | null } | null
  const diagnosticsByOption = new Map<string, { error_label: string | null; rationale: string | null }>()
  for (const row of (diagnosticResult.data ?? []) as Array<{
    option_id: string
    error_label: string | null
    rationale: string | null
  }>) {
    diagnosticsByOption.set(row.option_id, { error_label: row.error_label, rationale: row.rationale })
  }

  const render = renders.get(itemId) ?? null
  const options: ReviewOption[] = (
    (optionResult.data ?? []) as Array<{ id: string; label: string; value: number; display_order: number }>
  ).map((row) => {
    const diagnostic = diagnosticsByOption.get(row.id)
    return {
      optionId: row.id,
      slot: row.label,
      label: row.label,
      displayOrder: row.display_order,
      optionSvg: render?.optionSvgByOptionId.get(row.id) ?? null,
      isKey: keyRow?.correct_option_id === row.id,
      errorLabel: diagnostic?.error_label ?? null,
      errorRationale: diagnostic?.rationale ?? null,
    }
  })

  const standing = signOffs.get(itemId) ?? { content: null, fairness: null }

  return {
    itemId: item.id,
    familyId: item.family_id,
    familyCode: item.item_families?.code ?? null,
    stem: item.stem,
    lifecycleState: item.lifecycle_state as ItemLifecycleState,
    status: item.status,
    itemVersion: item.item_version,
    contentHash: item.content_hash,
    exposureCount: item.exposure_count ?? 0,
    createdAt: item.created_at,
    gridSvg: render?.gridSvg ?? null,
    ariaLabel: render?.ariaLabel ?? null,
    ruleStatements,
    radicals,
    difficultyPriorB: asNumber(qa.predictedB),
    difficultyPriorBand: asBand(qa.band),
    qaGates,
    generatorSeed: specRow?.generator_seed ?? null,
    generationRunId: specRow?.generation_run_id ?? null,
    options,
    keyOptionId: keyRow?.correct_option_id ?? null,
    keyRationale: keyRow?.rationale ?? null,
    contentSignOff: standing.content,
    fairnessSignOff: standing.fairness,
    reviewHistory: history,
    formPlacements: placements.get(itemId) ?? [],
  }
}

async function loadReviewHistory(db: DbClient, itemId: string): Promise<ItemReviewRecord[]> {
  const { data, error } = await db
    .from('item_reviews')
    .select(
      'review_kind, decision, reviewer_profile_id, reviewed_content_hash, notes, created_at, profiles:reviewer_profile_id(first_name, last_name)',
    )
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })

  if (error) {
    logActionError('itemBankReview.history', error)
    return []
  }

  type Row = {
    review_kind: 'content' | 'fairness'
    decision: 'approved' | 'rejected'
    reviewer_profile_id: string
    reviewed_content_hash: string | null
    notes: string | null
    created_at: string
    profiles: { first_name: string | null; last_name: string | null } | null
  }

  return ((data ?? []) as unknown as Row[]).map((row) => {
    const name = `${row.profiles?.first_name ?? ''} ${row.profiles?.last_name ?? ''}`.trim()
    return {
      reviewKind: row.review_kind,
      decision: row.decision,
      reviewerProfileId: row.reviewer_profile_id,
      reviewerName: name.length > 0 ? name : null,
      reviewedAt: row.created_at,
      reviewedContentHash: row.reviewed_content_hash,
      notes: row.notes,
    }
  })
}
