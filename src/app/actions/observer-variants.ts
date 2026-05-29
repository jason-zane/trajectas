'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { logActionError } from '@/lib/security/action-errors'
import { getModelForTask } from '@/lib/ai/model-config'
import { openRouterProvider } from '@/lib/ai/providers/openrouter'
import {
  buildObserverPerspectivePrompt,
  parseObserverVariants,
  type ObserverRewriteInput,
} from '@/lib/ai/generation/prompts/observer-perspective'

/** A drafted observer variant, paired with its source self stem for review. */
export interface ObserverDraft {
  itemId: string
  constructName: string
  /** Existing observer stem, if the item already had one (so we don't clobber silently). */
  currentObserver: string | null
  selfStem: string
  draft: string
}

export interface GenerateObserverDraftsResult {
  drafts: ObserverDraft[]
  /** Item ids the model failed to produce a usable variant for. */
  failedIds: string[]
  /** How many selected items were dropped because the selection exceeded MAX_BATCH. */
  omittedForLimit: number
  error?: string
}

/** Max items per draft call — keeps the single LLM prompt a sane size. */
const MAX_OBSERVER_BATCH = 60

/**
 * Generate observer-perspective drafts for the given construct items. Pure draft
 * step — nothing is written until {@link commitObserverVariants} is called, so the
 * admin can review and edit each rewrite first.
 */
export async function generateObserverDrafts(
  itemIds: string[],
): Promise<GenerateObserverDraftsResult> {
  await requireAdminScope()

  const uniqueIds = Array.from(new Set(itemIds))
  const ids = uniqueIds.slice(0, MAX_OBSERVER_BATCH)
  const omittedForLimit = uniqueIds.length - ids.length
  if (ids.length === 0) return { drafts: [], failedIds: [], omittedForLimit }

  if (!(await openRouterProvider.isAvailable())) {
    return {
      drafts: [],
      failedIds: ids,
      omittedForLimit,
      error: 'AI generation is not configured (missing OpenRouter API key).',
    }
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('items')
    .select('id, stem, stem_observer, purpose, constructs(name)')
    .in('id', ids)
    .is('deleted_at', null)

  if (error)
    return { drafts: [], failedIds: ids, omittedForLimit, error: error.message }

  // Only construct items get observer wording — validity items (attention
  // checks etc.) have no construct and no 360 meaning.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []).filter((r: any) => r.purpose === 'construct')
  if (rows.length === 0) {
    return {
      drafts: [],
      failedIds: ids,
      omittedForLimit,
      error: 'None of the selected items are construct items.',
    }
  }

  const inputs: ObserverRewriteInput[] = rows.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      id: r.id,
      stem: r.stem,
      constructName: r.constructs?.name ?? undefined,
    }),
  )

  const task = await getModelForTask('item_generation')

  let content = ''
  try {
    const response = await openRouterProvider.complete({
      model: task.modelId,
      prompt: buildObserverPerspectivePrompt(inputs),
      temperature: 0.3,
      responseFormat: 'json',
    })
    content = response.content
  } catch (err) {
    logActionError('generateObserverDrafts', err)
    return {
      drafts: [],
      failedIds: ids,
      omittedForLimit,
      error: 'The AI request failed. Please try again.',
    }
  }

  const validIds = new Set(inputs.map((i) => i.id))
  const variants = parseObserverVariants(content, validIds)
  const byId = new Map(variants.map((v) => [v.id, v.stemObserver]))

  const drafts: ObserverDraft[] = []
  const failedIds: string[] = []
  for (const r of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = r as any
    const draft = byId.get(row.id)
    if (!draft) {
      failedIds.push(row.id)
      continue
    }
    drafts.push({
      itemId: row.id,
      constructName: row.constructs?.name ?? '',
      currentObserver: row.stem_observer ?? null,
      selfStem: row.stem,
      draft,
    })
  }

  return { drafts, failedIds, omittedForLimit }
}

export interface ObserverVariantUpdate {
  itemId: string
  stemObserver: string
}

export interface CommitObserverVariantsResult {
  updated: number
  error?: string
}

/**
 * Persist reviewed observer variants to items.stem_observer. Empty stems are
 * rejected (use null-clearing via a separate path if ever needed).
 */
export async function commitObserverVariants(
  updates: ObserverVariantUpdate[],
): Promise<CommitObserverVariantsResult> {
  const scope = await requireAdminScope()
  const db = createAdminClient()

  const clean = updates
    .map((u) => ({ itemId: u.itemId, stemObserver: u.stemObserver.trim() }))
    .filter((u) => u.itemId && u.stemObserver.length > 0)

  if (clean.length === 0) return { updated: 0, error: 'Nothing to save.' }

  let updated = 0
  for (const u of clean) {
    const { error } = await db
      .from('items')
      .update({ stem_observer: u.stemObserver })
      .eq('id', u.itemId)
    if (error) {
      logActionError('commitObserverVariants', error)
      continue
    }
    updated += 1
  }

  if (updated > 0) {
    revalidatePath('/items')
    revalidatePath('/constructs')
    await logAuditEvent({
      actorProfileId: scope.actor?.id ?? null,
      eventType: 'item.observer_variants_committed',
      targetTable: 'items',
      targetId: clean[0].itemId,
      metadata: { count: updated },
    })
  }

  return { updated }
}
