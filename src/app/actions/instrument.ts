'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { slugify } from '@/lib/utils'
import {
  listBuilds,
  getBuild,
  createBuild,
  softDeleteBuild,
  listBlueprints,
  getBlueprintWithCells,
  createBlueprint,
  updateBlueprint,
  updateBuild,
  softDeleteBlueprint,
  restoreBlueprint,
  replaceBlueprintCells,
  appendEvidence,
  listCandidateItemsByBlueprint,
  listCandidateItemsForBuild,
  createCandidateItems,
  recordStageRun,
  claimStageRun,
  updateStageRun,
  updateCandidateItem,
  insertCongruenceRatings,
  deleteCongruenceRatingsForItems,
  listCongruenceRatingsForBuild,
  updateCandidateItemFairness,
  StageRunInFlightError,
} from '@/lib/dal/instrument'
import {
  instrumentBuildInputSchema,
  blueprintInputSchema,
  blueprintUpdateSchema,
  saveBlueprintCellsInputSchema,
  draftBlueprintWithAiOptionsSchema,
  generateItemsForBlueprintOptionsSchema,
  updateCandidateItemStatusSchema,
  publishBuildInputSchema,
} from '@/lib/validations/instrument'
import { validateBlueprint, facetCount, totalTargetItems } from '@/lib/instrument/blueprint'
import { forecastAlpha } from '@/lib/instrument/reliability'
import { isMeasureType, type MeasureType } from '@/lib/instrument/types'
import type { BlueprintCell } from '@/lib/instrument/types'
import type { MeasurementMode } from '@/types/database'
import {
  buildBlueprintDraftPrompt,
  draftToCells,
  parseBlueprintDraft,
  type BlueprintDraftInput,
  DEFAULT_BLUEPRINT_SYSTEM_PROMPT,
} from '@/lib/instrument/blueprint-draft'
import { getModelForTask } from '@/lib/ai/model-config'
import { getActiveSystemPrompt, AISystemPromptError } from '@/lib/ai/prompt-config'
import { openRouterProvider } from '@/lib/ai/providers/openrouter'
import type {
  InstrumentBuildDto,
  InstrumentBlueprintDto,
  InstrumentCandidateItemDto,
} from '@/lib/dal/instrument-mappers'
import {
  buildCellGenerationPrompt,
  parseGeneratedItems,
  dedupeAgainst,
  normaliseStem,
  DEFAULT_ITEM_GENERATION_SYSTEM_PROMPT,
} from '@/lib/instrument/item-generation'
import { auditCoverage } from '@/lib/instrument/blueprint'
import { mapWithConcurrency, chunk, DEFAULT_CONCURRENCY } from '@/lib/instrument/concurrency'
import {
  buildShuffledCongruencePrompt,
  parseCongruenceResponse,
  toCongruenceRatings,
  DEFAULT_CONGRUENCE_SYSTEM_PROMPT,
} from '@/lib/instrument/congruence-panel'
import { runCongruencePanel } from '@/lib/instrument/congruence'
import {
  fleschKincaidGrade,
  buildFairnessPrompt,
  parseFairnessResponse,
  READING_GRADE_CEILING_BY_AUDIENCE,
  DEFAULT_FAIRNESS_SYSTEM_PROMPT,
} from '@/lib/instrument/fairness'
import type { PanelResult } from '@/lib/instrument/congruence'
import {
  runRedundancyPass,
  clearRedundancyMarks,
  type RedundancyPassResult,
  DEFAULT_WTO_CUTOFF,
} from '@/lib/instrument/redundancy'
import {
  runCritiquePass,
  clearCritiqueMarks,
  type CritiqueBatchResult,
} from '@/lib/instrument/critique'

/**
 * List all instrument builds (newest first). Platform-admin only.
 */
export async function listInstrumentBuilds(): Promise<InstrumentBuildDto[]> {
  await requireAdminScope()
  const db = createAdminClient()
  return listBuilds(db)
}

/**
 * Get a single instrument build by id. Platform-admin only.
 */
export async function getInstrumentBuild(buildId: string): Promise<InstrumentBuildDto | null> {
  await requireAdminScope()
  const db = createAdminClient()
  return getBuild(db, buildId)
}

/**
 * Create an instrument build. Platform-admin only.
 */
export async function createInstrumentBuild(
  input: Record<string, unknown>,
): Promise<InstrumentBuildDto> {
  const scope = await requireAdminScope()

  const parsed = instrumentBuildInputSchema.safeParse(input)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(issues.join(', ') || 'Invalid instrument build input')
  }

  const db = createAdminClient()
  const result = await createBuild(db, {
    name: parsed.data.name,
    measureType: parsed.data.measureType,
    brief: parsed.data.brief ?? null,
    audience: parsed.data.audience ?? null,
    useContext: parsed.data.useContext ?? null,
    targetConstructCount: parsed.data.targetConstructCount ?? null,
    targetItemsPerConstruct: parsed.data.targetItemsPerConstruct ?? null,
    createdBy: scope.actor?.id ?? null,
  })

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_build.created',
    targetTable: 'instrument_builds',
    targetId: result.id,
    metadata: {
      name: parsed.data.name,
      measureType: parsed.data.measureType,
    },
  })

  return result
}

/**
 * Soft-delete an instrument build. Platform-admin only.
 */
export async function deleteInstrumentBuild(buildId: string): Promise<void> {
  const scope = await requireAdminScope()
  const db = createAdminClient()

  await softDeleteBuild(db, buildId)

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_build.deleted',
    targetTable: 'instrument_builds',
    targetId: buildId,
  })
}

/**
 * List blueprints for a build. Platform-admin only.
 */
export async function listBuildBlueprints(buildId: string): Promise<InstrumentBlueprintDto[]> {
  await requireAdminScope()
  const db = createAdminClient()
  return listBlueprints(db, buildId)
}

/**
 * Create a blueprint within a build. Platform-admin only.
 */
export async function createBlueprintAction(
  buildId: string,
  input: Record<string, unknown>,
): Promise<InstrumentBlueprintDto> {
  const scope = await requireAdminScope()

  const parsed = blueprintInputSchema.safeParse(input)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(issues.join(', ') || 'Invalid blueprint input')
  }

  // Validate: either constructId OR draftConstructName must be provided
  if (!parsed.data.constructId && !parsed.data.draftConstructName) {
    throw new Error('Either constructId or draftConstructName is required')
  }

  const db = createAdminClient()
  const blueprint = await getBuild(db, buildId)
  if (!blueprint) {
    throw new Error('Build not found')
  }

  const result = await createBlueprint(db, {
    buildId,
    constructId: parsed.data.constructId,
    draftConstructName: parsed.data.draftConstructName,
    draftConstructDefinition: parsed.data.draftConstructDefinition,
    measureType: blueprint.measureType,
    targetAlpha: parsed.data.targetAlpha,
    exclusions: parsed.data.exclusions,
    notes: parsed.data.notes,
  })

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_blueprint.created',
    targetTable: 'instrument_blueprints',
    targetId: result.id,
    metadata: {
      buildId,
      constructId: parsed.data.constructId,
    },
  })

  return result
}

/**
 * Update a blueprint. Platform-admin only.
 */
export async function updateBlueprintAction(
  blueprintId: string,
  input: Record<string, unknown>,
): Promise<InstrumentBlueprintDto> {
  const scope = await requireAdminScope()

  const parsed = blueprintUpdateSchema.safeParse(input)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(issues.join(', ') || 'Invalid blueprint update')
  }

  const db = createAdminClient()
  const result = await updateBlueprint(db, blueprintId, {
    targetAlpha: parsed.data.targetAlpha,
    exclusions: parsed.data.exclusions,
    notes: parsed.data.notes,
  })

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_blueprint.updated',
    targetTable: 'instrument_blueprints',
    targetId: result.id,
  })

  return result
}

/**
 * Soft-delete a blueprint. Platform-admin only.
 */
export async function deleteBlueprintAction(blueprintId: string): Promise<void> {
  const scope = await requireAdminScope()
  const db = createAdminClient()

  await softDeleteBlueprint(db, blueprintId)

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_blueprint.deleted',
    targetTable: 'instrument_blueprints',
    targetId: blueprintId,
  })
}

/**
 * Save blueprint cells, replacing all existing cells. Platform-admin only.
 */
export async function saveBlueprintCells(
  blueprintId: string,
  input: Record<string, unknown>,
): Promise<{
  cells: Array<{
    id: string
    facetLabel: string
    intensity: string
    targetItemCount: number
    displayOrder: number
  }>
  validation: {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
}> {
  const scope = await requireAdminScope()

  const parsed = saveBlueprintCellsInputSchema.safeParse(input)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(issues.join(', ') || 'Invalid cells input')
  }

  // Add IDs to cells for validation (they will be generated by the DB)
  const cellsWithIds = parsed.data.cells.map((cell, idx) => ({
    ...cell,
    id: `temp-${idx}`,
  }))

  // Validate blueprint structure
  const validation = validateBlueprint(cellsWithIds)

  if (!validation.valid) {
    throw new Error(`Blueprint validation failed: ${validation.errors.join('; ')}`)
  }

  const db = createAdminClient()
  const cells = await replaceBlueprintCells(db, blueprintId, parsed.data.cells)

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_blueprint.cells_saved',
    targetTable: 'instrument_blueprint_cells',
    targetId: blueprintId,
    metadata: {
      cellCount: cells.length,
    },
  })

  return {
    cells: cells.map((cell) => ({
      id: cell.id,
      facetLabel: cell.facetLabel,
      intensity: cell.intensity,
      targetItemCount: cell.targetItemCount,
      displayOrder: cell.displayOrder,
    })),
    validation,
  }
}

/**
 * Draft a blueprint using AI. Platform-admin only.
 */
export async function draftBlueprintWithAI(
  blueprintId: string,
  options?: Record<string, unknown>,
): Promise<{
  cells: Array<{
    id: string
    facetLabel: string
    intensity: string
    targetItemCount: number
    displayOrder: number
  }>
  warnings: string[]
}> {
  const scope = await requireAdminScope()

  const parsedOptions = draftBlueprintWithAiOptionsSchema.safeParse(options ?? {})
  if (!parsedOptions.success) {
    throw new Error('Invalid blueprint draft options')
  }

  const db = createAdminClient()

  // Fetch blueprint with cells
  const blueprintData = await getBlueprintWithCells(db, blueprintId)
  if (!blueprintData) {
    throw new Error('Blueprint not found')
  }

  const { blueprint } = blueprintData

  // Build the AI request
  const draftRequest: BlueprintDraftInput = {
    constructName: blueprint.draftConstructName || 'Unknown Construct',
    constructDefinition: blueprint.draftConstructDefinition || 'No definition provided',
    measureType: (isMeasureType(blueprint.measureType)
      ? blueprint.measureType
      : 'competency_behavioural'),
    targetItemCount: 15, // Default target item count
    targetAlpha: blueprint.targetAlpha ?? undefined,
    exclusions: blueprint.exclusions ?? undefined,
  }

  // Build prompt and call AI
  const prompt = buildBlueprintDraftPrompt(draftRequest)

  let modelId: string
  if (parsedOptions.data.modelId) {
    modelId = parsedOptions.data.modelId
  } else {
    // Get default model for blueprint drafting
    const taskConfig = await getModelForTask('instrument_blueprint')
    modelId = taskConfig.modelId
  }

  // Get system prompt (DB-backed, with hardcoded fallback)
  let systemPrompt = DEFAULT_BLUEPRINT_SYSTEM_PROMPT
  try {
    const promptConfig = await getActiveSystemPrompt('instrument_blueprint')
    systemPrompt = promptConfig.content
  } catch (err) {
    // If no DB-backed prompt exists, use hardcoded default
    if (!(err instanceof AISystemPromptError)) {
      throw err
    }
  }

  const response = await openRouterProvider.complete({
    model: modelId,
    prompt,
    systemPrompt,
    temperature: parsedOptions.data.temperature,
    maxTokens: parsedOptions.data.maxTokens,
    responseFormat: 'json',
  })

  // Parse response using forgiving parser
  const draftResult = parseBlueprintDraft(response.content)
  const warnings = [...draftResult.warnings]

  // Convert to cells
  const cells = draftToCells(draftResult, blueprintId)

  // Validate the resulting blueprint
  const blueprintValidation = validateBlueprint(cells)
  if (!blueprintValidation.valid) {
    warnings.push(`Blueprint validation issues: ${blueprintValidation.errors.join('; ')}`)
  }
  warnings.push(...blueprintValidation.warnings)

  // Save cells to database
  const savedCells = await replaceBlueprintCells(db, blueprintId, cells)

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_blueprint.drafted_with_ai',
    targetTable: 'instrument_blueprint_cells',
    targetId: blueprintId,
    metadata: {
      cellCount: savedCells.length,
      model: modelId,
      temperature: parsedOptions.data.temperature,
    },
  })

  return {
    cells: savedCells.map((cell) => ({
      id: cell.id,
      facetLabel: cell.facetLabel,
      intensity: cell.intensity,
      targetItemCount: cell.targetItemCount,
      displayOrder: cell.displayOrder,
    })),
    warnings,
  }
}

/**
 * Record an alpha forecast for a blueprint. Platform-admin only.
 */
export async function recordAlphaForecast(blueprintId: string): Promise<{
  predictedAlpha: number
  interval: [number, number]
  meanInterItemR: number
  meanInterItemRInterval: [number, number]
  coherence: string
  basis: string
  warnings: Array<{ level: string; message: string }>
}> {
  const scope = await requireAdminScope()
  const db = createAdminClient()

  // Fetch blueprint with cells
  const blueprintData = await getBlueprintWithCells(db, blueprintId)
  if (!blueprintData) {
    throw new Error('Blueprint not found')
  }

  const { blueprint, cells } = blueprintData

  // Compute forecast
  const itemCount = totalTargetItems(cells)
  const facetCountValue = facetCount(cells)

  const forecast = forecastAlpha({
    itemCount,
    facetCount: facetCountValue,
  })

  // Record the forecast itself. `value` and `interval` are the point of the
  // record — an entry without them tells you nothing later. sampleSize stays
  // undefined because no respondent has answered anything: that absence is what
  // marks this as a-priori evidence rather than an observation.
  await appendEvidence(db, blueprint.buildId, [
    {
      targetType: 'construct',
      targetId: blueprintId,
      claim: 'alpha',
      value: forecast.predictedAlpha,
      interval: forecast.interval,
      evidenceClass: 'a_priori',
      method: 'forecast_v1',
      sampleSize: undefined,
      producedAt: new Date(),
      supersededAt: null,
    },
  ])

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_blueprint.alpha_forecast_recorded',
    targetTable: 'instrument_evidence',
    targetId: blueprintId,
    metadata: {
      predictedAlpha: forecast.predictedAlpha.toFixed(3),
      itemCount,
      facetCount: facetCountValue,
    },
  })

  return {
    predictedAlpha: forecast.predictedAlpha,
    interval: forecast.interval,
    meanInterItemR: forecast.meanInterItemR,
    meanInterItemRInterval: forecast.meanInterItemRInterval,
    coherence: forecast.coherence,
    basis: forecast.basis,
    warnings: forecast.warnings,
  }
}

/**
 * Get the current alpha forecast for a blueprint (read-only, does not persist).
 * Platform-admin only.
 */
export async function getBlueprintForecast(blueprintId: string): Promise<{
  predictedAlpha: number
  interval: [number, number]
  meanInterItemR: number
  meanInterItemRInterval: [number, number]
  coherence: string
  basis: string
  warnings: Array<{ level: string; message: string }>
}> {
  await requireAdminScope()
  const db = createAdminClient()

  // Fetch blueprint with cells
  const blueprintData = await getBlueprintWithCells(db, blueprintId)
  if (!blueprintData) {
    throw new Error('Blueprint not found')
  }

  const { cells } = blueprintData

  // Compute forecast (no persistence)
  const itemCount = totalTargetItems(cells)
  const facetCountValue = facetCount(cells)

  const forecast = forecastAlpha({
    itemCount,
    facetCount: facetCountValue,
  })

  return {
    predictedAlpha: forecast.predictedAlpha,
    interval: forecast.interval,
    meanInterItemR: forecast.meanInterItemR,
    meanInterItemRInterval: forecast.meanInterItemRInterval,
    coherence: forecast.coherence,
    basis: forecast.basis,
    warnings: forecast.warnings,
  }
}

/**
 * Fetch a blueprint together with its grid cells, for the blueprint editor.
 * Platform-admin only.
 */
export async function getBlueprintDetail(blueprintId: string): Promise<{
  blueprint: InstrumentBlueprintDto
  cells: BlueprintCell[]
} | null> {
  await requireAdminScope()
  const db = createAdminClient()
  return getBlueprintWithCells(db, blueprintId)
}

/**
 * Generate items per blueprint cell, filling coverage gaps. Platform-admin only.
 *
 * For each cell with a deficit (actual < target), generates exactly the shortfall
 * via LLM, steered by facet definition and intensity. Handles per-cell provider
 * failures gracefully, recording them in warnings. Deduplicates against all
 * previously-seen stems in the blueprint and this run. Records a single stage run
 * with totalled token usage.
 */
export async function generateItemsForBlueprint(
  blueprintId: string,
  options?: Record<string, unknown>,
): Promise<{
  generated: number
  byCell: Array<{
    cellId: string
    facetLabel: string
    intensity: string
    requested: number
    generated: number
    duplicates: number
    warnings: string[]
  }>
  coverage: Record<string, unknown>
}> {
  const scope = await requireAdminScope()

  const parsedOptions = generateItemsForBlueprintOptionsSchema.safeParse(options ?? {})
  if (!parsedOptions.success) {
    throw new Error('Invalid generation options')
  }

  const db = createAdminClient()

  // Fetch blueprint with cells
  const blueprintData = await getBlueprintWithCells(db, blueprintId)
  if (!blueprintData) {
    throw new Error('Blueprint not found')
  }

  const { blueprint, cells } = blueprintData

  // Load existing candidate items for coverage audit
  const existingItems = await listCandidateItemsByBlueprint(db, blueprintId)

  // Compute initial coverage
  const coverage = auditCoverage(cells, existingItems)

  // Determine which cells need generation (filter by cellIds option if provided)
  const cellsToGenerate = cells.filter((cell) => {
    // Parenthesised deliberately: `?? 0 > 0` parses as `deficit ?? (0 > 0)`,
    // which yields the deficit number rather than a boolean.
    const hasDeficit = (coverage.cells.find((c) => c.cellId === cell.id)?.deficit ?? 0) > 0
    if (parsedOptions.data.cellIds && parsedOptions.data.cellIds.length > 0) {
      return parsedOptions.data.cellIds.includes(cell.id) && hasDeficit
    }
    return hasDeficit
  })

  // Resolve model and system prompt for item generation
  let modelId: string
  if (parsedOptions.data.modelId) {
    modelId = parsedOptions.data.modelId
  } else {
    const taskConfig = await getModelForTask('instrument_items')
    modelId = taskConfig.modelId
  }

  // Get system prompt (DB-backed, with hardcoded fallback)
  let itemGenerationSystemPrompt = DEFAULT_ITEM_GENERATION_SYSTEM_PROMPT
  try {
    const promptConfig = await getActiveSystemPrompt('instrument_items')
    itemGenerationSystemPrompt = promptConfig.content
  } catch (err) {
    // If no DB-backed prompt exists, use hardcoded default
    if (!(err instanceof AISystemPromptError)) {
      throw err
    }
  }

  // Seed with existing stems for deduplication
  const seenStems = new Set<string>()
  for (const item of existingItems) {
    seenStems.add(normaliseStem(item.stem))
  }

  // Track generation stats
  const cellReports: Array<{
    cellId: string
    facetLabel: string
    intensity: string
    requested: number
    generated: number
    duplicates: number
    warnings: string[]
  }> = []
  let totalGenerated = 0
  let totalTokensInput = 0
  let totalTokensOutput = 0
  let failedCells = 0

  const startedAt = new Date().toISOString()

  // Concurrency guard. Generation is slow (one provider call per cell), so a
  // second invocation can easily start while the first is still running — both
  // would compute the same deficits and each fill them, double-filling every
  // cell. The claim is atomic: it relies on a partial unique index rather than
  // a read-then-insert, which has a window where two callers both see no run.
  const stageRun = await claimStageRun(db, {
    buildId: blueprint.buildId,
    stageKey: 'item_generation',
    startedAt,
    detail: `Generating for ${cellsToGenerate.length} cells`,
  })

  // Generate per cell
  for (const cell of cellsToGenerate) {
    const deficit = coverage.cells.find((c) => c.cellId === cell.id)?.deficit ?? 0
    if (deficit === 0) {
      continue
    }

    const cellReport = {
      cellId: cell.id,
      facetLabel: cell.facetLabel,
      intensity: cell.intensity,
      requested: deficit,
      generated: 0,
      duplicates: 0,
      warnings: [] as string[],
    }

    try {
      // Build sibling facets for contrast
      const siblingFacets = [
        ...new Set(
          cells
            .filter((c) => c.facetLabel !== cell.facetLabel)
            .map((c) => c.facetLabel),
        ),
      ].map((facetLabel) => ({ facetLabel }))

      // Get blueprint exclusions
      const exclusions = blueprint.exclusions ?? []

      // Build prompt. siblingFacets carries the intra-construct contrast: items
      // must be distinguishable from the blueprint's OTHER facets, not just from
      // other constructs — otherwise the blueprint is decorative.
      const prompt = buildCellGenerationPrompt({
        constructName:
          blueprint.draftConstructName || blueprint.constructId || 'Unnamed construct',
        constructDefinition: blueprint.draftConstructDefinition ?? undefined,
        measureType: isMeasureType(blueprint.measureType)
          ? blueprint.measureType
          : 'competency_behavioural',
        facetLabel: cell.facetLabel,
        intensity: cell.intensity,
        count: deficit,
        existingStems: [...seenStems],
        siblingFacets,
        exclusions,
      })

      // Call provider
      const response = await openRouterProvider.complete({
        model: modelId,
        prompt,
        systemPrompt: itemGenerationSystemPrompt,
        temperature: parsedOptions.data.temperature,
        maxTokens: parsedOptions.data.maxTokens,
        responseFormat: undefined,
      })

      // Track tokens
      totalTokensInput += response.usage?.inputTokens ?? 0
      totalTokensOutput += response.usage?.outputTokens ?? 0

      // Parse response. The parser never throws; malformed entries surface as
      // warnings so a partially-bad batch still yields its good items.
      const parsed = parseGeneratedItems(response.content)
      cellReport.warnings.push(...parsed.warnings)

      if (parsed.items.length === 0) {
        cellReport.warnings.push('No valid items parsed from provider response')
      } else {
        // Dedupe against every stem seen so far — existing items AND items
        // generated by earlier cells in this same run.
        const { kept, duplicates } = dedupeAgainst(parsed.items, [...seenStems])
        cellReport.duplicates = duplicates.length
        cellReport.generated = kept.length

        if (kept.length > 0) {
          await createCandidateItems(
            db,
            blueprint.buildId,
            kept.map((item) => ({
              blueprintCellId: cell.id,
              stem: item.stem,
              facet: cell.facetLabel,
              reverseScored: item.reverseScored,
              rationale: item.rationale ?? null,
              difficultyTier: cell.intensity,
              sdRisk: item.sdRisk ?? null,
            })),
          )

          for (const item of kept) {
            seenStems.add(normaliseStem(item.stem))
          }
          totalGenerated += kept.length
        }
      }
    } catch (error) {
      // A provider failure on one cell must not abort the run. Record it against
      // the cell and continue; overall run status is decided after the loop.
      failedCells += 1
      cellReport.warnings.push(
        error instanceof Error ? error.message : 'Generation failed',
      )
    }

    cellReports.push(cellReport)
  }

  const completedAt = new Date().toISOString()

  // The run is a failure only when nothing was produced AND the provider was the
  // reason. Partial success — some cells failed but items exist — is a success
  // with a recorded warning, matching the item_generation stage semantics.
  const runStatus: 'success' | 'failure' =
    totalGenerated === 0 && failedCells > 0 ? 'failure' : 'success'
  const runErrorMessage =
    failedCells > 0
      ? `${failedCells} of ${cellReports.length} cells failed to generate`
      : null

  // Close out the `running` row claimed above rather than inserting a second
  // one — otherwise the guard would see a stale in-flight run forever.
  await updateStageRun(db, stageRun.id, {
    status: runStatus,
    completedAt,
    progressPct: cellReports.length > 0 ? 100 : 0,
    detail: `Generated ${totalGenerated} items across ${cellReports.length} cells${
      failedCells > 0 ? ` (${failedCells} failed)` : ''
    }`,
    tokenUsage: {
      inputTokens: totalTokensInput,
      outputTokens: totalTokensOutput,
    },
    errorMessage: runErrorMessage,
    outputSnapshot: {
      cellCount: cellReports.length,
      generatedTotal: totalGenerated,
      duplicatesTotal: cellReports.reduce((sum, r) => sum + r.duplicates, 0),
    },
  })

  // Re-audit coverage
  const updatedItems = await listCandidateItemsByBlueprint(db, blueprintId)
  const finalCoverage = auditCoverage(cells, updatedItems)

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_items.generated',
    targetTable: 'instrument_candidate_items',
    targetId: blueprintId,
    metadata: {
      cellCount: cellReports.length,
      generatedTotal: totalGenerated,
      model: modelId,
    },
  })

  return {
    generated: totalGenerated,
    byCell: cellReports,
    coverage: {
      cells: finalCoverage.cells,
      totalTarget: finalCoverage.totalTarget,
      totalActual: finalCoverage.totalActual,
      isComplete: finalCoverage.isComplete,
      emptyCells: finalCoverage.emptyCells,
      underfilledCells: finalCoverage.underfilledCells,
    },
  }
}

/**
 * List all candidate items for a blueprint. Platform-admin only.
 */
export async function listBlueprintCandidateItems(
  blueprintId: string,
): Promise<InstrumentCandidateItemDto[]> {
  await requireAdminScope()
  const db = createAdminClient()

  // Return the full DTO: the review surface groups items by blueprintCellId,
  // so a narrowed projection that drops it would make the coverage view
  // impossible to build.
  return listCandidateItemsByBlueprint(db, blueprintId)
}

/**
 * List cells for a blueprint.
 */
export async function listBlueprintCells(blueprintId: string) {
  await requireAdminScope()
  const db = createAdminClient()

  const result = await getBlueprintWithCells(db, blueprintId)
  return result?.cells ?? []
}

/**
 * Update a candidate item's status. Platform-admin only.
 */
export async function updateCandidateItemStatus(
  itemId: string,
  input: Record<string, unknown>,
): Promise<{ id: string; status: string }> {
  const scope = await requireAdminScope()

  const parsed = updateCandidateItemStatusSchema.safeParse(input)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(issues.join(', ') || 'Invalid status update')
  }

  const db = createAdminClient()
  const result = await updateCandidateItem(db, itemId, {
    status: parsed.data.status,
  })

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_item.status_updated',
    targetTable: 'instrument_candidate_items',
    targetId: itemId,
    metadata: {
      status: parsed.data.status,
    },
  })

  return {
    id: result.id,
    status: result.status,
  }
}

/**
 * Run congruence panel: blind multi-rater content-validity sort. Platform-admin only.
 *
 * Requires at least 2 blueprints (constructs). Each item gets rated by 3 raters
 * (configurable) using different models where available. Aggregates ratings into
 * a PanelResult and records evidence + stage run.
 */
export async function runCongruencePanelForBuild(
  buildId: string,
  options?: Record<string, unknown>,
): Promise<{
  itemsRated: number
  ratingsRecorded: number
  failedItems: number
  panel: PanelResult
  warnings: string[]
}> {
  const scope = await requireAdminScope()
  const db = createAdminClient()

  // Load build
  const build = await getBuild(db, buildId)
  if (!build) {
    throw new Error('Build not found')
  }

  // Load all blueprints (constructs to present to raters)
  const blueprintDtos = await listBlueprints(db, buildId)
  if (blueprintDtos.length < 2) {
    throw new Error(
      'Congruence panel requires at least 2 constructs to discriminate between; with fewer the test is vacuous.',
    )
  }

  // Load blueprints with cells to map items to intended constructs
  const blueprintsWithCells: Array<{
    blueprint: InstrumentBlueprintDto
    cells: BlueprintCell[]
  }> = []
  for (const bp of blueprintDtos) {
    const data = await getBlueprintWithCells(db, bp.id)
    if (data) {
      blueprintsWithCells.push(data)
    }
  }

  // Load all candidate items for the build
  const items = await listCandidateItemsForBuild(db, buildId)
  const itemsToRate = items.filter((i) => i.status !== 'rejected')

  if (itemsToRate.length === 0) {
    throw new Error('No candidate items to rate')
  }

  // Parse options
  const raterCount = typeof options === 'object' && options !== null && 'raterCount' in options
    ? Math.max(2, Math.min(5, Number(options.raterCount) || 3))
    : 3

  const allWarnings: string[] = []
  const allRatings: Array<{
    candidateItemId: string
    raterIndex: number
    raterModel: string
    assignedBlueprintId: string | null
    intendedBlueprintId: string
    relevance: number
    namedFacet?: string | null
    rationale?: string | null
  }> = []

  let failedItems = 0
  const startedAt = new Date().toISOString()

  // Rate items with bounded concurrency. Items are independent, so wall clock
  // scales with the ceiling rather than the item count — the difference between
  // finishing and hitting a request timeout at the 100-item target.
  await mapWithConcurrency(itemsToRate, DEFAULT_CONCURRENCY, async (item) => {
    // Determine intended construct from the item's blueprint cell
    const intendedBlueprintData = item.blueprintCellId
      ? blueprintsWithCells.find((bpData) =>
        bpData.cells.some((c) => c.id === item.blueprintCellId),
      )
      : null

    if (!intendedBlueprintData) {
      allWarnings.push(
        `Item ${item.id}: no blueprint found; skipping congruence rating.`,
      )
      failedItems++
      return
    }

    const intendedBlueprint = intendedBlueprintData.blueprint

    try {
      // Fetch system prompt from DB with fallback
      let systemPrompt = DEFAULT_CONGRUENCE_SYSTEM_PROMPT
      try {
        const promptConfig = await getActiveSystemPrompt('instrument_congruence')
        systemPrompt = promptConfig.content
      } catch {
        // Fallback to default if DB fetch fails
      }

      // Get models (prefer variety)
      const models = typeof options === 'object' && options !== null && 'models' in options && Array.isArray(options.models)
        ? options.models.filter((m): m is string => typeof m === 'string')
        : []

      if (models.length === 0) {
        const taskConfig = await getModelForTask('instrument_congruence')
        // Prefer a configured list of DIFFERENT model families over one model
        // used three times. Same-model raters are not independent: repeated
        // sampling from one model agrees at r ~= 0.88-0.92 versus r ~= 0.75-0.85
        // across families, so a single-model panel reports an agreement figure
        // that is partly just the model agreeing with itself.
        const configured = (taskConfig.config as { models?: unknown } | null)?.models
        const configuredModels = Array.isArray(configured)
          ? configured.filter((m): m is string => typeof m === 'string')
          : []
        models.push(...(configuredModels.length > 0 ? configuredModels : [taskConfig.modelId]))
      }

      // Prepare candidate list (without shuffling yet; each rater gets its own shuffle)
      const candidateList = blueprintDtos.map((bp) => ({
        id: bp.id,
        name: bp.draftConstructName || bp.constructId || 'Unnamed',
        definition: bp.draftConstructDefinition || undefined,
      }))

      // Rate with multiple raters
      const raterResults: Array<{
        raterIndex: number
        raterModel: string
        parsed: Awaited<ReturnType<typeof parseCongruenceResponse>>
      }> = []

      // Raters are independent — run them concurrently. Sequentially this is
      // O(items x raters) round trips, which blows any request timeout well
      // before the 100-item target.
      const raterOutcomes = await mapWithConcurrency(
        Array.from({ length: raterCount }, (_, i) => i),
        raterCount,
        async (raterIndex) => {
          // Build shuffled prompt for this rater (deterministic shuffle per rater)
          const { prompt: raterPrompt } = buildShuffledCongruencePrompt(
            buildId,
            item.id,
            raterIndex,
            {
              stem: item.stem,
              candidates: candidateList,
              measureType: isMeasureType(build.measureType) ? build.measureType : undefined,
            },
          )

          const model = models[raterIndex % models.length]
          const response = await openRouterProvider.complete({
            model,
            prompt: raterPrompt,
            systemPrompt,
            temperature: 0.5,
            maxTokens: 500,
            responseFormat: 'json',
          })
          return {
            raterIndex,
            raterModel: model,
            parsed: parseCongruenceResponse(
              response.content,
              blueprintDtos.map((b) => b.id),
            ),
          }
        },
      )

      for (const outcome of raterOutcomes) {
        if (outcome.ok) {
          raterResults.push(outcome.value)
        } else {
          allWarnings.push(
            `Item ${item.id}: ${outcome.error instanceof Error ? outcome.error.message : 'provider call failed'}`,
          )
        }
      }

      // Convert to ratings
      if (raterResults.length > 0) {
        const { ratings, warnings: conversionWarnings } = toCongruenceRatings(
          item.id,
          intendedBlueprint.id,
          raterResults,
        )
        allWarnings.push(...conversionWarnings)

        if (ratings.length > 0) {
          allRatings.push(
            ...ratings.map((r) => ({
              candidateItemId: r.itemId,
              raterIndex: r.raterIndex,
              raterModel: r.raterModel,
              assignedBlueprintId: r.assignedConstructId,
              intendedBlueprintId: r.intendedConstructId,
              relevance: r.relevance,
              ...(r.namedFacet && { namedFacet: r.namedFacet }),
            })),
          )
        }
      } else {
        failedItems++
      }
    } catch (error) {
      failedItems++
      allWarnings.push(
        `Item ${item.id}: ${error instanceof Error ? error.message : 'congruence rating failed'}`,
      )
    }
  })

  // A rerun replaces its previous ratings rather than appending to them —
  // otherwise two runs' ratings are pooled, inflating rater counts and skewing
  // every downstream statistic.
  await deleteCongruenceRatingsForItems(
    db,
    itemsToRate.map((i) => i.id),
  )

  // Persist in chunks rather than one all-or-nothing insert at the end: a
  // timeout or navigation part-way through must not discard every provider
  // call made so far.
  let ratingsRecorded = 0
  for (const batch of chunk(allRatings, 100)) {
    ratingsRecorded += await insertCongruenceRatings(db, batch)
  }

  // Aggregate with runCongruencePanel
  const panel = runCongruencePanel(
    allRatings.map((r) => ({
      itemId: r.candidateItemId,
      raterIndex: r.raterIndex,
      raterModel: r.raterModel,
      assignedConstructId: r.assignedBlueprintId!,
      intendedConstructId: r.intendedBlueprintId,
      relevance: r.relevance as 1 | 2 | 3 | 4,
      ...(r.namedFacet && { namedFacet: r.namedFacet }),
    })),
  )

  // Record evidence (per-item + panel-level)
  type EvidenceInput = Parameters<typeof appendEvidence>[2][number]
  const evidenceRecords: EvidenceInput[] = []

  // Per-item assignment accuracy
  for (const itemResult of panel.items) {
    evidenceRecords.push({
      targetType: 'item',
      targetId: itemResult.itemId,
      claim: 'assignment_accuracy',
      value: itemResult.assignmentAccuracy,
      evidenceClass: 'a_priori',
      method: 'congruence_panel_v1',
      sampleSize: undefined,
      producedAt: new Date(),
      supersededAt: null,
    })
  }

  // Panel-level Fleiss' kappa
  evidenceRecords.push({
    targetType: 'instrument',
    targetId: buildId,
    claim: 'fleiss_kappa',
    value: panel.fleissKappa,
    evidenceClass: 'a_priori',
    method: 'congruence_panel_v1',
    sampleSize: undefined,
    producedAt: new Date(),
    supersededAt: null,
  })

  await appendEvidence(db, buildId, evidenceRecords)

  // Record stage run
  const completedAt = new Date().toISOString()
  await recordStageRun(db, {
    buildId,
    stageKey: 'congruence_panel',
    status: failedItems > 0 && ratingsRecorded === 0 ? 'failure' : 'success',
    startedAt,
    completedAt,
    progressPct: 100,
    detail: `Rated ${panel.items.length} items; ${ratingsRecorded} ratings recorded${
      failedItems > 0 ? `; ${failedItems} items failed` : ''
    }`,
    outputSnapshot: {
      itemsRated: panel.items.length,
      ratingsRecorded,
      fleissKappa: panel.fleissKappa,
      passRate: panel.overall.passRate,
    },
  })

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_build.congruence_panel_run',
    targetTable: 'instrument_congruence_ratings',
    targetId: buildId,
    metadata: {
      itemsRated: panel.items.length,
      ratingsRecorded,
      fleissKappa: panel.fleissKappa.toFixed(3),
    },
  })

  return {
    itemsRated: panel.items.length,
    ratingsRecorded,
    failedItems,
    panel,
    warnings: allWarnings,
  }
}

/**
 * Run fairness screen: Flesch-Kincaid readability + LLM fairness check. Platform-admin only.
 *
 * Computes reading grade for every item locally, batches LLM fairness checks
 * in chunks of 25, persists results via updateCandidateItemFairness.
 */
export async function runFairnessScreenForBuild(buildId: string): Promise<{
  itemsScreened: number
  flagged: number
  overCeiling: number
  warnings: string[]
}> {
  const scope = await requireAdminScope()
  const db = createAdminClient()

  // Load build
  const build = await getBuild(db, buildId)
  if (!build) {
    throw new Error('Build not found')
  }

  // Load all candidate items
  const items = await listCandidateItemsForBuild(db, buildId)

  if (items.length === 0) {
    return { itemsScreened: 0, flagged: 0, overCeiling: 0, warnings: [] }
  }

  const allWarnings: string[] = []
  let flaggedCount = 0
  let overCeilingCount = 0
  const startedAt = new Date().toISOString()

  // Get audience level from build config
  const audienceLevel =
    typeof build.audience === 'object' && build.audience !== null && 'level' in build.audience
      ? String(build.audience.level)
      : 'mixed'

  const readingCeiling = READING_GRADE_CEILING_BY_AUDIENCE[audienceLevel] ?? 10

  // Compute readability for all items
  for (const item of items) {
    const grade = fleschKincaidGrade(item.stem)
    if (grade > readingCeiling) {
      overCeilingCount++
    }

    // Persist reading grade
    await updateCandidateItemFairness(db, item.id, {
      readingGrade: Math.round(grade * 10) / 10,
    })
  }

  // Batch LLM fairness checks in chunks of 25
  const chunkSize = 25
  const validIds = new Set(items.map((i) => i.id))

  // Fetch system prompt from DB with fallback
  let fairnessSystemPrompt = DEFAULT_FAIRNESS_SYSTEM_PROMPT
  try {
    const promptConfig = await getActiveSystemPrompt('instrument_fairness')
    fairnessSystemPrompt = promptConfig.content
  } catch {
    // Fallback to default if DB fetch fails
  }

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)

    try {
      // Build prompt
      const prompt = buildFairnessPrompt(
        chunk.map((item) => ({
          id: item.id,
          stem: item.stem,
        })),
      )

      // Call LLM
      const taskConfig = await getModelForTask('instrument_fairness')
      const response = await openRouterProvider.complete({
        model: taskConfig.modelId,
        prompt,
        systemPrompt: fairnessSystemPrompt,
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: 'json',
      })

      // Parse response
      const { results, warnings: parseWarnings } = parseFairnessResponse(
        response.content,
        validIds,
      )
      allWarnings.push(...parseWarnings)

      // Persist fairness flags
      for (const result of results) {
        if (result.flags.length > 0) {
          flaggedCount++

          // Build payload with fairness flags
          const existingItem = items.find((it) => it.id === result.id)
          const payload = {
            ...existingItem?.payload,
            fairness: {
              flags: result.flags,
              note: result.note,
              screenedAt: new Date().toISOString(),
            },
          }

          await updateCandidateItemFairness(db, result.id, {
            payload,
          })
        }
      }
    } catch (error) {
      allWarnings.push(
        `Chunk ${Math.floor(i / chunkSize) + 1}: ${error instanceof Error ? error.message : 'fairness check failed'}`,
      )
    }
  }

  const completedAt = new Date().toISOString()

  // Record stage run
  await recordStageRun(db, {
    buildId,
    stageKey: 'fairness_screen',
    status: 'success',
    startedAt,
    completedAt,
    progressPct: 100,
    detail: `Screened ${items.length} items; ${flaggedCount} flagged; ${overCeilingCount} over reading ceiling`,
    outputSnapshot: {
      itemsScreened: items.length,
      flagged: flaggedCount,
      overCeiling: overCeilingCount,
      readingCeiling,
    },
  })

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_build.fairness_screen_run',
    targetTable: 'instrument_candidate_items',
    targetId: buildId,
    metadata: {
      itemsScreened: items.length,
      flagged: flaggedCount,
      overCeiling: overCeilingCount,
    },
  })

  return {
    itemsScreened: items.length,
    flagged: flaggedCount,
    overCeiling: overCeilingCount,
    warnings: allWarnings,
  }
}

/**
 * Recompute congruence aggregation from stored ratings. Platform-admin only.
 */
export async function listBuildCongruence(buildId: string): Promise<PanelResult> {
  await requireAdminScope()
  const db = createAdminClient()

  // Load build to verify it exists
  const build = await getBuild(db, buildId)
  if (!build) {
    throw new Error('Build not found')
  }

  // Load all stored ratings
  const ratings = await listCongruenceRatingsForBuild(db, buildId)

  // Convert to CongruenceRating format
  const congruenceRatings = ratings.map((r) => ({
    itemId: r.candidateItemId,
    raterIndex: r.raterIndex,
    raterModel: r.raterModel,
    assignedConstructId: r.assignedBlueprintId || 'unknown',
    intendedConstructId: r.intendedBlueprintId,
    relevance: r.relevance as 1 | 2 | 3 | 4,
    ...(r.namedFacet && { namedFacet: r.namedFacet }),
  }))

  return runCongruencePanel(congruenceRatings)
}

/**
 * Restore a soft-deleted blueprint. Backs the "Undo" affordance on delete.
 * Platform-admin only.
 */
export async function restoreBlueprintAction(blueprintId: string): Promise<void> {
  const scope = await requireAdminScope()
  const db = createAdminClient()

  await restoreBlueprint(db, blueprintId)

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_blueprint.restored',
    targetTable: 'instrument_blueprints',
    targetId: blueprintId,
  })
}

/**
 * Preview what would happen if the build were published.
 * Read-only; shows constructs/factors to create, items to publish, and any blockers.
 * Platform-admin only.
 */
export async function previewPublish(buildId: string): Promise<{
  constructsToCreate: Array<{ blueprintId: string; name: string; slug: string }>
  constructsToReuse: Array<{ blueprintId: string; name: string; constructId: string }>
  factorsToCreate: Array<{ blueprintId: string; name: string; slug: string }>
  itemsToPublish: number
  itemsAlreadyPublished: number
  blockers: string[]
  warnings: string[]
}> {
  await requireAdminScope()
  const db = createAdminClient()

  const build = await getBuild(db, buildId)
  if (!build) {
    throw new Error('Build not found')
  }

  const blueprints = await listBlueprints(db, buildId)
  const allItems = await listCandidateItemsForBuild(db, buildId)

  const blockers: string[] = []
  const warnings: string[] = []
  const constructsToCreate: Array<{ blueprintId: string; name: string; slug: string }> = []
  const constructsToReuse: Array<{ blueprintId: string; name: string; constructId: string }> = []
  const factorsToCreate: Array<{ blueprintId: string; name: string; slug: string }> = []

  let itemsToPublish = 0
  let itemsAlreadyPublished = 0

  for (const bp of blueprints) {
    // Check for construct
    if (!bp.constructId && !bp.draftConstructName) {
      blockers.push(
        `Blueprint "${bp.draftConstructName || 'Unnamed'}" has neither a linked construct nor a draft name`,
      )
      continue
    }

    if (bp.constructId) {
      constructsToReuse.push({
        blueprintId: bp.id,
        name: bp.draftConstructName || 'Unknown',
        constructId: bp.constructId,
      })
    } else if (bp.draftConstructName) {
      const slug = slugify(bp.draftConstructName)
      constructsToCreate.push({
        blueprintId: bp.id,
        name: bp.draftConstructName,
        slug,
      })
      factorsToCreate.push({
        blueprintId: bp.id,
        name: bp.draftConstructName,
        slug,
      })
    }

    // Items belong to a blueprint via blueprint_cell_id. Filtering only on
    // status would count EVERY accepted item in the build once per blueprint —
    // with 3 constructs that reported (and would have published) 3x the items,
    // attaching each construct's items to the other two.
    // Warn when a draft construct duplicates a name already in the library.
    // The slug uniquifier will happily create "resilience-1" beside an existing
    // "Resilience", which is silent taxonomy pollution — the operator should get
    // the chance to link to the existing construct instead.
    if (!bp.constructId && bp.draftConstructName) {
      // The repo slugify strips non-word characters and returns an EMPTY string
      // for a punctuation-only name, which would insert a construct with a blank
      // slug rather than fail. Block it here instead.
      if (slugify(bp.draftConstructName).length === 0) {
        blockers.push(
          `Construct name "${bp.draftConstructName}" cannot be turned into a usable slug — give it a name containing letters or numbers`,
        )
      }

      const { data: nameClash } = await db
        .from('constructs')
        .select('id, name')
        .ilike('name', bp.draftConstructName)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()

      if (nameClash) {
        warnings.push(
          `A construct named "${bp.draftConstructName}" already exists in the library. Publishing will create a SECOND one rather than reuse it — set this blueprint's construct instead if they are the same concept.`,
        )
      }
    }

    const blueprintItems = await listCandidateItemsByBlueprint(db, bp.id)
    const acceptedItems = blueprintItems.filter((i) => i.status === 'accepted')

    if (acceptedItems.length === 0) {
      warnings.push(`Construct "${bp.draftConstructName || bp.id}" has no accepted items — it will be created with an empty item pool`)
      continue
    }

    const newItems = acceptedItems.filter((i) => !i.publishedItemId)
    const existingItems = acceptedItems.filter((i) => i.publishedItemId)

    itemsToPublish += newItems.length
    itemsAlreadyPublished += existingItems.length
  }

  // Check for congruence evidence
  const ratings = await listCongruenceRatingsForBuild(db, buildId)
  if (ratings.length === 0) {
    warnings.push(
      'No congruence panel evidence recorded for this build. Items have not been checked for discrimination.',
    )
  }

  // Check for items with failing congruence
  const failedItems = allItems.filter((i) => {
    const itemRatings = ratings.filter((r) => r.candidateItemId === i.id)
    return itemRatings.length > 0 && itemRatings.some((r) => r.relevance < 2)
  })

  if (failedItems.length > 0) {
    warnings.push(
      `${failedItems.length} items have congruence verdicts below relevance threshold (likely to be poor discriminators)`,
    )
  }

  // Check for orphaned items
  const orphanedItems = allItems.filter((i) => !i.blueprintCellId && i.status === 'accepted')
  if (orphanedItems.length > 0) {
    warnings.push(`${orphanedItems.length} accepted items are not attached to any blueprint cell`)
  }

  return {
    constructsToCreate,
    constructsToReuse,
    factorsToCreate,
    itemsToPublish,
    itemsAlreadyPublished,
    blockers,
    warnings,
  }
}

/**
 * Publish a build to the live library. Creates constructs, factors, and items.
 * Platform-admin only.
 *
 * Idempotent: candidate items with published_item_id already set are skipped.
 * Blueprints with construct_id already set reuse that construct.
 * Re-publishing after adding items publishes only the new ones.
 */
export async function publishBuild(
  buildId: string,
  input: Record<string, unknown>,
): Promise<{
  constructsCreated: number
  factorsCreated: number
  itemsPublished: number
  skipped: number
  warnings: string[]
}> {
  const scope = await requireAdminScope()

  const parsed = publishBuildInputSchema.safeParse(input)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(issues.join(', ') || 'Invalid publish input')
  }

  const db = createAdminClient()

  // Load build
  const build = await getBuild(db, buildId)
  if (!build) {
    throw new Error('Build not found')
  }

  // Validate response format exists
  const { data: formatRow, error: formatError } = await db
    .from('response_formats')
    .select('id, is_active')
    .eq('id', parsed.data.responseFormatId)
    .maybeSingle()

  if (formatError || !formatRow) {
    throw new Error('Response format not found')
  }
  if ((formatRow as { is_active?: boolean }).is_active === false) {
    throw new Error('That response format is inactive and cannot be used for new items')
  }

  // Check blockers
  const preview = await previewPublish(buildId)
  if (preview.blockers.length > 0) {
    throw new Error(`Cannot publish: ${preview.blockers.join('; ')}`)
  }

  // Claim stage run for concurrency control
  let stageRun
  try {
    stageRun = await claimStageRun(db, {
      buildId,
      stageKey: 'publish_readiness',
      startedAt: new Date().toISOString(),
      detail: 'Publishing to library',
    })
  } catch (err) {
    if (err instanceof StageRunInFlightError) {
      throw new Error('A publish is already in progress for this build. Please wait.')
    }
    throw err
  }

  let constructsCreated = 0
  let factorsCreated = 0
  const publishedFactorIds: string[] = []
  let itemsPublished = 0
  let skipped = 0
  const publishWarnings: string[] = []

  try {
    const blueprints = await listBlueprints(db, buildId)
    const takenSlugs = new Set<string>()

    // Pre-load taken slugs
    const { data: constructRows } = await db.from('constructs').select('slug').is('deleted_at', null)
    const { data: factorRows } = await db.from('factors').select('slug').is('deleted_at', null)

    for (const row of constructRows ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      takenSlugs.add(String((row as any).slug))
    }

    for (const row of factorRows ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      takenSlugs.add(String((row as any).slug))
    }

    // Per blueprint, create/reuse construct, create factor, publish items
    for (const bp of blueprints) {
      let constructId = bp.constructId

      // Resolve or create construct
      if (!constructId && bp.draftConstructName) {
        let constructSlug = slugify(bp.draftConstructName)
        let suffix = 1

        while (takenSlugs.has(constructSlug)) {
          constructSlug = `${slugify(bp.draftConstructName)}-${suffix}`
          suffix++
        }

        const { data: constructData, error: constructError } = await db
          .from('constructs')
          .insert({
            name: bp.draftConstructName,
            slug: constructSlug,
            description: bp.draftConstructDefinition ?? null,
            is_active: true,
          })
          .select('id')
          .single()

        if (constructError) {
          publishWarnings.push(`Failed to create construct for "${bp.draftConstructName}": ${constructError.message}`)
          continue
        }

        constructId = constructData.id
        takenSlugs.add(constructSlug)
        constructsCreated++

        // Update blueprint to store the created construct
        await updateBlueprint(db, bp.id, { constructId })
      }

      if (!constructId) {
        publishWarnings.push(`No construct for blueprint "${bp.draftConstructName || bp.id}"`)
        continue
      }

      // Create factor
      let factorSlug = slugify(bp.draftConstructName || 'factor')
      let suffix = 1

      while (takenSlugs.has(factorSlug)) {
        factorSlug = `${slugify(bp.draftConstructName || 'factor')}-${suffix}`
        suffix++
      }

      // Reuse a factor already linked to this construct rather than inserting a
      // new one. upsert_factor_with_constructs upserts on id, so passing a fresh
      // uuid every time would make re-publishing create duplicate factors.
      const { data: existingLink } = await db
        .from('factor_constructs')
        .select('factor_id')
        .eq('construct_id', constructId)
        .limit(1)
        .maybeSingle()

      if (existingLink) {
        // Already published (or hand-linked) — nothing to create for this blueprint.
        publishedFactorIds.push(String((existingLink as { factor_id: string }).factor_id))
      } else {
        const { error: factorError } = await db.rpc('upsert_factor_with_constructs', {
          p_factor_id: randomUUID(),
          p_factor: {
            name: bp.draftConstructName || 'Published Factor',
            slug: factorSlug,
            description: bp.draftConstructDefinition ?? null,
            // The publish form collects this; dropping it silently produced
            // factors with no dimension despite the admin choosing one.
            dimension_id: parsed.data.dimensionId ?? null,
            is_active: true,
            // Explicitly NOT match-eligible: the Architect filters its
            // recommendation pool on this column and it defaults to true, so a
            // never-piloted factor would otherwise start being suggested to
            // clients the moment it was published.
            is_match_eligible: false,
            readiness: 'draft',
          },
          p_construct_links: [
            {
              construct_id: constructId,
              weight: 1.0,
              display_order: 1,
            },
          ],
        })

        // A failed factor means the construct's items can never be served, so this
        // is a hard failure, not a warning to scroll past.
        if (factorError) {
          throw new Error(
            `Failed to create factor for "${bp.draftConstructName || bp.id}": ${factorError.message}`,
          )
        }

        takenSlugs.add(factorSlug)
        factorsCreated++
      }

      // Get accepted items for this blueprint (excluding already-published)
      // Scope to THIS blueprint's items (via blueprint_cell_id) — see the same
      // note in previewPublish. allItems is also a snapshot taken before the
      // loop, so its publishedItemId values go stale as we publish.
      const blueprintItems = await listCandidateItemsByBlueprint(db, bp.id)
      const acceptedItems = blueprintItems.filter(
        (i) => i.status === 'accepted' && !i.publishedItemId,
      )

      // Count existing items in construct for display_order
      const { data: existingItems, error: countError } = await db
        .from('items')
        .select('id, display_order')
        .eq('construct_id', constructId)
        .is('deleted_at', null)

      if (countError) {
        publishWarnings.push(`Failed to count existing items for construct: ${countError.message}`)
        continue
      }

      const maxDisplayOrder = (existingItems ?? []).reduce((max, item) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return Math.max(max, Number((item as any).display_order ?? 0))
      }, 0)

      let nextDisplayOrder = maxDisplayOrder + 1

      // Publish accepted items
      for (const item of acceptedItems) {
        const difficultyMap: Record<string, string> = { low: 'easy', mid: 'medium', high: 'hard' }
        const difficulty = difficultyMap[item.difficultyTier ?? 'mid'] ?? 'medium'

        const { data: publishedItem, error: itemError } = await db
          .from('items')
          .insert({
            construct_id: constructId,
            response_format_id: parsed.data.responseFormatId,
            stem: item.stem,
            stem_observer: item.stemObserver ?? null,
            reverse_scored: item.reverseScored ?? false,
            weight: 1.0,
            status: 'draft',
            display_order: nextDisplayOrder,
            purpose: 'construct',
            difficulty,
          })
          .select('id')
          .single()

        if (itemError) {
          publishWarnings.push(
            `Failed to publish item "${item.stem.substring(0, 50)}...": ${itemError.message}`,
          )
          continue
        }

        // Link the candidate to the item it produced. If this fails the item
        // exists but nothing records it, so a re-publish would insert a second
        // copy. Roll the item back rather than leave an untracked orphan.
        try {
          await updateCandidateItem(db, item.id, {
            publishedItemId: publishedItem.id,
          })
        } catch (linkError) {
          await db
            .from('items')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', publishedItem.id)
          throw new Error(
            `Published an item but could not link it back to its candidate (rolled back): ${
              linkError instanceof Error ? linkError.message : 'unknown error'
            }`,
          )
        }

        itemsPublished++
        nextDisplayOrder++
      }

      // Already-published items for THIS blueprint (same scoping reason as above).
      skipped += blueprintItems.filter(
        (i) => i.status === 'accepted' && i.publishedItemId,
      ).length
    }

    // Record evidence
    await appendEvidence(db, buildId, [
      {
        targetType: 'instrument',
        targetId: buildId,
        claim: 'items_published',
        value: itemsPublished,
        evidenceClass: 'a_priori',
        method: 'publish_v1',
        sampleSize: undefined,
        producedAt: new Date(),
        supersededAt: null,
      },
    ])

    // Close stage run
    await updateStageRun(db, stageRun.id, {
      status: 'success',
      completedAt: new Date().toISOString(),
      progressPct: 100,
      detail: `Published ${constructsCreated} constructs, ${factorsCreated} factors, ${itemsPublished} items`,
      outputSnapshot: {
        constructsCreated,
        factorsCreated,
        itemsPublished,
        skipped,
      },
    })

    revalidatePath('/instruments')
    revalidatePath('/items')
    revalidatePath('/constructs')
    revalidatePath('/factors')

    await logAuditEvent({
      actorProfileId: scope.actor?.id ?? null,
      eventType: 'instrument_build.published',
      targetTable: 'constructs',
      targetId: buildId,
      metadata: {
        constructsCreated,
        factorsCreated,
        itemsPublished,
        skipped,
      },
    })
  } catch (error) {
    // Close stage run on error
    try {
      await updateStageRun(db, stageRun.id, {
        status: 'failure',
        completedAt: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
    } catch {
      // Closing the stage run is best-effort — the original failure is what
      // matters and is re-thrown below.
    }

    throw error
  }

  return {
    constructsCreated,
    factorsCreated,
    itemsPublished,
    skipped,
    warnings: publishWarnings,
  }
}

/**
 * Unpublish a build. Soft-deletes items this build created.
 * Constructs and factors are intentionally left in place — they may have been
 * hand-edited after publishing, and silently removing library taxonomy is worse
 * than leaving an empty one.
 * Platform-admin only.
 */
export async function unpublishBuild(buildId: string): Promise<{ itemsUnpublished: number }> {
  const scope = await requireAdminScope()
  const db = createAdminClient()

  const build = await getBuild(db, buildId)
  if (!build) {
    throw new Error('Build not found')
  }

  // Find all candidate items with published_item_id for this build
  const allItems = await listCandidateItemsForBuild(db, buildId)
  const publishedItems = allItems.filter((i) => i.publishedItemId)

  let itemsUnpublished = 0

  // Soft-delete the published items
  for (const item of publishedItems) {
    const { error } = await db
      .from('items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', item.publishedItemId)

    if (!error) {
      itemsUnpublished++
    }
  }

  // Clear published_item_id on all candidate items
  for (const item of publishedItems) {
    await updateCandidateItem(db, item.id, { publishedItemId: null })
  }

  revalidatePath('/instruments')
  revalidatePath('/items')

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_build.unpublished',
    targetTable: 'items',
    targetId: buildId,
    metadata: {
      itemsUnpublished,
    },
  })

  return { itemsUnpublished }
}

/**
 * Propose a construct set for a build using AI.
 *
 * Takes the build brief, measure type, audience, and use context,
 * calls the structure-step LLM to generate proposed constructs,
 * and runs construct-preflight (embedding + LLM discrimination review) for high-overlap pairs.
 *
 * Returns constructs, warnings, and preflight results with rich discriminability guidance.
 * Preflight pairs include shared signals, unique signals, and refinement guidance.
 *
 * The similarity scores are a HEURISTIC FOR HUMAN REVIEW, not an automated gate.
 * Measured separation on this platform is Cohen's d ~ 0.63–1.03.
 *
 * Platform-admin only.
 */
export async function proposeStructureAction(buildId: string): Promise<{
  constructs: Array<{ name: string; definition: string; exclusions: string[] }>
  warnings: string[]
  preflightPairs: Array<{
    constructAIndex: number
    constructBIndex: number
    constructAName: string
    constructBName: string
    cosineSimilarity: number
    status: 'green' | 'amber' | 'red'
    reviewedByLlm: boolean
    overlapSummary?: string
    sharedSignals?: string[]
    uniqueSignalsA?: string[]
    uniqueSignalsB?: string[]
    discriminatingItemsA?: string[]
    discriminatingItemsB?: string[]
    refinementGuidanceA?: string
    refinementGuidanceB?: string
    llmExplanation?: string
  }>
}> {
  await requireAdminScope()

  const db = createAdminClient()
  const build = await getBuild(db, buildId)
  if (!build) {
    throw new Error('Build not found')
  }

  // Import modules
  const {
    buildStructurePrompt,
    parseStructureProposal,
    DEFAULT_STRUCTURE_SYSTEM_PROMPT,
  } = await import('@/lib/instrument/structure')
  const { runConstructPreflight } = await import('@/lib/ai/generation/construct-preflight')

  // Build the prompt
  const prompt = buildStructurePrompt({
    buildName: build.name,
    brief: build.brief,
    measureType: (build.measureType as MeasureType),
    audience: build.audience,
    useContext: build.useContext,
    targetConstructCount: build.targetConstructCount,
  })

  // Get model and system prompt
  let systemPrompt: string
  try {
    const activePrompt = await getActiveSystemPrompt('instrument_structure')
    systemPrompt = activePrompt.content
  } catch (err) {
    if (err instanceof AISystemPromptError) {
      systemPrompt = DEFAULT_STRUCTURE_SYSTEM_PROMPT
    } else {
      throw err
    }
  }

  // Call LLM
  const model = await getModelForTask('instrument_structure')
  const response = await openRouterProvider.complete({
    model: model.modelId,
    systemPrompt,
    prompt,
    temperature: 0.7,
    maxTokens: 4096,
    responseFormat: 'json',
  })

  // Parse response
  const proposal = parseStructureProposal(response.content)

  // Run construct preflight for discriminability analysis
  let preflightPairs: Array<{
    constructAIndex: number
    constructBIndex: number
    constructAName: string
    constructBName: string
    cosineSimilarity: number
    status: 'green' | 'amber' | 'red'
    reviewedByLlm: boolean
    overlapSummary?: string
    sharedSignals?: string[]
    uniqueSignalsA?: string[]
    uniqueSignalsB?: string[]
    discriminatingItemsA?: string[]
    discriminatingItemsB?: string[]
    refinementGuidanceA?: string
    refinementGuidanceB?: string
    llmExplanation?: string
  }> = []

  if (proposal.constructs.length > 1) {
    try {
      // Convert proposed constructs to the format expected by runConstructPreflight
      // ConstructDraftInput requires id, name, definition (and optionally dimensionId)
      const constructsForPreflight = proposal.constructs.map((c, idx) => ({
        id: `draft_${idx}`,
        name: c.name,
        definition: c.definition,
      }))

      const preflightResult = await runConstructPreflight(constructsForPreflight)

      // Transform preflight pairs to the UI format (mapping constructId to indices)
      preflightPairs = preflightResult.pairs.map((p) => {
        const aIdx = constructsForPreflight.findIndex((c) => c.id === p.constructAId)
        const bIdx = constructsForPreflight.findIndex((c) => c.id === p.constructBId)
        return {
          constructAIndex: aIdx >= 0 ? aIdx : 0,
          constructBIndex: bIdx >= 0 ? bIdx : 1,
          constructAName: p.constructAName,
          constructBName: p.constructBName,
          cosineSimilarity: p.cosineSimilarity,
          status: p.status,
          reviewedByLlm: p.reviewedByLlm ?? false,
          overlapSummary: p.overlapSummary,
          sharedSignals: p.sharedSignals,
          uniqueSignalsA: p.uniqueSignalsA,
          uniqueSignalsB: p.uniqueSignalsB,
          discriminatingItemsA: p.discriminatingItemsA,
          discriminatingItemsB: p.discriminatingItemsB,
          refinementGuidanceA: p.refinementGuidanceA,
          refinementGuidanceB: p.refinementGuidanceB,
          llmExplanation: p.llmExplanation,
        }
      })
    } catch (err) {
      // Preflight failure is not fatal; just skip discriminability analysis
      proposal.warnings.push(
        `Could not run discriminability analysis: ${err instanceof Error ? err.message : 'unknown error'}`,
      )
    }
  }

  return {
    constructs: proposal.constructs,
    warnings: proposal.warnings,
    preflightPairs,
  }
}

/**
 * Confirm a proposed construct set by creating blueprint rows.
 *
 * Takes an array of editable constructs (user may have edited names, definitions, exclusions,
 * and may have added/deleted constructs from the AI proposal) and creates one blueprint
 * row per construct via the existing DAL.
 *
 * Commit is idempotent/safe: if the user commits twice, duplicate checks match on
 * (build + construct name) to prevent duplication.
 *
 * Platform-admin only.
 */
export async function confirmStructureAction(
  buildId: string,
  constructs: Array<Record<string, unknown>>,
  preflightPairs?: Array<{
    constructAName: string
    constructBName: string
    cosineSimilarity: number
  }>,
): Promise<InstrumentBlueprintDto[]> {
  await requireAdminScope()

  if (!Array.isArray(constructs) || constructs.length === 0) {
    throw new Error('At least one construct is required')
  }

  const db = createAdminClient()
  const build = await getBuild(db, buildId)
  if (!build) {
    throw new Error('Build not found')
  }

  // Validate and normalize constructs
  const normalized: Array<{ name: string; definition: string; exclusions: string[] }> = []
  for (const c of constructs) {
    const name = String(c.name ?? '').trim()
    const definition = String(c.definition ?? '').trim()
    const exclusionsRaw = c.exclusions
    let exclusions: string[] = []

    if (!name || !definition) {
      throw new Error('All constructs must have a name and definition')
    }

    if (Array.isArray(exclusionsRaw)) {
      exclusions = exclusionsRaw
        .map((e) => String(e).trim())
        .filter((e) => e.length > 0)
    }

    normalized.push({ name, definition, exclusions })
  }

  // Create blueprints (with duplicate checking on name)
  const existingBlueprints = await listBlueprints(db, buildId)
  const existingNames = new Set(
    existingBlueprints.map((b) =>
      (b.draftConstructName || '').toLowerCase(),
    ),
  )

  const created: InstrumentBlueprintDto[] = []
  for (const construct of normalized) {
    const nameLower = construct.name.toLowerCase()

    // Skip if already exists (idempotent)
    if (existingNames.has(nameLower)) {
      const existing = existingBlueprints.find(
        (b) => (b.draftConstructName || '').toLowerCase() === nameLower,
      )
      if (existing) {
        created.push(existing)
      }
      continue
    }

    const blueprint = await createBlueprint(db, {
      buildId,
      draftConstructName: construct.name,
      draftConstructDefinition: construct.definition,
      measureType: build.measureType,
      exclusions: construct.exclusions.length > 0 ? construct.exclusions : null,
    })
    created.push(blueprint)
    existingNames.add(nameLower)
  }

  // Persist the pairwise overlap as evidence. Previously it lived only in the
  // wizard's client state, so the technical report's discriminant section was
  // permanently empty — which reads as "no overlap found" rather than "never
  // recorded". It is stored as SYNTHETIC evidence: it comes from embeddings,
  // not from respondents.
  if (preflightPairs && preflightPairs.length > 0) {
    const idByName = new Map(
      created.map((bp) => [(bp.draftConstructName || '').toLowerCase(), bp.id]),
    )
    const producedAt = new Date()
    const evidenceRows = preflightPairs.flatMap((pair) => {
      const aId = idByName.get(pair.constructAName.toLowerCase())
      const bId = idByName.get(pair.constructBName.toLowerCase())
      if (!aId || !bId) return []
      return [
        {
          targetType: 'construct' as const,
          targetId: aId,
          claim: 'construct_overlap',
          value: pair.cosineSimilarity,
          evidenceClass: 'synthetic' as const,
          method: 'construct_preflight_v1',
          detail: { source: bId },
          producedAt,
        },
      ]
    })
    if (evidenceRows.length > 0) {
      await appendEvidence(db, buildId, evidenceRows)
    }
  }

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: (await requireAdminScope()).actor?.id ?? null,
    eventType: 'instrument_structure.confirmed',
    targetTable: 'instrument_blueprints',
    targetId: buildId,
    metadata: {
      constructCount: created.length,
    },
  })

  return created
}

/**
 * Run within-construct redundancy detection on a blueprint's candidate items.
 *
 * Embeds stems, builds correlation/network, computes wTO overlap, and marks
 * near-duplicate items with redundancy_peer_id (keeper) and redundancy_score.
 *
 * Platform-admin only. Idempotent — can be re-run; previous marks are overwritten.
 */
export async function runRedundancyPassAction(
  blueprintId: string,
  cutoff: number = DEFAULT_WTO_CUTOFF,
): Promise<RedundancyPassResult> {
  await requireAdminScope()
  const db = createAdminClient()

  const result = await runRedundancyPass(db, blueprintId, cutoff)

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: (await requireAdminScope()).actor?.id ?? null,
    eventType: 'instrument_redundancy.ran',
    targetTable: 'instrument_candidate_items',
    targetId: blueprintId,
    metadata: {
      redundantCount: result.stats.redundantCount,
      keptCount: result.stats.keptCount,
      cutoff: result.stats.cutoff,
    },
  })

  return result
}

/**
 * Run critique pass on a blueprint's candidate items.
 *
 * Calls the seeded 'instrument_critique' system prompt via LLM,
 * getting keep | revise | drop verdicts + reasons.
 * Persists results to critique_verdict and critique_reason.
 *
 * Platform-admin only. Handles partial failures gracefully (one item's error
 * does not fail the batch). Idempotent — re-running overwrites previous verdicts.
 */
export async function runCritiquePassAction(
  blueprintId: string,
  constructName: string,
  options?: {
    constructDefinition?: string
    constructDescription?: string
    constructIndicatorsLow?: string
    constructIndicatorsMid?: string
    constructIndicatorsHigh?: string
    contrastConstructs?: string[]
    measurementMode?: MeasurementMode
    measurementModeDescription?: string
    audience?: Record<string, unknown>
    useContext?: string
    useContextDescription?: string
  },
): Promise<CritiqueBatchResult> {
  await requireAdminScope()
  const db = createAdminClient()

  const result = await runCritiquePass(db, blueprintId, constructName, options as Parameters<typeof runCritiquePass>[3])

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: (await requireAdminScope()).actor?.id ?? null,
    eventType: 'instrument_critique.ran',
    targetTable: 'instrument_candidate_items',
    targetId: blueprintId,
    metadata: {
      kept: result.stats.kept,
      revised: result.stats.revised,
      dropped: result.stats.dropped,
      failedParses: result.stats.failedParses,
      providerErrors: result.stats.providerErrors,
    },
  })

  return result
}

/**
 * Clear redundancy marks on a blueprint's items (for rollback).
 * Platform-admin only.
 */
export async function clearRedundancyMarksAction(blueprintId: string): Promise<void> {
  await requireAdminScope()
  const db = createAdminClient()
  await clearRedundancyMarks(db, blueprintId)
  revalidatePath('/instruments')
}

/**
 * Clear critique marks on a blueprint's items (for rollback).
 * Platform-admin only.
 */
export async function clearCritiqueMarksAction(blueprintId: string): Promise<void> {
  await requireAdminScope()
  const db = createAdminClient()
  await clearCritiqueMarks(db, blueprintId)
  revalidatePath('/instruments')
}

/**
 * Orchestrating action for the quick-build wizard.
 *
 * Runs the full generation pipeline for all blueprints in a build:
 * 1. Blueprint draft (facet/intensity grid) per construct
 * 2. Item generation with deduplication
 * 3. Critique pass for consistency
 * 4. Congruence panel for alignment
 * 5. Fairness screen for accessibility
 *
 * Resilient to partial failures: if one construct's pipeline fails, the others
 * continue and the error is reported in the result. Uses instrument_stage_runs
 * to track progress and enable re-run safety (blueprint draft is idempotent via
 * replaceBlueprintCells; item generation checks for existing items; other stages
 * overwrite previous runs).
 *
 * Platform-admin only.
 */
export async function quickBuildInstrumentAction(
  buildId: string,
  options: Record<string, unknown>,
): Promise<{
  totalItems: number
  error?: string
}> {
  const scope = await requireAdminScope()
  const db = createAdminClient()

  // Validate input
  if (!buildId || typeof buildId !== 'string') {
    throw new Error('Build ID is required')
  }

  const itemsPerConstruct =
    typeof options.itemsPerConstruct === 'number' ? options.itemsPerConstruct : 10
  const targetAlpha = typeof options.targetAlpha === 'number' ? options.targetAlpha : 0.8
  const readingLevel =
    typeof options.readingLevel === 'string' ? options.readingLevel : 'mixed'

  // Fetch build and blueprints
  const build = await getBuild(db, buildId)
  if (!build) {
    throw new Error('Build not found')
  }

  const blueprints = await listBlueprints(db, buildId)
  if (blueprints.length === 0) {
    throw new Error('No blueprints found')
  }

  // The Scope step's three controls are the whole point of that step, and they
  // were previously parsed and discarded — the blueprint stage kept its own
  // hardcoded target regardless of what the operator chose. Persist them onto
  // the build and its blueprints BEFORE drafting, so the AI drafts against the
  // requested scope and the technical report reads back the same numbers.
  await updateBuild(db, buildId, {
    targetItemsPerConstruct: itemsPerConstruct,
    config: { ...(build.config ?? {}), readingLevel },
  })
  for (const blueprint of blueprints) {
    await updateBlueprint(db, blueprint.id, { targetAlpha })
  }

  const startedAt = new Date().toISOString()
  let totalItems = 0
  const errors: Array<{ blueprint: string; error: string }> = []

  // Process each blueprint in sequence
  for (const blueprint of blueprints) {
    try {
      // Stage 1: Blueprint draft (generate facet/intensity grid)
      try {
        await draftBlueprintWithAI(blueprint.id, {
          temperature: 0.7,
          // draftBlueprintWithAiOptionsSchema caps maxTokens at 4000; passing
          // 4096 failed validation and threw on every blueprint.
          maxTokens: 4000,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        errors.push({ blueprint: blueprint.draftConstructName || blueprint.id, error: `Draft: ${msg}` })
        continue
      }

      // Stage 2: Item generation
      try {
        const genResult = await generateItemsForBlueprint(blueprint.id, {
          temperature: 0.8,
          maxTokens: 3000,
        })
        totalItems += genResult.generated
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        errors.push({ blueprint: blueprint.draftConstructName || blueprint.id, error: `Generation: ${msg}` })
        continue
      }

      // Stage 3: Critique pass
      try {
        const critiqueOptions: Record<string, unknown> = {}
        if (build.audience) critiqueOptions.audience = build.audience
        if (build.useContext) critiqueOptions.useContext = build.useContext
        await runCritiquePassAction(blueprint.id, blueprint.draftConstructName || 'Unnamed', critiqueOptions)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        errors.push({ blueprint: blueprint.draftConstructName || blueprint.id, error: `Critique: ${msg}` })
        // Don't continue — continue to congruence even if critique fails
      }

      // Congruence is build-wide and runs once, after the loop. Calling it here
      // re-rated every previously generated item on each iteration and replaced
      // those ratings, so an n-construct build did n full panels and only the
      // last one survived.
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      errors.push({ blueprint: blueprint.draftConstructName || blueprint.id, error: msg })
    }
  }

  // Congruence and fairness are both build-wide: they run once, after every
  // construct's items exist, so the panel sees the whole instrument.
  try {
    await runCongruencePanelForBuild(buildId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    errors.push({ blueprint: 'congruence_panel', error: msg })
  }

  try {
    await runFairnessScreenForBuild(buildId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    errors.push({ blueprint: 'fairness_screen', error: msg })
  }

  const completedAt = new Date().toISOString()

  // Record overall stage run
  await recordStageRun(db, {
    buildId,
    stageKey: 'quick_build_pipeline',
    status: errors.length > 0 && totalItems === 0 ? 'failure' : 'success',
    startedAt,
    completedAt,
    progressPct: 100,
    detail: `Generated ${totalItems} items across ${blueprints.length} blueprints${
      errors.length > 0 ? ` (${errors.length} errors)` : ''
    }`,
    outputSnapshot: {
      totalItems,
      blueprintCount: blueprints.length,
      errorCount: errors.length,
    },
    errorMessage: errors.length > 0 ? `${errors.length} stages failed` : null,
  })

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_quick_build.completed',
    targetTable: 'instrument_builds',
    targetId: buildId,
    metadata: {
      totalItems,
      blueprintCount: blueprints.length,
      errorCount: errors.length,
    },
  })

  // Return result
  const errorMessage = errors.length > 0 ? `${errors.length} stage(s) had warnings or errors` : undefined
  return {
    totalItems,
    error: errorMessage,
  }
}
