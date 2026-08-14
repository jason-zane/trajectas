'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import {
  listBuilds,
  getBuild,
  createBuild,
  updateBuild,
  softDeleteBuild,
  listBlueprints,
  getBlueprintWithCells,
  createBlueprint,
  updateBlueprint,
  softDeleteBlueprint,
  replaceBlueprintCells,
  appendEvidence,
  listCandidateItemsByBlueprint,
  listCandidateItemsForBuild,
  createCandidateItems,
  recordStageRun,
  findRunningStageRun,
  updateStageRun,
  updateCandidateItem,
  softDeleteCandidateItem,
  insertCongruenceRatings,
  deleteCongruenceRatingsForItems,
  listCongruenceRatingsForBuild,
  updateCandidateItemFairness,
} from '@/lib/dal/instrument'
import {
  instrumentBuildInputSchema,
  instrumentBuildUpdateSchema,
  blueprintInputSchema,
  blueprintUpdateSchema,
  saveBlueprintCellsInputSchema,
  draftBlueprintWithAiOptionsSchema,
  generateItemsForBlueprintOptionsSchema,
  updateCandidateItemStatusSchema,
} from '@/lib/validations/instrument'
import { validateBlueprint, facetCount, totalTargetItems } from '@/lib/instrument/blueprint'
import { forecastAlpha } from '@/lib/instrument/reliability'
import { isMeasureType } from '@/lib/instrument/types'
import type { BlueprintCell } from '@/lib/instrument/types'
import {
  buildBlueprintDraftPrompt,
  draftToCells,
  parseBlueprintDraft,
  type BlueprintDraftInput,
  DEFAULT_BLUEPRINT_SYSTEM_PROMPT,
} from '@/lib/instrument/blueprint-draft'
import { getModelForTask } from '@/lib/ai/model-config'
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
  buildCongruencePrompt,
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
} from '@/lib/instrument/fairness'
import type { PanelResult } from '@/lib/instrument/congruence'

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
 * Update an instrument build. Platform-admin only.
 */
export async function updateInstrumentBuild(
  buildId: string,
  input: Record<string, unknown>,
): Promise<InstrumentBuildDto> {
  const scope = await requireAdminScope()

  const parsed = instrumentBuildUpdateSchema.safeParse(input)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(issues.join(', ') || 'Invalid instrument build update')
  }

  const db = createAdminClient()
  const result = await updateBuild(db, buildId, {
    name: parsed.data.name,
    brief: parsed.data.brief as string | null | undefined,
    audience: parsed.data.audience,
    useContext: parsed.data.useContext,
    targetConstructCount: parsed.data.targetConstructCount,
    targetItemsPerConstruct: parsed.data.targetItemsPerConstruct,
  })

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_build.updated',
    targetTable: 'instrument_builds',
    targetId: result.id,
    metadata: {
      name: result.name,
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
  }

  // Build prompt and call AI
  const prompt = buildBlueprintDraftPrompt(draftRequest)

  let modelId: string
  if (parsedOptions.data.modelId) {
    modelId = parsedOptions.data.modelId
  } else {
    // Get default model for item_generation task (reusing existing purpose)
    const taskConfig = await getModelForTask('item_generation')
    modelId = taskConfig.modelId
  }

  const response = await openRouterProvider.complete({
    model: modelId,
    prompt,
    systemPrompt: DEFAULT_BLUEPRINT_SYSTEM_PROMPT,
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

  // Resolve model
  let modelId: string
  if (parsedOptions.data.modelId) {
    modelId = parsedOptions.data.modelId
  } else {
    const taskConfig = await getModelForTask('item_generation')
    modelId = taskConfig.modelId
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
  // cell. Claim a `running` row before doing any work and refuse if one is
  // already open.
  const inFlight = await findRunningStageRun(db, blueprint.buildId, 'item_generation')
  if (inFlight) {
    throw new Error(
      'Item generation is already running for this instrument. Wait for it to finish before starting another run.',
    )
  }

  const stageRun = await recordStageRun(db, {
    buildId: blueprint.buildId,
    stageKey: 'item_generation',
    status: 'running',
    startedAt,
    progressPct: 0,
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
        systemPrompt: DEFAULT_ITEM_GENERATION_SYSTEM_PROMPT,
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
 * Soft-delete a candidate item. Platform-admin only.
 */
export async function deleteCandidateItem(itemId: string): Promise<void> {
  const scope = await requireAdminScope()
  const db = createAdminClient()

  await softDeleteCandidateItem(db, itemId)

  revalidatePath('/instruments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'instrument_item.deleted',
    targetTable: 'instrument_candidate_items',
    targetId: itemId,
  })
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
      // Build prompt (blind to intended construct)
      const prompt = buildCongruencePrompt({
        stem: item.stem,
        candidates: blueprintDtos.map((bp) => ({
          id: bp.id,
          name: bp.draftConstructName || bp.constructId || 'Unnamed',
          definition: bp.draftConstructDefinition || undefined,
        })),
        measureType: isMeasureType(build.measureType) ? build.measureType : undefined,
      })

      // Get models (prefer variety)
      const models = typeof options === 'object' && options !== null && 'models' in options && Array.isArray(options.models)
        ? options.models.filter((m): m is string => typeof m === 'string')
        : []

      if (models.length === 0) {
        const taskConfig = await getModelForTask('item_generation')
        models.push(taskConfig.modelId)
      }

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
          const model = models[raterIndex % models.length]
          const response = await openRouterProvider.complete({
            model,
            prompt,
            systemPrompt: DEFAULT_CONGRUENCE_SYSTEM_PROMPT,
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
      const taskConfig = await getModelForTask('item_generation')
      const response = await openRouterProvider.complete({
        model: taskConfig.modelId,
        prompt,
        systemPrompt: DEFAULT_FAIRNESS_SYSTEM_PROMPT,
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

// Import for DEFAULT_FAIRNESS_SYSTEM_PROMPT
const DEFAULT_FAIRNESS_SYSTEM_PROMPT = `You are an expert in psychometric fairness and assessment design. Your task is to review assessment items for fairness concerns.

**Your job:** flag items that exhibit genuine fairness problems:
1. **Idiom** — Uses colloquialisms, slang, or culturally-specific expressions (e.g., "hit the nail on the head", "raining cats and dogs").
2. **Metaphor** — Contains sports or military metaphors (e.g., "attacking the problem", "winning the battle").
3. **Sensory assumption** — Assumes respondents can see, hear, or perceive in a way that excludes people with sensory disabilities (e.g., "imagine the scene" or "as you can see").
4. **Protected class** — Proximity to age, family status, health, disability, religion, or sexual orientation (e.g., "as a father" or "when you get older").
5. **Jargon** — Domain-specific terminology that may not be universally understood.

**Critical rules:**
- Flag ONLY genuine fairness issues. Benign wording that is merely formal or technical is NOT a fairness problem.
- False positives (flagging items that are actually fair) are a failure of the review. Be strict and accurate.
- If an item is unclear, do not flag it — ask the human reviewer instead.
- A well-written, inclusive item that uses precise language should NOT be flagged.

Return ONLY a JSON array with no preamble or explanation.`
