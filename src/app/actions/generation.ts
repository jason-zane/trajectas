'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { mapGenerationRunRow, mapGeneratedItemRow, mapResponseFormatRow } from '@/lib/supabase/mappers'
import { createGenerationRunSchema, acceptItemsSchema } from '@/lib/validations/generation'
import type {
  ConstructConfigOverride,
  GenerationRun,
  GeneratedItem,
  GenerationRunStatus,
  GenerationRunConfig,
  ResponseFormat,
} from '@/types/database'
import { runPipeline } from '@/lib/ai/generation'
import type {
  ConstructDraftInput,
  ConstructDraftState,
  ConstructChange,
  ScoredCandidateItem,
  ConstructForGeneration,
} from '@/types/generation'
import type { ProgressCallback } from '@/lib/ai/generation/types'


export type GenerationRunWithConstructNames = GenerationRun & {
  constructNames: string[]
}

// ---------------------------------------------------------------------------
// Mock item stems pool — 30 varied psychometric-style sentences
// ---------------------------------------------------------------------------

const MOCK_STEMS = [
  'I approach challenges with confidence and determination.',
  'When facing obstacles, I remain calm and seek constructive solutions.',
  'I take initiative without waiting to be told what to do.',
  'I adapt quickly when circumstances change unexpectedly.',
  'I hold myself accountable for the outcomes of my decisions.',
  'I listen carefully before forming judgements about others.',
  'I communicate my ideas clearly even when the topic is complex.',
  'I seek feedback actively to improve my performance.',
  'I can juggle multiple priorities without losing focus on quality.',
  'I build trust with colleagues through consistent follow-through.',
  'I remain productive even under high levels of pressure.',
  'I look for patterns across seemingly unrelated pieces of information.',
  'I make decisions based on evidence rather than intuition alone.',
  'I am comfortable voicing an unpopular opinion when I believe it is correct.',
  'I invest time in understanding perspectives that differ from my own.',
  'I set challenging goals and hold myself to a high standard.',
  'I recognise when I need help and ask for it without hesitation.',
  'I approach ambiguous problems with curiosity rather than frustration.',
  'I take ownership of team outcomes, not just my individual tasks.',
  'I translate complex concepts into language that others can understand.',
  'I proactively identify risks before they become problems.',
  'I maintain my composure when receiving critical feedback.',
  'I follow through on commitments even when circumstances make it difficult.',
  'I work effectively with people who have very different working styles.',
  'I continuously look for ways to improve existing processes.',
  'I prioritise the most important work even when urgent tasks compete for my attention.',
  'I use data to challenge assumptions and guide decisions.',
  'I create an environment in which others feel safe to share ideas.',
  'I learn quickly from both successes and failures.',
  'I bring energy and commitment to tasks I find less inherently motivating.',
]

const REVERSE_STEMS = [
  'I find it difficult to stay focused when there are many distractions.',
  'I prefer to avoid conflict, even when speaking up is necessary.',
  'I tend to delay decisions until I feel completely certain.',
  'I struggle to admit when I have made a mistake.',
  'I find it hard to adjust my approach when a plan is not working.',
  'I often overlook important details when I am under pressure.',
  'I find it challenging to motivate myself without external deadlines.',
  'I am reluctant to take on work that falls outside my defined role.',
  'I find it difficult to maintain focus during long or repetitive tasks.',
  'I tend to rely on habit rather than seeking more effective methods.',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickStem(index: number, reverseScored: boolean): string {
  if (reverseScored) {
    return REVERSE_STEMS[index % REVERSE_STEMS.length]
  }
  return MOCK_STEMS[index % MOCK_STEMS.length]
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

async function insertMockGeneratedItems(
  runId: string,
  config: GenerationRunConfig,
): Promise<number> {
  const db = createAdminClient()
  const { constructIds, targetItemsPerConstruct } = config

  const rows: {
    generation_run_id: string
    construct_id: string
    stem: string
    reverse_scored: boolean
    rationale: string
    embedding: number[]
    community_id: number
    initial_community_id: number
    final_community_id: number
    wto_max: number
    boot_stability: number
    removal_stage: 'uva' | 'boot_ega' | 'kept'
    removal_sweep: number | null
    is_redundant: boolean
    is_unstable: boolean
    is_accepted: boolean
    difficulty_tier: string
    sd_risk: string
    facet: string
  }[] = []

  const totalPerConstruct = targetItemsPerConstruct
  const reverseThreshold = Math.floor(totalPerConstruct * 0.6) // first 60% are forward-scored

  for (let ci = 0; ci < constructIds.length; ci++) {
    const constructId = constructIds[ci]
    const communityBase = ci + 1

    for (let i = 0; i < totalPerConstruct; i++) {
      const reverseScored = i >= reverseThreshold
      const wtoMax = randomBetween(0.05, 0.35)
      const bootStability = randomBetween(0.60, 0.99)

      rows.push({
        generation_run_id: runId,
        construct_id: constructId,
        stem: pickStem(i, reverseScored),
        reverse_scored: reverseScored,
        rationale: 'Generated item for construct',
        embedding: [],
        community_id: ((i % constructIds.length) + communityBase - 1) % constructIds.length + 1,
        initial_community_id: ((i % constructIds.length) + communityBase - 1) % constructIds.length + 1,
        final_community_id: ((i % constructIds.length) + communityBase - 1) % constructIds.length + 1,
        wto_max: Math.round(wtoMax * 1000) / 1000,
        boot_stability: Math.round(bootStability * 1000) / 1000,
        is_redundant: wtoMax > 0.20,
        is_unstable: bootStability < 0.75,
        removal_stage: wtoMax > 0.20 ? 'uva' : bootStability < 0.75 ? 'boot_ega' : 'kept',
        removal_sweep: wtoMax > 0.20 || bootStability < 0.75 ? 1 : null,
        is_accepted: false,
        difficulty_tier: ['easy', 'moderate', 'hard'][i % 3],
        sd_risk: ['low', 'moderate', 'high'][i % 3],
        facet: `facet-${(i % 4) + 1}`,
      })
    }
  }

  const { error } = await db.from('generated_items').insert(rows)
  if (error) throw new Error(error.message)

  return rows.length
}

// ---------------------------------------------------------------------------
// Public server actions
// ---------------------------------------------------------------------------

/** Get all generation runs, ordered newest first, with construct names resolved. */
export async function getGenerationRuns(): Promise<GenerationRunWithConstructNames[]> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('generation_runs')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const runs = (data ?? []).map(mapGenerationRunRow)

  // Collect all construct IDs across all runs
  const allConstructIds = Array.from(
    new Set(runs.flatMap((r) => r.config.constructIds ?? [])),
  )

  if (allConstructIds.length === 0) {
    return runs.map((r) => ({ ...r, constructNames: [] }))
  }

  const { data: constructs } = await db
    .from('constructs')
    .select('id, name')
    .in('id', allConstructIds)

  const nameMap = new Map<string, string>(
    (constructs ?? []).map((c) => [c.id, c.name]),
  )

  return runs.map((r) => ({
    ...r,
    constructNames: (r.config.constructIds ?? []).map((id) => nameMap.get(id) ?? id),
  }))
}

/** Get a single generation run with its generated items. */
export async function getGenerationRun(
  runId: string,
): Promise<{ run: GenerationRun; items: GeneratedItem[] } | null> {
  await requireAdminScope()
  const db = createAdminClient()

  const [runResult, itemsResult] = await Promise.all([
    db.from('generation_runs').select('*').eq('id', runId).single(),
    db
      .from('generated_items')
      .select('*')
      .eq('generation_run_id', runId)
      .order('created_at', { ascending: true }),
  ])

  if (runResult.error) return null

  return {
    run: mapGenerationRunRow(runResult.data),
    items: (itemsResult.data ?? []).map(mapGeneratedItemRow),
  }
}

/** Create a new generation run in 'configuring' status. */
export async function createGenerationRun(config: GenerationRunConfig): Promise<GenerationRun> {
  const scope = await requireAdminScope()
  const parsed = createGenerationRunSchema.safeParse({ config })
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(issues.join(', ') || 'Invalid generation config')
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('generation_runs')
    .insert({
      status: 'configuring' as GenerationRunStatus,
      progress_pct: 0,
      config: parsed.data.config,
      items_generated: 0,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/generate')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'generation_run.created',
    targetTable: 'generation_runs',
    targetId: data.id,
    metadata: {
      constructCount: parsed.data.config.constructIds.length,
      targetItemsPerConstruct: parsed.data.config.targetItemsPerConstruct,
      responseFormatId: parsed.data.config.responseFormatId,
    },
  })
  return mapGenerationRunRow(data)
}

/** Update run status/progress (called during pipeline execution). */
export async function updateGenerationRunProgress(
  runId: string,
  update: {
    status?: GenerationRunStatus
    currentStep?: string
    progressDetail?: string
    progressPct?: number
    itemsGenerated?: number
    itemsAfterUva?: number
    itemsAfterBoot?: number
    nmiInitial?: number
    nmiFinal?: number
    modelUsed?: string
    promptVersion?: number
    aiSnapshot?: Record<string, unknown>
    errorMessage?: string
    startedAt?: string
    completedAt?: string
    tokenUsage?: { inputTokens: number; outputTokens: number }
  },
): Promise<void> {
  await requireAdminScope()
  const db = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {}
  if (update.status !== undefined) patch.status = update.status
  if (update.currentStep !== undefined) patch.current_step = update.currentStep
  if (update.progressDetail !== undefined) patch.progress_detail = update.progressDetail
  if (update.progressPct !== undefined) patch.progress_pct = update.progressPct
  if (update.itemsGenerated !== undefined) patch.items_generated = update.itemsGenerated
  if (update.itemsAfterUva !== undefined) patch.items_after_uva = update.itemsAfterUva
  if (update.itemsAfterBoot !== undefined) patch.items_after_boot = update.itemsAfterBoot
  if (update.nmiInitial !== undefined) patch.nmi_initial = update.nmiInitial
  if (update.nmiFinal !== undefined) patch.nmi_final = update.nmiFinal
  if (update.modelUsed !== undefined) patch.model_used = update.modelUsed
  if (update.promptVersion !== undefined) patch.prompt_version = update.promptVersion
  if (update.aiSnapshot !== undefined) patch.ai_snapshot = update.aiSnapshot
  if (update.errorMessage !== undefined) patch.error_message = update.errorMessage
  if (update.startedAt !== undefined) patch.started_at = update.startedAt
  if (update.completedAt !== undefined) patch.completed_at = update.completedAt
  if (update.tokenUsage !== undefined) patch.token_usage = update.tokenUsage

  const { error } = await db.from('generation_runs').update(patch).eq('id', runId)
  if (error) throw new Error(error.message)

  revalidatePath('/generate')
}

/**
 * Start a generation run.
 *
 * Uses the real pipeline when OpenRouter_API_KEY is set; falls back to the
 * offline mock when the key is absent.
 */
export async function startGenerationRun(
  runId: string,
): Promise<{ success: boolean; error?: string }> {
  const scope = await requireAdminScope()
  try {
    const db = createAdminClient()

    // Fetch the run to get its config
    const { data: runData, error: fetchError } = await db
      .from('generation_runs')
      .select('*')
      .eq('id', runId)
      .single()

    if (fetchError || !runData) {
      return { success: false, error: fetchError?.message ?? 'Run not found' }
    }

    const run = mapGenerationRunRow(runData)
    const { config } = run

    if (!config.constructIds.length) {
      return { success: false, error: 'No constructs selected' }
    }

    // Fetch construct data for the run
    const constructs = await fetchConstructsForRun(config.constructIds, config.constructOverrides)
    const responseFormatDescription = await fetchResponseFormatDescription(config.responseFormatId)

    const onProgress: ProgressCallback = async (step, pct, details) => {
      await updateGenerationRunProgress(runId, {
        currentStep: step,
        progressPct: pct,
        ...(details?.itemsGenerated ? { itemsGenerated: details.itemsGenerated as number } : {}),
        ...(details?.progressDetail !== undefined ? { progressDetail: details.progressDetail as string } : {}),
      })
    }

    const useRealPipeline = Boolean(process.env.OpenRouter_API_KEY)

    await logAuditEvent({
      actorProfileId: scope.actor?.id ?? null,
      eventType: 'generation_run.started',
      targetTable: 'generation_runs',
      targetId: runId,
      metadata: {
        mode: useRealPipeline ? 'pipeline' : 'mock',
      },
    })

    if (useRealPipeline) {
      const { items: scoredItems, result: pipelineResult } = await runPipeline(
        config,
        constructs,
        onProgress,
        { responseFormatDescription },
      )

      // Bulk insert scored items
      const { error: insertError } = await db.from('generated_items').insert(
        scoredItems.map((item: ScoredCandidateItem) => ({
          generation_run_id: runId,
          construct_id:      item.constructId,
          stem:              item.stem,
          reverse_scored:    item.reverseScored,
          rationale:         item.rationale ?? null,
          embedding:         item.embedding,
          community_id:      item.communityId ?? item.finalCommunityId ?? item.initialCommunityId ?? null,
          initial_community_id: item.initialCommunityId ?? null,
          final_community_id: item.finalCommunityId ?? null,
          wto_max:           item.wtoMax ?? null,
          boot_stability:    item.bootStability ?? null,
          removal_stage:     item.removalStage ?? null,
          removal_sweep:     item.removalSweep ?? null,
          is_redundant:      item.isRedundant,
          is_unstable:       item.isUnstable,
          difficulty_tier:   item.difficultyTier ?? null,
          sd_risk:           item.sdRisk ?? null,
          facet:             item.facet ?? null,
          pipeline_metadata: {
            ...(item.critiqueVerdict ? {
              critiqueVerdict: item.critiqueVerdict,
              ...(item.critiqueReason ? { critiqueReason: item.critiqueReason } : {}),
              ...(item.critiqueOriginalStem ? { critiqueOriginalStem: item.critiqueOriginalStem } : {}),
            } : {}),
            ...(item.leakageScore !== undefined ? {
              leakageScore: item.leakageScore,
              ...(item.leakageTarget ? { leakageTarget: item.leakageTarget } : {}),
            } : {}),
            ...(item.difficultyEstimate !== undefined ? { difficultyEstimate: item.difficultyEstimate } : {}),
          },
        }))
      )
      if (insertError) throw new Error(`Failed to insert items: ${insertError.message}`)

      // Update run to reviewing
      await updateGenerationRunProgress(runId, {
        status:          'reviewing',
        progressPct:     100,
        nmiInitial:      pipelineResult.nmiInitial,
        nmiFinal:        pipelineResult.nmiFinal,
        itemsGenerated:  pipelineResult.itemsGenerated,
        itemsAfterUva:   pipelineResult.itemsAfterUva,
        itemsAfterBoot:  pipelineResult.itemsAfterBoot,
        modelUsed:       pipelineResult.modelUsed,
        promptVersion:   pipelineResult.aiSnapshot?.prompts?.[config.promptPurpose ?? 'item_generation']?.version,
        aiSnapshot:      pipelineResult.aiSnapshot,
        tokenUsage:      pipelineResult.tokenUsage,
      })
    } else {
      // Offline fallback — API key not configured
      await insertMockGeneratedItems(runId, config)
      await updateGenerationRunProgress(runId, {
        status: 'reviewing',
        progressPct: 100,
        nmiInitial: 0.71,
        nmiFinal: 0.89,
        itemsGenerated: config.targetItemsPerConstruct * config.constructIds.length,
        itemsAfterUva: Math.floor(config.targetItemsPerConstruct * config.constructIds.length * 0.75),
        itemsAfterBoot: Math.floor(config.targetItemsPerConstruct * config.constructIds.length * 0.65),
        aiSnapshot: {
          models: {
            item_generation: config.generationModel,
            embedding: config.embeddingModel,
          },
        },
      })
      return { success: true }
    }

    revalidatePath('/generate')
    return { success: true }
  } catch (err) {
    // Persist the error to the DB so the run shows as failed, not stuck
    const errorMessage = err instanceof Error ? err.message : 'Unknown error starting run'
    try {
      await updateGenerationRunProgress(runId, {
        status: 'failed' as GenerationRunStatus,
        errorMessage,
      })
      await logAuditEvent({
        actorProfileId: scope.actor?.id ?? null,
        eventType: 'generation_run.failed',
        targetTable: 'generation_runs',
        targetId: runId,
        metadata: { errorMessage },
      })
    } catch {
      // If we can't even update the status, we still return the error
    }
    return { success: false, error: errorMessage }
  }
}

/**
 * Accept selected generated items into the real items table.
 *
 * For each accepted itemId:
 *   1. Fetch the generated_item record
 *   2. Insert directly into the items table (mirrors createItem logic)
 *   3. Mark generated_items.is_accepted = true, saved_item_id = new item id
 *   4. Increment generation_runs.items_accepted
 */
export async function acceptGeneratedItems(
  runId: string,
  itemIds: string[],
): Promise<{ accepted: number }> {
  const scope = await requireAdminScope()
  const parsed = acceptItemsSchema.safeParse({ runId, itemIds })
  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join(', ') || 'Invalid input')
  }

  const db = createAdminClient()

  // Fetch the run to get responseFormatId from config
  const { data: runData, error: runError } = await db
    .from('generation_runs')
    .select('config, items_accepted')
    .eq('id', runId)
    .single()

  if (runError || !runData) {
    throw new Error(runError?.message ?? 'Run not found')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runConfig = runData.config as any
  const responseFormatId: string | undefined = runConfig?.responseFormatId

  // If no responseFormatId in config, we cannot accept items into the library
  if (!responseFormatId) {
    throw new Error(
      'Cannot accept items: no response format was selected in the generation config. ' +
        'Please edit the run config to include a response format.',
    )
  }

  // Fetch the target generated items
  const { data: generatedItems, error: itemsError } = await db
    .from('generated_items')
    .select('*')
    .in('id', itemIds)
    .eq('generation_run_id', runId)

  if (itemsError) throw new Error(itemsError.message)

  let acceptedCount = 0

  for (const row of generatedItems ?? []) {
    const item = mapGeneratedItemRow(row)

    // Determine next display_order for this construct
    const { count } = await db
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('construct_id', item.constructId)
      .is('deleted_at', null)
      .then((r) => ({ count: r.count ?? 0 }))

    // Insert into items table
    const { data: newItem, error: insertError } = await db
      .from('items')
      .insert({
        purpose: 'construct',
        construct_id: item.constructId,
        response_format_id: responseFormatId,
        stem: item.stem,
        reverse_scored: item.reverseScored,
        weight: 1.0,
        status: 'draft',
        display_order: count + 1,
        keyed_answer: null,
      })
      .select('id')
      .single()

    if (insertError || !newItem) {
      // Log and continue — don't abort the whole batch for one failure
      console.error(`Failed to accept item ${item.id}:`, insertError?.message)
      continue
    }

    // Mark generated item as accepted
    const { error: updateError } = await db
      .from('generated_items')
      .update({ is_accepted: true, saved_item_id: newItem.id })
      .eq('id', item.id)

    if (updateError) {
      console.error(`Failed to mark item ${item.id} as accepted:`, updateError.message)
    }

    acceptedCount++
  }

  // Update the accepted count on the run
  const previousAccepted = (runData.items_accepted as number | null) ?? 0
  await db
    .from('generation_runs')
    .update({ items_accepted: previousAccepted + acceptedCount })
    .eq('id', runId)

  revalidatePath('/generate')
  revalidatePath('/items')
  revalidatePath('/constructs')
  revalidatePath('/')

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'generation_run.items_accepted',
    targetTable: 'generation_runs',
    targetId: runId,
    metadata: {
      acceptedCount,
      requestedCount: itemIds.length,
    },
  })

  return { accepted: acceptedCount }
}

/** Delete a generation run and its generated items. */
export async function deleteGenerationRun(runId: string): Promise<void> {
  const scope = await requireAdminScope()
  // TODO: Migrate to soft-delete (add deleted_at column to generation_runs) per project conventions.
  // Currently performs hard-delete with CASCADE to generated_items.
  const db = createAdminClient()

  // Delete child rows first (no cascade assumed)
  await db.from('generated_items').delete().eq('generation_run_id', runId)
  const { error } = await db.from('generation_runs').delete().eq('id', runId)
  if (error) throw new Error(error.message)

  revalidatePath('/generate')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'generation_run.deleted',
    targetTable: 'generation_runs',
    targetId: runId,
  })
}

// ---------------------------------------------------------------------------
// Private helper — fetch construct data for a specific set of IDs
// ---------------------------------------------------------------------------

async function fetchConstructsForRun(
  constructIds: string[],
  constructOverrides?: Record<string, ConstructConfigOverride>,
): Promise<ConstructForGeneration[]> {
  const db = createAdminClient()

  const [constructsResult, itemsResult, factorLinksResult] = await Promise.all([
    db
      .from('constructs')
      .select('*')
      .in('id', constructIds)
      .is('deleted_at', null),
    db
      .from('items')
      .select('construct_id, stem')
      .in('construct_id', constructIds)
      .is('deleted_at', null)
      .eq('purpose', 'construct'),
    db
      .from('factor_constructs')
      .select('construct_id, factors!inner(name, definition, indicators_high)')
      .in('construct_id', constructIds),
  ])

  if (constructsResult.error) throw new Error(constructsResult.error.message)
  if (itemsResult.error) throw new Error(itemsResult.error.message)

  const existingItemsByConstruct = new Map<string, string[]>()
  for (const row of itemsResult.data ?? []) {
    const stems = existingItemsByConstruct.get(row.construct_id) ?? []
    stems.push(row.stem)
    existingItemsByConstruct.set(row.construct_id, stems)
  }

  // Build parent factor map from factor_constructs join
  const parentFactorsByConstruct = new Map<string, Array<{ name: string; definition?: string; indicatorsHigh?: string }>>()
  if (!factorLinksResult.error && factorLinksResult.data) {
    for (const row of factorLinksResult.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const factor = (row as any).factors as { name: string; definition?: string; indicators_high?: string } | null
      if (!factor) continue
      const existing = parentFactorsByConstruct.get(row.construct_id) ?? []
      existing.push({
        name: factor.name,
        definition: factor.definition ?? undefined,
        indicatorsHigh: factor.indicators_high ?? undefined,
      })
      parentFactorsByConstruct.set(row.construct_id, existing)
    }
  }

  return (constructsResult.data ?? []).map((row) => {
    const existingItems = existingItemsByConstruct.get(row.id) ?? []
    const override = constructOverrides?.[row.id]
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      definition: override && 'definition' in override ? override.definition : row.definition ?? undefined,
      description: override && 'description' in override ? override.description : row.description ?? undefined,
      indicatorsLow: override && 'indicatorsLow' in override ? override.indicatorsLow : row.indicators_low ?? undefined,
      indicatorsMid: override && 'indicatorsMid' in override ? override.indicatorsMid : row.indicators_mid ?? undefined,
      indicatorsHigh: override && 'indicatorsHigh' in override ? override.indicatorsHigh : row.indicators_high ?? undefined,
      existingItemCount: existingItems.length,
      existingItems,
      parentFactors: parentFactorsByConstruct.get(row.id),
    }
  })
}

async function fetchResponseFormatDescription(
  responseFormatId?: string,
): Promise<string | undefined> {
  if (!responseFormatId) return undefined

  const db = createAdminClient()
  const { data, error } = await db
    .from('response_formats')
    .select('*')
    .eq('id', responseFormatId)
    .single()

  if (error || !data) return undefined
  return describeResponseFormat(mapResponseFormatRow(data))
}

function describeResponseFormat(format: ResponseFormat): string {
  const config = format.config as Record<string, unknown>
  const points = typeof config.points === 'number' ? config.points : undefined
  const anchors = extractAnchors(config)

  if (format.type === 'likert') {
    const prefix = points
      ? `Use a ${points}-point Likert-style agreement scale.`
      : 'Use a Likert-style agreement scale.'
    return anchors.length > 0
      ? `${prefix} Anchors: ${anchors.map((anchor, index) => `${index + 1} = ${anchor}`).join('; ')}.`
      : `${prefix} Write items that can be answered cleanly on an ordered agreement/frequency scale.`
  }

  if (format.type === 'binary') {
    return anchors.length > 0
      ? `Use a binary response format with anchors: ${anchors.join(' vs ')}. Write items that permit a clear two-option judgement.`
      : 'Use a binary response format. Write items that permit a clear yes/no or either/or judgement.'
  }

  if (format.type === 'forced_choice') {
    const optionCount =
      typeof config.optionCount === 'number'
        ? config.optionCount
        : typeof config.options === 'number'
          ? config.options
          : undefined
    const optionText = optionCount ? ` with ${optionCount} options per item` : ''
    return `Use a forced-choice response format${optionText}. Write stems that create a meaningful trade-off instead of a simple agreement judgement.`
  }

  if (format.type === 'sjt') {
    return 'Use a situational judgement format. Write realistic, work-relevant scenario stems that can be evaluated against the configured options.'
  }

  return `Use the response format "${format.name}" (${format.type}). Write items that fit this response mode without needing reinterpretation by the respondent.`
}

function extractAnchors(config: Record<string, unknown>): string[] {
  const rawAnchors = config.anchors
  if (Array.isArray(rawAnchors)) {
    return rawAnchors.filter((anchor): anchor is string => typeof anchor === 'string')
  }
  if (typeof rawAnchors === 'object' && rawAnchors !== null) {
    return Object.entries(rawAnchors as Record<string, unknown>)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, label]) => label)
      .filter((label): label is string => typeof label === 'string')
  }
  return []
}

// ---------------------------------------------------------------------------
// Pre-flight check action
// ---------------------------------------------------------------------------

/** Run construct readiness pre-flight check for the given construct drafts. */
export async function checkConstructReadiness(
  constructs: ConstructDraftInput[],
  changes?: ConstructChange[],
) {
  await requireAdminScope()
  try {
    const { runConstructPreflight } = await import('@/lib/ai/generation')
    const result = await runConstructPreflight(constructs, changes)
    return { success: true as const, result }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Get constructs available for generation with their existing item counts. */
export async function getConstructsForGeneration(): Promise<
  Array<{
    id: string
    name: string
    slug: string
    dimensionId?: string
    dimensionName?: string
    definition?: string
    description?: string
    indicatorsLow?: string
    indicatorsMid?: string
    indicatorsHigh?: string
    existingItemCount: number
  }>
> {
  await requireAdminScope()
  const db = createAdminClient()

  const [constructsResult, itemCountResult] = await Promise.all([
    db
      .from('constructs')
      .select('*, factor_constructs(factors(dimensions(id, name)))')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    db
      .from('constructs')
      .select('id, items(count)')
      .is('deleted_at', null)
      .eq('is_active', true),
  ])

  if (constructsResult.error) throw new Error(constructsResult.error.message)
  if (itemCountResult.error) throw new Error(itemCountResult.error.message)

  const itemCountMap = new Map<string, number>()
  for (const row of itemCountResult.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    itemCountMap.set(r.id, r.items?.[0]?.count ?? 0)
  }

  return (constructsResult.data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any

    // Resolve the first linked dimension (through factor_constructs → factors → dimensions)
    let dimensionId: string | undefined
    let dimensionName: string | undefined
    const fcRows = r.factor_constructs ?? []
    for (const fc of fcRows) {
      const dim = fc.factors?.dimensions
      if (dim) {
        dimensionId = dim.id
        dimensionName = dim.name
        break
      }
    }

    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      dimensionId,
      dimensionName,
      definition: r.definition ?? undefined,
      description: r.description ?? undefined,
      indicatorsLow: r.indicators_low ?? undefined,
      indicatorsMid: r.indicators_mid ?? undefined,
      indicatorsHigh: r.indicators_high ?? undefined,
      existingItemCount: itemCountMap.get(r.id) ?? 0,
    }
  })
}

/** Mark a stuck run as failed so it stops showing as in-progress. */
export async function cancelGenerationRun(runId: string): Promise<{ success: boolean; error?: string }> {
  const scope = await requireAdminScope()
  try {
    await updateGenerationRunProgress(runId, {
      status: 'failed' as GenerationRunStatus,
      errorMessage: 'Cancelled by user — pipeline did not complete.',
    })
    revalidatePath('/generate')
    await logAuditEvent({
      actorProfileId: scope.actor?.id ?? null,
      eventType: 'generation_run.cancelled',
      targetTable: 'generation_runs',
      targetId: runId,
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Create a new generation run with the same config as an existing run. Returns the new run ID for the client to start via API route. */
export async function rerunGenerationRun(runId: string): Promise<{ success: boolean; newRunId?: string; error?: string }> {
  const scope = await requireAdminScope()
  try {
    const existingRun = await getGenerationRun(runId)
    if (!existingRun) return { success: false, error: 'Run not found' }

    const newRun = await createGenerationRun(existingRun.run.config)
    if (!newRun) return { success: false, error: 'Failed to create new run' }

    // Don't start the pipeline here — the client kicks it off via /api/generation/start
    // so that navigation doesn't abort the long-running pipeline
    await logAuditEvent({
      actorProfileId: scope.actor?.id ?? null,
      eventType: 'generation_run.rerun_requested',
      targetTable: 'generation_runs',
      targetId: runId,
      metadata: {
        newRunId: newRun.id,
      },
    })
    return { success: true, newRunId: newRun.id }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/** Export all generated items for a run as a CSV string. */
export async function exportRunItemsAsCSV(runId: string): Promise<{ success: boolean; csv?: string; error?: string }> {
  const scope = await requireAdminScope()
  try {
    const db = createAdminClient()

    const { data: items, error } = await db
      .from('generated_items')
      .select('stem, reverse_scored, construct_id, initial_community_id, final_community_id, wto_max, boot_stability, removal_stage, removal_sweep, is_redundant, is_unstable, is_accepted')
      .eq('generation_run_id', runId)
      .order('construct_id')

    if (error) return { success: false, error: error.message }
    if (!items?.length) return { success: false, error: 'No items found' }

    // Fetch construct names for the IDs
    const constructIds = [...new Set(items.map(i => i.construct_id))]
    const { data: constructs } = await db
      .from('constructs')
      .select('id, name')
      .in('id', constructIds)

    const constructNameMap = new Map((constructs ?? []).map(c => [c.id, c.name]))

    const header = 'stem,reverse_scored,construct_name,initial_community_id,final_community_id,wto_max,boot_stability,removal_stage,removal_sweep,is_redundant,is_unstable,status'
    const rows = items.map(item => {
      const constructName = constructNameMap.get(item.construct_id) ?? item.construct_id
      const status = item.is_accepted === true ? 'accepted'
        : item.is_accepted === false ? 'rejected'
        : item.is_redundant ? 'redundant'
        : item.is_unstable ? 'unstable'
        : 'suggested'
      return [
        JSON.stringify(item.stem),
        item.reverse_scored,
        JSON.stringify(constructName),
        item.initial_community_id ?? '',
        item.final_community_id ?? '',
        item.wto_max ?? '',
        item.boot_stability ?? '',
        item.removal_stage ?? '',
        item.removal_sweep ?? '',
        item.is_redundant,
        item.is_unstable,
        status,
      ].join(',')
    })

    await logAuditEvent({
      actorProfileId: scope.actor?.id ?? null,
      eventType: 'generation_run.exported',
      targetTable: 'generation_runs',
      targetId: runId,
      metadata: {
        rowCount: items.length,
        format: 'csv',
      },
    })

    return { success: true, csv: [header, ...rows].join('\n') }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/** Get active response formats for the generation wizard config step. */
export async function getResponseFormatsForGeneration(): Promise<
  Array<{
    id: string
    name: string
    type: string
  }>
> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('response_formats')
    .select('id, name, type')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, type: r.type }))
}

// ---------------------------------------------------------------------------
// Parent factor context for refinement suggestions
// ---------------------------------------------------------------------------

export async function fetchParentFactorsForConstruct(
  constructId: string,
): Promise<Array<{ name: string; definition?: string; indicatorsHigh?: string }>> {
  await requireAdminScope()
  const db = createAdminClient()

  const { data, error } = await db
    .from('factor_constructs')
    .select('factors!inner(name, definition, indicators_high)')
    .eq('construct_id', constructId)

  if (error || !data) return []

  return data.map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const factor = (row as any).factors as { name: string; definition?: string; indicators_high?: string }
    return {
      name: factor.name,
      definition: factor.definition ?? undefined,
      indicatorsHigh: factor.indicators_high ?? undefined,
    }
  })
}

// ---------------------------------------------------------------------------
// AI-assisted construct refinement
// ---------------------------------------------------------------------------

export async function suggestConstructRefinements(params: {
  constructId: string
  constructName: string
  currentDraft: ConstructDraftState
  overlappingPairs: Array<{
    otherConstructName: string
    cosineSimilarity: number
    overlapSummary?: string
    sharedSignals?: string[]
    uniqueSignalsForTarget?: string[]
    refinementGuidance?: string
  }>
  parentFactors: Array<{
    name: string
    definition?: string
    indicatorsHigh?: string
  }>
  allConstructs?: Array<{ name: string; definition?: string }>
  changes?: ConstructChange[]
}): Promise<
  | { success: true; analysis: string; suggestions: Array<{ field: string; original: string; suggested: string; reason: string }> }
  | { success: false; error: string }
> {
  await requireAdminScope()

  try {
    const { getModelForTask } = await import('@/lib/ai/model-config')
    const { openRouterProvider } = await import('@/lib/ai/providers/openrouter')
    const { buildRefinementPrompt, parseRefinementResponse } = await import(
      '@/lib/ai/generation/prompts/construct-refinement'
    )

    const taskConfig = await getModelForTask('preflight_analysis')

    const prompt = buildRefinementPrompt({
      constructName: params.constructName,
      currentDraft: params.currentDraft,
      overlappingPairs: params.overlappingPairs,
      parentFactors: params.parentFactors,
      allConstructs: params.allConstructs,
      changes: params.changes,
    })

    const response = await openRouterProvider.complete({
      model: taskConfig.modelId,
      systemPrompt:
        'You are an expert psychometrician specialising in construct definition and discriminant validity. Your task is to suggest targeted improvements to construct definitions to reduce overlap with neighbouring constructs while preserving meaning.',
      prompt,
      temperature: taskConfig.config.temperature,
      maxTokens: taskConfig.config.max_tokens,
      responseFormat: 'json',
    })

    const result = parseRefinementResponse(response.content)
    if (!result) {
      return { success: false, error: 'Could not parse refinement suggestions' }
    }

    return {
      success: true,
      analysis: result.analysis,
      suggestions: result.suggestions,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Refinement suggestion failed',
    }
  }
}

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------

export async function bulkDeleteGenerationRuns(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await requireAdminScope()
  const db = createAdminClient()
  // Delete child rows first, then parent (hard delete, no soft-delete column)
  const { error: itemsError } = await db
    .from('generated_items')
    .delete()
    .in('generation_run_id', ids)
  if (itemsError) throw new Error(itemsError.message)
  const { error } = await db
    .from('generation_runs')
    .delete()
    .in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/generate')
}
