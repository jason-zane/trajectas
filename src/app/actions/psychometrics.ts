'use server'

import { revalidatePath } from 'next/cache'
import type { CTTItemStatistics } from '@/types/scoring'
import {
  createCalibrationRun,
  completeCalibrationRun,
  failCalibrationRun,
  fetchCalibrationResponses,
  insertItemStatistics,
  insertConstructReliability,
  countEligibleSessions,
  listCalibrationRuns,
  softDeleteCalibrationRun,
  updateCalibrationRunLabel,
  type CalibrationRunSummary,
} from '@/lib/dal/calibration'
import { requireAdminScope } from '@/lib/auth/authorization'
import { createAdminClient } from '@/lib/supabase/admin'
import { throwActionError } from '@/lib/security/action-errors'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import {
  prepareConstructCalibration,
  MIN_STABLE_N as PREP_MIN_STABLE_N,
} from '@/lib/scoring/calibration-prep'
import { buildResponseMatrix, computeItemStatistics } from '@/lib/scoring/item-statistics'
import { calculateReliability, calculateStandardError } from '@/lib/scoring/ctt/scoring'
import { deriveItemBounds } from '@/lib/scoring/ctt-session'


/**
 * PostgREST returns an embedded to-one relation as either an object or a
 * single-element array depending on how it infers the relationship. Normalise
 * once rather than casting to `any` at each use.
 */
function unwrapEmbedded(
  value: unknown
): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined
  return (value ?? undefined) as Record<string, unknown> | undefined
}

// ---------------------------------------------------------------------------
// Inline indicators (for Library pages)
// ---------------------------------------------------------------------------

/** Lightweight item health indicator for the items list page. */
export type ItemHealthIndicator = {
  itemId: string
  status: 'healthy' | 'review' | 'action'
  discrimination: number | null
}

/** Lightweight construct reliability indicator for the constructs list page. */
export type ConstructAlphaIndicator = {
  constructId: string
  alpha: number | null
}

/**
 * Fetch item health indicators for all items in the latest completed calibration.
 * Returns a map-friendly array for merging into item list data.
 */
export async function getItemHealthIndicators(): Promise<ItemHealthIndicator[]> {
  await requireAdminScope()
  const db = createAdminClient()

  const { data: latestRun, error: latestRunError } = await db
    .from('calibration_runs')
    .select('id')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (latestRunError) return []
  if (!latestRun) return []

  const { data: stats, error: statsError } = await db
    .from('item_statistics')
    .select('item_id, difficulty, discrimination, flagged')
    .eq('calibration_run_id', latestRun.id)

  if (statsError) {
    throwActionError('getItemHealthIndicators', 'Unable to load item health indicators.', statsError)
  }
  if (!stats) return []

  return stats.map((row) => {
    const d = row.difficulty != null ? Number(row.difficulty) : null
    const r = row.discrimination != null ? Number(row.discrimination) : null
    let status: 'healthy' | 'review' | 'action' = 'healthy'

    if (row.flagged) {
      status = 'action'
    } else if (r !== null && r < 0.30) {
      status = r < 0.20 ? 'action' : 'review'
    } else if (d !== null && (d < 0.25 || d > 0.75)) {
      status = 'review'
    }

    return { itemId: row.item_id, status, discrimination: r }
  })
}

/**
 * Fetch construct alpha indicators for the latest completed calibration.
 */
export async function getConstructAlphaIndicators(): Promise<ConstructAlphaIndicator[]> {
  await requireAdminScope()
  const db = createAdminClient()

  const { data: latestRun, error: latestRunError } = await db
    .from('calibration_runs')
    .select('id')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (latestRunError) return []
  if (!latestRun) return []

  const { data: rows, error: rowsError } = await db
    .from('construct_reliability')
    .select('construct_id, cronbach_alpha')
    .eq('calibration_run_id', latestRun.id)

  if (rowsError) {
    throwActionError('getConstructAlphaIndicators', 'Unable to load construct alpha indicators.', rowsError)
  }
  if (!rows) return []

  return rows.map((row) => ({
    constructId: row.construct_id,
    alpha: row.cronbach_alpha != null ? Number(row.cronbach_alpha) : null,
  }))
}

// ---------------------------------------------------------------------------
// Overview statistics
// ---------------------------------------------------------------------------

export type PsychometricOverview = {
  totalItems: number
  activeItems: number
  flaggedItems: number
  constructCount: number
  reliableConstructs: number
  calibrationRuns: number
  lastCalibrationDate: string | null
  /** Sample size of the latest run — drives the provisional-results banner. */
  lastCalibrationSampleSize: number | null
  /**
   * Smallest per-construct complete-case count in the latest run. Each alpha is
   * governed by ITS construct's n, not the run-wide session count, so gating the
   * provisional caveat on the run total would understate how thin the data is.
   */
  lastCalibrationMinConstructN: number | null
  normGroupCount: number
}

export async function getPsychometricOverview(): Promise<PsychometricOverview> {
  await requireAdminScope()
  const db = createAdminClient()

  const [items, activeItems, flagged, constructs, reliable, runs, norms, calibrationRunsResult] =
    await Promise.all([
      db.from('items').select('*', { count: 'exact', head: true }),
      db.from('items').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('item_statistics').select('*', { count: 'exact', head: true }).eq('flagged', true),
      db.from('constructs').select('*', { count: 'exact', head: true }).eq('is_active', true),
      db.from('construct_reliability').select('*', { count: 'exact', head: true }).gte('cronbach_alpha', 0.7),
      db.from('calibration_runs').select('created_at, sample_size, id').order('created_at', { ascending: false }).limit(1),
      db.from('norm_groups').select('*', { count: 'exact', head: true }).eq('is_active', true),
      db.from('calibration_runs').select('*', { count: 'exact', head: true }),
    ])

  if (items.error) throwActionError('getPsychometricOverview', 'Unable to load psychometric overview.', items.error)
  if (activeItems.error) throwActionError('getPsychometricOverview', 'Unable to load psychometric overview.', activeItems.error)
  if (flagged.error) throwActionError('getPsychometricOverview', 'Unable to load psychometric overview.', flagged.error)
  if (constructs.error) throwActionError('getPsychometricOverview', 'Unable to load psychometric overview.', constructs.error)
  if (reliable.error) throwActionError('getPsychometricOverview', 'Unable to load psychometric overview.', reliable.error)
  if (runs.error) throwActionError('getPsychometricOverview', 'Unable to load psychometric overview.', runs.error)
  if (norms.error) throwActionError('getPsychometricOverview', 'Unable to load psychometric overview.', norms.error)
  if (calibrationRunsResult.error) {
    throwActionError('getPsychometricOverview', 'Unable to load psychometric overview.', calibrationRunsResult.error)
  }

  // Smallest per-construct n in the latest run.
  let minConstructN: number | null = null
  const latestRunId = runs.data?.[0]?.id
  if (latestRunId) {
    const { data: crRows } = await db
      .from('construct_reliability')
      .select('response_count')
      .eq('calibration_run_id', latestRunId)
      .order('response_count', { ascending: true })
      .limit(1)
    const n = crRows?.[0]?.response_count
    minConstructN = typeof n === 'number' ? n : null
  }

  return {
    totalItems: items.count ?? 0,
    activeItems: activeItems.count ?? 0,
    flaggedItems: flagged.count ?? 0,
    constructCount: constructs.count ?? 0,
    reliableConstructs: reliable.count ?? 0,
    calibrationRuns: calibrationRunsResult.count ?? 0,
    lastCalibrationDate: runs.data?.[0]?.created_at ?? null,
    lastCalibrationSampleSize: runs.data?.[0]?.sample_size ?? null,
    lastCalibrationMinConstructN: minConstructN,
    normGroupCount: norms.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Item health
// ---------------------------------------------------------------------------

export type ItemHealthRow = {
  itemId: string
  stem: string
  constructName: string
  formatType: string
  difficulty: number | null
  discrimination: number | null
  alphaIfDeleted: number | null
  responseCount: number | null
  flagged: boolean
  flagReasons: string[]
}

export async function getItemHealth(): Promise<ItemHealthRow[]> {
  await requireAdminScope()
  const db = createAdminClient()

  // Get the latest calibration run
  const { data: latestRun, error: latestRunError } = await db
    .from('calibration_runs')
    .select('id')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (latestRunError) return []
  if (!latestRun) return []

  const { data: stats, error: statsError } = await db
    .from('item_statistics')
    .select(`
      item_id, difficulty, discrimination, alpha_if_deleted,
      response_count, flagged, flag_reasons,
      items(stem, construct_id, response_format_id,
        constructs(name),
        response_formats(type)
      )
    `)
    .eq('calibration_run_id', latestRun.id)
    .order('flagged', { ascending: false })
    .order('discrimination', { ascending: true })

  if (statsError) {
    throwActionError('getItemHealth', 'Unable to load item health data.', statsError)
  }
  if (!stats) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return stats.map((row: any) => ({
    itemId: row.item_id,
    stem: row.items?.stem ?? '',
    constructName: row.items?.constructs?.name ?? 'Unknown',
    formatType: row.items?.response_formats?.type ?? 'unknown',
    difficulty: row.difficulty != null ? Number(row.difficulty) : null,
    discrimination: row.discrimination != null ? Number(row.discrimination) : null,
    alphaIfDeleted: row.alpha_if_deleted != null ? Number(row.alpha_if_deleted) : null,
    responseCount: row.response_count,
    flagged: row.flagged,
    flagReasons: row.flag_reasons ?? [],
  }))
}

// ---------------------------------------------------------------------------
// Construct reliability
// ---------------------------------------------------------------------------

export type ConstructReliabilityRow = {
  constructId: string
  constructName: string
  cronbachAlpha: number | null
  omegaTotal: number | null
  splitHalf: number | null
  sem: number | null
  itemCount: number | null
  responseCount: number | null
  mean: number | null
  standardDeviation: number | null
}

export async function getConstructReliability(): Promise<ConstructReliabilityRow[]> {
  await requireAdminScope()
  const db = createAdminClient()

  const { data: latestRun, error: latestRunError } = await db
    .from('calibration_runs')
    .select('id')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (latestRunError) return []
  if (!latestRun) return []

  const { data: rows, error: rowsError } = await db
    .from('construct_reliability')
    .select(`
      construct_id, cronbach_alpha, omega_total, split_half,
      sem, item_count, response_count, mean, standard_deviation,
      constructs(name)
    `)
    .eq('calibration_run_id', latestRun.id)
    .order('cronbach_alpha', { ascending: true })

  if (rowsError) {
    throwActionError('getConstructReliability', 'Unable to load construct reliability data.', rowsError)
  }
  if (!rows) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map((row: any) => {
    // This view predates the withholding rule but renders the same numbers, so
    // it has to honour the same threshold. Otherwise the reliability page keeps
    // showing an alpha computed from seven people while the constructs page
    // correctly withholds it.
    const reliabilityVisible =
      determineWithholdingLevel(row.response_count) === 'standard' ||
      determineWithholdingLevel(row.response_count) === 'full'

    return {
      constructId: row.construct_id,
      constructName: row.constructs?.name ?? 'Unknown',
      cronbachAlpha:
        reliabilityVisible && row.cronbach_alpha != null ? Number(row.cronbach_alpha) : null,
      omegaTotal: reliabilityVisible && row.omega_total != null ? Number(row.omega_total) : null,
      splitHalf: reliabilityVisible && row.split_half != null ? Number(row.split_half) : null,
      sem: reliabilityVisible && row.sem != null ? Number(row.sem) : null,
      itemCount: row.item_count,
      responseCount: row.response_count,
      mean: row.mean != null ? Number(row.mean) : null,
      standardDeviation: row.standard_deviation != null ? Number(row.standard_deviation) : null,
    }
  })
}

// ---------------------------------------------------------------------------
// Calibration runs
// ---------------------------------------------------------------------------

export type CalibrationRunRow = {
  id: string
  runType: string
  method: string
  status: string
  sampleSize: number | null
  startedAt: string | null
  completedAt: string | null
  errorMessage: string | null
  notes: string | null
  createdAt: string
}

export async function getCalibrationRuns(): Promise<CalibrationRunRow[]> {
  await requireAdminScope()
  const db = createAdminClient()

  const { data, error } = await db
    .from('calibration_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    throwActionError('getCalibrationRuns', 'Unable to load calibration runs.', error)
  }
  if (!data) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    runType: row.run_type,
    method: row.method,
    status: row.status,
    sampleSize: row.sample_size,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
    notes: row.notes,
    createdAt: row.created_at,
  }))
}

// ---------------------------------------------------------------------------
// Norm groups
// ---------------------------------------------------------------------------

export type NormGroupRow = {
  id: string
  name: string
  description: string | null
  sampleSize: number
  industry: string | null
  roleLevel: string | null
  region: string | null
  isActive: boolean
  lastRefreshed: string | null
  constructCount: number
}

export async function getNormGroups(): Promise<NormGroupRow[]> {
  await requireAdminScope()
  const db = createAdminClient()

  const { data, error } = await db
    .from('norm_groups')
    .select('*, norm_tables(count)')
    .eq('is_active', true)
    .order('sample_size', { ascending: false })

  if (error) {
    throwActionError('getNormGroups', 'Unable to load norm groups.', error)
  }
  if (!data) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    sampleSize: row.sample_size,
    industry: row.industry,
    roleLevel: row.role_level,
    region: row.region,
    isActive: row.is_active,
    lastRefreshed: row.last_refreshed,
    constructCount: row.norm_tables?.[0]?.count ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// Calibration (empirical loop)
// ---------------------------------------------------------------------------

export type CalibrationSummary = {
  runId: string
  sampleSize: number
  constructsCalibrated: number
  constructsSkipped: Array<{ constructId: string; reason: string }>
  constructsUnstable: Array<{ constructId: string; n: number }>
  itemsAnalysed: number
  itemsFlagged: number
  warnings: string[]
}

/**
 * Run a full calibration analysis on all constructs.
 *
 * Fetches participant responses from completed sessions, groups by construct,
 * computes item statistics and construct reliability (CTT only), and persists
 * results to calibration_runs, item_statistics, and construct_reliability.
 *
 * Flow:
 *   1. requireAdminScope() gate
 *   2. Create calibration_runs record with status='running'
 *   3. Fetch participant responses and transform to CalibrationResponseRow[]
 *   4. Call prepareConstructCalibration (pure) to group by construct + filter complete cases
 *   5. For each non-skipped construct:
 *      - Compute item statistics (buildResponseMatrix → computeItemStatistics)
 *      - Compute reliability (calculateReliability, SEM)
 *      - Collect statistics for bulk insert
 *   6. Bulk insert item_statistics and construct_reliability
 *   7. Update calibration_runs with completed status and real sample_size
 *   8. Emit warnings for skipped/unstable constructs
 *   9. Audit log + revalidatePath
 */

/**
 * The scope form supplies plain `YYYY-MM-DD` dates. Compared directly against a
 * timestamptz, a bare date resolves to midnight at the START of that day, so an
 * inclusive-sounding "until 14 Aug" would silently exclude everything collected
 * on the 14th. Widen it to the end of that day. Values that already carry a
 * time component are passed through untouched.
 */
function endOfDayIfDateOnly(value?: string): string | undefined {
  if (!value) return undefined
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value
}

export async function runCalibration(input?: {
  runType?: 'initial' | 'monitoring' | 'recalibration' | 'on_demand'
  since?: string
  until?: string
  notes?: string
  campaignIds?: string[]
  assessmentId?: string
  includeInternal?: boolean
  label?: string
}): Promise<CalibrationSummary> {
  await requireAdminScope()
  const db = createAdminClient()
  const runType = input?.runType ?? 'on_demand'
  const warnings: string[] = []
  let runId = ''

  try {
    // ───────────────────────────────────────────────────────────────────────
    // 1. Create the calibration run record (status='running')
    // ───────────────────────────────────────────────────────────────────────

    const run = await createCalibrationRun(db, {
      runType,
      method: 'ctt_only',
      notes: input?.notes,
      dateRangeStart: input?.since,
      dateRangeEnd: input?.until,
      campaignIds: input?.campaignIds,
      assessmentId: input?.assessmentId,
      includeInternal: input?.includeInternal,
      label: input?.label,
    })
    runId = run.id

    // ───────────────────────────────────────────────────────────────────────
    // 2. Fetch responses via the DAL
    // ───────────────────────────────────────────────────────────────────────
    //
    // The DAL derives each item's maxValue with deriveItemBounds (the same
    // helper the runner scores with). An inline fallback of "5 for likert" would
    // be systematically wrong here: 300 of the live items are on a 6-point
    // frequency scale, and difficulty is mean/maxValue, so every p-value on
    // those items would be inflated.
    const calibrationRows = await fetchCalibrationResponses(db, {
      since: input?.since,
      until: endOfDayIfDateOnly(input?.until),
      campaignIds: input?.campaignIds,
      assessmentId: input?.assessmentId,
      includeInternal: input?.includeInternal ?? false,
    })

    const uniqueSessions = new Set(calibrationRows.map((r) => r.sessionId))

    if (calibrationRows.length === 0) {
      await failCalibrationRun(db, runId, 'No valid responses could be transformed for calibration.')
      return {
        runId,
        sampleSize: 0,
        constructsCalibrated: 0,
        constructsSkipped: [],
        constructsUnstable: [],
        itemsAnalysed: 0,
        itemsFlagged: 0,
        warnings: ['No transformable responses found.'],
      }
    }

    // ───────────────────────────────────────────────────────────────────────
    // 4. Prepare data by construct (pure function)
    // ───────────────────────────────────────────────────────────────────────

    const constructSets = prepareConstructCalibration(calibrationRows)

    const readyConstructSets = constructSets.filter((set) => !set.skipped)
    if (readyConstructSets.length === 0) {
      const skippedReasons = constructSets
        .filter((s) => s.skipped)
        .map((s) => `${s.constructId}: ${s.skipReason}`)
      await failCalibrationRun(
        db,
        runId,
        `All constructs were skipped: ${skippedReasons.join('; ')}`,
      )
      return {
        runId,
        sampleSize: uniqueSessions.size,
        constructsCalibrated: 0,
        constructsSkipped: constructSets
          .filter((s) => s.skipped)
          .map((s) => ({ constructId: s.constructId, reason: s.skipReason || 'Unknown' })),
        constructsUnstable: [],
        itemsAnalysed: 0,
        itemsFlagged: 0,
        warnings: skippedReasons,
      }
    }

    // Log skipped constructs
    for (const set of constructSets) {
      if (set.skipped) {
        warnings.push(`Construct ${set.constructId} skipped: ${set.skipReason}`)
      }
    }

    // ───────────────────────────────────────────────────────────────────────
    // 5. Compute statistics for each ready construct
    // ───────────────────────────────────────────────────────────────────────

    const itemStatsToInsert: CTTItemStatistics[] = []
    const constructStatsToInsert: Parameters<typeof insertConstructReliability>[2] = []
    const constructsSkipped: Array<{ constructId: string; reason: string }> = constructSets
      .filter((s) => s.skipped)
      .map((s) => ({ constructId: s.constructId, reason: s.skipReason || 'Unknown' }))
    const constructsUnstable: Array<{ constructId: string; n: number }> = []
    let totalItemsAnalysed = 0
    let totalItemsFlagged = 0

    for (const set of readyConstructSets) {
      const n = set.completeSessions

      // ─── Compute item statistics ───
      let itemStats: CTTItemStatistics[] = []
      try {
        const matrix = buildResponseMatrix(set.responses)
        itemStats = computeItemStatistics(matrix)

        // Collect item stats for bulk insert
        // Push DTOs — the DAL owns the snake_case mapping.
        itemStatsToInsert.push(...itemStats)
        totalItemsAnalysed += itemStats.length
        totalItemsFlagged += itemStats.filter((stat) => stat.flagged).length
      } catch (itemError) {
        const msg = itemError instanceof Error ? itemError.message : String(itemError)
        constructsSkipped.push({
          constructId: set.constructId,
          reason: `Item statistics failed: ${msg}`,
        })
        continue
      }

      // ─── Compute construct reliability ───
      let cronbachAlpha: number | null = null
      let splitHalf: number | null = null
      let sem: number | null = null
      let mean: number | null = null
      let sd: number | null = null

      try {
        const { cronbachAlpha: alpha, splitHalfReliability: sh } = calculateReliability(set.personByItem)
        cronbachAlpha = alpha
        splitHalf = sh

        // Compute mean and SD of construct scores
        const constructScores = set.personByItem.map((row) => row.reduce((s, v) => s + v, 0))
        if (constructScores.length > 0) {
          const m = constructScores.reduce((s, v) => s + v, 0) / constructScores.length
          mean = m
          const variance = constructScores.reduce((s, v) => s + (v - m) ** 2, 0) / constructScores.length
          sd = Math.sqrt(variance)

          // SEM: sd * sqrt(1 - alpha), guarded against invalid alphas
          if (sd > 0 && cronbachAlpha > 0 && cronbachAlpha <= 1) {
            sem = calculateStandardError(0, cronbachAlpha, sd)
          }
        }
      } catch (reliabilityError) {
        const msg = reliabilityError instanceof Error ? reliabilityError.message : String(reliabilityError)
        constructsSkipped.push({
          constructId: set.constructId,
          reason: `Reliability calculation failed: ${msg}`,
        })
        continue
      }

      // Flag unstable constructs
      if (set.unstable) {
        constructsUnstable.push({ constructId: set.constructId, n })
        warnings.push(
          `Construct ${set.constructId} has n=${n}, below MIN_STABLE_N=${PREP_MIN_STABLE_N}; ` +
            `results are preliminary and not yet trustworthy.`,
        )
      }

      // Build item contributions (discrimination + alpha_if_deleted per item) from this construct's stats
      const itemContributions: Record<string, { discrimination: number; alphaIfDeleted: number }> = {}
      for (const stat of itemStats) {
        itemContributions[stat.itemId] = {
          discrimination: stat.discrimination,
          alphaIfDeleted: stat.alphaIfDeleted,
        }
      }

      constructStatsToInsert.push({
        constructId: set.constructId,
        cronbachAlpha,
        splitHalf,
        sem,
        itemCount: set.itemIds.length,
        responseCount: n,
        mean,
        standardDeviation: sd,
        itemContributions,
      })
    }

    // ───────────────────────────────────────────────────────────────────────
    // 6. Bulk insert statistics
    // ───────────────────────────────────────────────────────────────────────

    await insertItemStatistics(db, runId, itemStatsToInsert)
    await insertConstructReliability(db, runId, constructStatsToInsert)

    // ───────────────────────────────────────────────────────────────────────
    // 7. Mark run as completed
    // ───────────────────────────────────────────────────────────────────────

    await completeCalibrationRun(db, runId, {
      sampleSize: uniqueSessions.size,
      sessionCount: uniqueSessions.size,
    })

    // ───────────────────────────────────────────────────────────────────────
    // 8. Audit log + revalidate
    // ───────────────────────────────────────────────────────────────────────

    await logAuditEvent({
      eventType: 'calibration_run_completed',
      targetTable: 'calibration_runs',
      targetId: runId,
      metadata: {
        sampleSize: uniqueSessions.size,
        constructsCalibrated: constructStatsToInsert.length,
        itemsAnalysed: totalItemsAnalysed,
        itemsFlagged: totalItemsFlagged,
      },
    })

    revalidatePath('/psychometrics')

    return {
      runId,
      sampleSize: uniqueSessions.size,
      constructsCalibrated: constructStatsToInsert.length,
      constructsSkipped,
      constructsUnstable,
      itemsAnalysed: totalItemsAnalysed,
      itemsFlagged: totalItemsFlagged,
      warnings,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (runId) {
      await failCalibrationRun(db, runId, msg)
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Calibration scope preview
// ---------------------------------------------------------------------------

export type CalibrationScopePreview = {
  eligibleSessions: number
  campaigns: Array<{
    id: string
    title: string
    isInternal: boolean
    completedSessions: number
  }>
}

/**
 * Preview the scope of a calibration run: how many sessions would be included
 * with the given scoping criteria, and which campaigns are available.
 */
export async function getCalibrationScopePreview(input?: {
  since?: string
  until?: string
  campaignIds?: string[]
  assessmentId?: string
  includeInternal?: boolean
}): Promise<CalibrationScopePreview> {
  await requireAdminScope()
  const db = createAdminClient()

  const eligibleSessions = await countEligibleSessions(db, {
    since: input?.since,
    until: endOfDayIfDateOnly(input?.until),
    campaignIds: input?.campaignIds,
    assessmentId: input?.assessmentId,
    includeInternal: input?.includeInternal,
  })

  // Fetch all campaigns (or filtered ones if specified) with session counts
  let campaignQuery = db
    .from('campaigns')
    .select('id, title, is_internal')

  if (input?.campaignIds && input.campaignIds.length > 0) {
    campaignQuery = campaignQuery.in('id', input.campaignIds)
  }

  const { data: campaignRows, error: campaignError } = await campaignQuery
    .order('title', { ascending: true })

  if (campaignError) {
    throwActionError('getCalibrationScopePreview', 'Unable to load campaigns.', campaignError)
  }

  const campaigns: CalibrationScopePreview['campaigns'] = []
  if (campaignRows) {
    for (const campaign of campaignRows) {
      const campaignId = String(campaign.id)
      let countQuery = db
        .from('participant_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .eq('campaign_id', campaignId)

      if (!input?.includeInternal) {
        countQuery = countQuery.eq('is_internal', false)
      }

      const { count } = await countQuery

      campaigns.push({
        id: campaignId,
        title: String(campaign.title),
        isInternal: Boolean(campaign.is_internal),
        completedSessions: count ?? 0,
      })
    }
  }

  await logAuditEvent({
    eventType: 'calibration_scope_preview',
    metadata: {
      eligibleSessions,
      campaignCount: campaigns.length,
    },
  })

  return { eligibleSessions, campaigns }
}

// ---------------------------------------------------------------------------
// Calibration run management
// ---------------------------------------------------------------------------

/**
 * List all non-deleted calibration runs.
 */
export async function listCalibrationRunsAction(): Promise<CalibrationRunSummary[]> {
  await requireAdminScope()
  const db = createAdminClient()

  const runs = await listCalibrationRuns(db)

  await logAuditEvent({
    eventType: 'calibration_runs_listed',
    metadata: {
      runCount: runs.length,
    },
  })

  return runs
}

/**
 * Delete a calibration run (soft delete).
 */
export async function deleteCalibrationRun(runId: string): Promise<void> {
  await requireAdminScope()
  const db = createAdminClient()

  await softDeleteCalibrationRun(db, runId)

  await logAuditEvent({
    eventType: 'calibration_run_deleted',
    targetTable: 'calibration_runs',
    targetId: runId,
  })

  revalidatePath('/psychometrics')
}

/**
 * Update the label of a calibration run.
 */
export async function labelCalibrationRun(runId: string, label: string): Promise<void> {
  await requireAdminScope()
  const db = createAdminClient()

  await updateCalibrationRunLabel(db, runId, label)

  await logAuditEvent({
    eventType: 'calibration_run_labeled',
    targetTable: 'calibration_runs',
    targetId: runId,
    metadata: {
      label,
    },
  })

  revalidatePath('/psychometrics')
}

// ---------------------------------------------------------------------------
// Careless Responding Detection
// ---------------------------------------------------------------------------

import {
  detectLongString,
  detectEvenOddInconsistency,
  detectPsychometricAntonyms,
  detectResponseTimeFloor,
  type LongStringResult,
  type EvenOddConsistencyResult,
  type PsychometricAntonymsResult,
  type ResponseTimeFloorResult,
} from '@/lib/scoring/careless'
import {
  insertSessionQualityFlags,
  getSessionQualityFlags,
  countFlaggedByIndex,
} from '@/lib/dal/careless'

export type CarelessFlagsResult = {
  sessionId: string
  longString: LongStringResult | null
  evenOdd: EvenOddConsistencyResult | null
  antonyms: PsychometricAntonymsResult | null
  responseTime: ResponseTimeFloorResult | null
  overallVerdict: boolean
}

export type CarelessSessionSummary = {
  sessionId: string
  participantId: string
  campaignId: string
  overallCarelessVerdict: boolean
  longStringDetected: boolean | null
  evenOddDetected: boolean | null
  antonymsDetected: boolean | null
  timeFloorDetected: boolean | null
  computedAt: string
}

export type CarelessFlagsSummary = {
  totalSessions: number
  flaggedSessions: number
  longStringCount: number
  evenOddCount: number
  antonymsCount: number
  timeFloorCount: number
  flaggedPercentage: number
}

/**
 * Compute careless responding flags for a single session.
 *
 * Fetches session responses, computes four indices (pure functions),
 * and stores results in session_quality_flags table.
 *
 * @param sessionId - Participant session ID
 * @returns Computed indices and overall verdict
 */
export async function computeSessionCarelessFlags(
  sessionId: string
): Promise<CarelessFlagsResult> {
  await requireAdminScope()
  const db = createAdminClient()

  // Fetch session responses with timing and reverse-scoring metadata
  const { data: responses, error: respError } = await db
    .from('participant_responses')
    .select(
      `
      id,
      response_value,
      response_time_ms,
      items!inner(
        id,
        reverse_scored,
        response_format_id,
        response_formats!inner(config, type),
        item_options(value)
      )
      `
    )
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (respError) {
    throwActionError('computeSessionCarelessFlags: fetch responses', 'Failed to fetch session responses', respError)
  }

  if (!responses || responses.length === 0) {
    throwActionError('computeSessionCarelessFlags: empty session', `Session ${sessionId} is empty`, new Error('No responses'))
  }

  // Extract response values, timing, and item metadata
  const responseValues: number[] = []
  const responseTimings: Array<{ value: number; responseTimeMs?: number }> = []
  const itemMetadata: Array<{
    itemId: string
    reverseScored: boolean
    minValue: number
    maxValue: number
  }> = []

  for (const resp of responses) {
    const item = unwrapEmbedded(resp.items)
    const format = unwrapEmbedded(item?.response_formats)

    // response_formats has no max_value column — the bounds live in its config
    // JSONB, and deriveItemBounds is the same helper the scoring runner uses.
    // A hardcoded "5 for likert" fallback would be wrong for the 300 live items
    // on a 6-point scale, and would bias every careless index computed here.
    const optionValues = Array.isArray(item?.item_options)
      ? (item.item_options as Array<{ value?: unknown }>)
          .map((o) => Number(o?.value))
          .filter((v): v is number => Number.isFinite(v))
      : []

    const { minValue, maxValue } = deriveItemBounds(
      (format?.config ?? {}) as Record<string, unknown>,
      optionValues,
      String(format?.type ?? '')
    )

    responseValues.push(resp.response_value ?? 0)
    responseTimings.push({
      value: resp.response_value ?? 0,
      responseTimeMs: resp.response_time_ms ?? undefined,
    })
    itemMetadata.push({
      itemId: String(item?.id ?? ''),
      reverseScored: Boolean(item?.reverse_scored),
      minValue,
      maxValue,
    })
  }

  // Compute indices (pure functions)
  const longString = detectLongString(responseValues)
  const evenOdd = detectEvenOddInconsistency(responseValues)
  const antonyms = detectPsychometricAntonyms(responseValues, itemMetadata)
  const responseTime = detectResponseTimeFloor(responseTimings)

  // Insert flags into DB
  const insertResult = await insertSessionQualityFlags(db, {
    sessionId,
    longString,
    evenOdd,
    antonyms,
    responseTime,
  })

  // The verdict comes back from the DAL, which is where the thresholds live.
  // Recomputing it here duplicated the decision with its own hardcoded numbers
  // and drifted: it still used the pre-correction antonym polarity, so the
  // audit log could record the opposite verdict to the one actually stored.
  const overallVerdict = insertResult.overallCarelessVerdict

  await logAuditEvent({
    eventType: 'careless_flags_computed',
    targetTable: 'session_quality_flags',
    targetId: sessionId,
    metadata: {
      verdict: overallVerdict,
    },
  })

  return {
    sessionId,
    longString,
    evenOdd,
    antonyms,
    responseTime,
    overallVerdict,
  }
}

/**
 * Fetch careless responding flags for a session.
 *
 * @param sessionId - Session ID
 * @returns Flags row from session_quality_flags, or null if not computed
 */
export async function getSessionCarelessFlags(sessionId: string) {
  await requireAdminScope()
  const db = createAdminClient()

  const flags = await getSessionQualityFlags(db, sessionId)

  if (flags) {
    await logAuditEvent({
      eventType: 'careless_flags_fetched',
      targetTable: 'session_quality_flags',
      targetId: sessionId,
    })
  }

  return flags
}

/**
 * List all sessions flagged for careless responding.
 *
 * @param limit - Maximum rows to return (default: 100)
 * @returns Array of flagged session summaries
 */
export async function listCarelessSessions(
  limit = 100
): Promise<CarelessSessionSummary[]> {
  await requireAdminScope()
  const db = createAdminClient()

  // Fetch flagged sessions with participant and campaign info
  const { data: flags, error: flagError } = await db
    .from('session_quality_flags')
    .select(
      `
      session_id,
      overall_careless_verdict,
      long_string_detected,
      even_odd_detected,
      psychometric_antonyms_detected,
      response_time_floor_detected,
      computed_at,
      participant_sessions!inner(
        participant_profile_id,
        campaign_id,
        profiles!inner(id)
      )
      `
    )
    .eq('overall_careless_verdict', true)
    .is('deleted_at', null)
    .order('computed_at', { ascending: false })
    .limit(limit)

  if (flagError) {
    throwActionError('listCarelessSessions: query flags', 'Failed to list careless sessions', flagError)
  }

  if (!flags) {
    return []
  }

  const result: CarelessSessionSummary[] = flags.map((flag) => {
    const session = unwrapEmbedded(flag.participant_sessions)
    return {
      sessionId: String(flag.session_id),
      participantId: String(session?.participant_profile_id ?? ''),
      campaignId: String(session?.campaign_id ?? ''),
      overallCarelessVerdict: flag.overall_careless_verdict,
      longStringDetected: flag.long_string_detected,
      evenOddDetected: flag.even_odd_detected,
      antonymsDetected: flag.psychometric_antonyms_detected,
      timeFloorDetected: flag.response_time_floor_detected,
      computedAt: flag.computed_at,
    }
  })

  await logAuditEvent({
    eventType: 'careless_sessions_listed',
    targetTable: 'session_quality_flags',
    metadata: {
      count: result.length,
    },
  })

  return result
}

/**
 * Get summary statistics on careless flags.
 *
 * @returns Object with counts and percentages
 */
export async function getCarelessFlagsSummary(): Promise<CarelessFlagsSummary> {
  await requireAdminScope()
  const db = createAdminClient()

  const counts = await countFlaggedByIndex(db)

  const { count: totalCount, error: totalError } = await db
    .from('session_quality_flags')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)

  if (totalError) {
    throwActionError('getCarelessFlagsSummary: count sessions', 'Failed to get careless summary', totalError)
  }

  const totalSessions = totalCount ?? 0
  const flaggedPercentage =
    totalSessions > 0 ? (counts.overallCount / totalSessions) * 100 : 0

  await logAuditEvent({
    eventType: 'careless_summary_fetched',
    targetTable: 'session_quality_flags',
    metadata: {
      total: totalSessions,
      flagged: counts.overallCount,
    },
  })

  return {
    totalSessions,
    flaggedSessions: counts.overallCount,
    longStringCount: counts.longStringCount,
    evenOddCount: counts.evenOddCount,
    antonymsCount: counts.antonymsCount,
    timeFloorCount: counts.timeFloorCount,
    flaggedPercentage,
  }
}

// ---------------------------------------------------------------------------
// Pivot Views: Construct-level statistics with threshold-based withholding
// ---------------------------------------------------------------------------

/**
 * Threshold-based withholding rules.
 * n < 5: show nothing but response count
 * 5 ≤ n < 50: distributions, floor/ceiling, careless flags
 * 50 ≤ n < 200: add alpha WITH confidence interval, item-total, alpha-if-deleted
 * n ≥ 200: add IRT, DIF, norms/percentiles
 */
type WithholdingLevel = 'none' | 'minimal' | 'standard' | 'full'

function determineWithholdingLevel(n: number | null): WithholdingLevel {
  if (n === null || n < 5) return 'none'
  if (n < 50) return 'minimal'
  if (n < 200) return 'standard'
  return 'full'
}

export type ConstructStatsRow = {
  constructId: string
  constructName: string
  responseCount: number
  withheldReason: string | null
  cronbachAlpha: number | null
  alphaConfidenceLower: number | null
  alphaConfidenceUpper: number | null
  omegaTotal: number | null
  splitHalf: number | null
  sem: number | null
  itemCount: number | null
  mean: number | null
  standardDeviation: number | null
  skewness: number | null
  kurtosis: number | null
}

/**
 * Get construct-level stats for all constructs in the latest completed run.
 * Implements threshold-based withholding: per-construct n drives visibility.
 */
export async function getConstructStats(): Promise<ConstructStatsRow[]> {
  await requireAdminScope()
  const db = createAdminClient()

  const { data: latestRun, error: latestRunError } = await db
    .from('calibration_runs')
    .select('id')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (latestRunError || !latestRun) return []

  const { data: constructs, error: constructsError } = await db
    .from('construct_reliability')
    .select(`
      construct_id,
      cronbach_alpha,
      omega_total,
      split_half,
      sem,
      item_count,
      response_count,
      mean,
      standard_deviation,
      skewness,
      kurtosis,
      constructs(name)
    `)
    .eq('calibration_run_id', latestRun.id)
    .order('response_count', { ascending: false })

  if (constructsError) {
    throwActionError('getConstructStats', 'Unable to load construct statistics', constructsError)
  }

  if (!constructs) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return constructs.map((row: any) => {
    const n = row.response_count ?? 0
    const level = determineWithholdingLevel(n)
    const alpha = row.cronbach_alpha != null ? Number(row.cronbach_alpha) : null

    // Compute 95% CI for alpha using rule of thumb: SE ≈ (1 - α²) / sqrt(n - 1)
    // Only show for level 'standard' and 'full'
    let alphaConfidenceLower: number | null = null
    let alphaConfidenceUpper: number | null = null
    if (level === 'standard' || level === 'full') {
      if (alpha !== null && n >= 50) {
        const se = Math.sqrt((1 - alpha * alpha) / (n - 1))
        alphaConfidenceLower = Math.max(-1, alpha - 1.96 * se)
        alphaConfidenceUpper = Math.min(1, alpha + 1.96 * se)
      }
    }

    // Reliability statistics require n >= 50. Below that alpha is not merely
    // imprecise, it is unstable enough to come out negative by chance, which is
    // why the rule is to WITHHOLD it rather than caption it. Returning it at
    // n >= 5 would reinstate exactly the "provisional alpha" this replaced.
    const reliabilityVisible = level === 'standard' || level === 'full'
    // Distribution shape is descriptive and readable from a small sample, so it
    // is available one tier earlier.
    const distributionVisible = level !== 'none'

    let withheldReason: string | null = null
    if (level === 'none') {
      withheldReason = `n = ${n} — nothing is computable below 5 responses`
    } else if (!reliabilityVisible) {
      withheldReason = `n = ${n} — reliability needs 50+ responses; distributions shown`
    }

    return {
      constructId: row.construct_id,
      constructName: row.constructs?.name ?? 'Unknown',
      responseCount: n,
      withheldReason,
      cronbachAlpha: reliabilityVisible ? alpha : null,
      alphaConfidenceLower: reliabilityVisible ? alphaConfidenceLower : null,
      alphaConfidenceUpper: reliabilityVisible ? alphaConfidenceUpper : null,
      omegaTotal: reliabilityVisible ? (row.omega_total != null ? Number(row.omega_total) : null) : null,
      splitHalf: reliabilityVisible ? (row.split_half != null ? Number(row.split_half) : null) : null,
      sem: reliabilityVisible ? (row.sem != null ? Number(row.sem) : null) : null,
      itemCount: row.item_count,
      mean: distributionVisible ? (row.mean != null ? Number(row.mean) : null) : null,
      standardDeviation: distributionVisible ? (row.standard_deviation != null ? Number(row.standard_deviation) : null) : null,
      skewness: distributionVisible ? (row.skewness != null ? Number(row.skewness) : null) : null,
      kurtosis: distributionVisible ? (row.kurtosis != null ? Number(row.kurtosis) : null) : null,
    }
  })
}

export type ItemWithThresholdRow = {
  itemId: string
  stem: string
  constructName: string
  formatType: string
  responseCount: number
  withheldReason: string | null
  difficulty: number | null
  discrimination: number | null
  alphaIfDeleted: number | null
  flagged: boolean
  flagReasons: string[]
  reverseScored: boolean
  hasOptions: boolean
  responseDistribution: Record<number, number>
}

/**
 * Get item health with distractor analysis, applying threshold-based withholding.
 * Per-item response count drives visibility.
 */
export async function getItemHealthWithThresholds(): Promise<ItemWithThresholdRow[]> {
  await requireAdminScope()
  const db = createAdminClient()

  const items = await (await import('@/lib/dal/calibration')).getItemsWithDistractors(db)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return items.map((item: any) => {
    const n = item.responseCount ?? 0
    const level = determineWithholdingLevel(n)

    let withheldReason: string | null = null
    if (level === 'none') {
      withheldReason = `n = ${n} (minimum 5 required)`
    }

    return {
      itemId: item.itemId,
      stem: item.stem,
      constructName: item.constructName,
      formatType: item.formatType,
      responseCount: n,
      withheldReason,
      difficulty: level !== 'none' ? item.difficulty : null,
      discrimination: level !== 'none' ? item.discrimination : null,
      alphaIfDeleted: level === 'standard' || level === 'full' ? item.alphaIfDeleted : null,
      flagged: item.flagged,
      flagReasons: item.flagReasons,
      reverseScored: item.reverseScored,
      hasOptions: item.hasOptions,
      responseDistribution: level !== 'none' ? item.responseDistribution : {},
    }
  })
}

export type HistoricalConstructStatRow = {
  runId: string
  runLabel: string | null
  runCreatedAt: string
  responseCount: number
  withheldReason: string | null
  cronbachAlpha: number | null
  discrimination: number | null
}

/**
 * Get historical construct stats across the last N runs.
 * Shows alpha and discrimination trends over time.
 */
export async function getConstructHistoricalTrends(
  constructId: string,
  limit: number = 10,
): Promise<HistoricalConstructStatRow[]> {
  await requireAdminScope()
  const db = createAdminClient()

  const historicalRows = await (await import('@/lib/dal/calibration')).getConstructHistoricalStats(
    db,
    constructId,
    limit,
  )

  return historicalRows.map((row) => {
    const level = determineWithholdingLevel(row.responseCount)
    // Alpha over time is still alpha: it needs n >= 50 per run, or the trend
    // line is drawn through points that are mostly sampling noise.
    const reliabilityVisible = level === 'standard' || level === 'full'
    let withheldReason: string | null = null
    if (level === 'none') {
      withheldReason = `n = ${row.responseCount} — nothing computable below 5`
    } else if (!reliabilityVisible) {
      withheldReason = `n = ${row.responseCount} — alpha needs 50+`
    }

    return {
      runId: row.runId,
      runLabel: row.runLabel,
      runCreatedAt: row.runCreatedAt,
      responseCount: row.responseCount,
      withheldReason,
      cronbachAlpha: reliabilityVisible ? row.cronbachAlpha : null,
      discrimination: level !== 'none' ? row.discrimination : null,
    }
  })
}

export type RunComparisonRow = {
  runId: string
  runLabel: string | null
  runCreatedAt: string
  method: string
  sampleSize: number | null
  constructCount: number
  itemsAnalyzed: number
  itemsFlagged: number
}

/**
 * Get metadata for the latest two completed runs for comparison view.
 */
export async function getLatestTwoRuns(): Promise<RunComparisonRow[]> {
  await requireAdminScope()
  const db = createAdminClient()

  const { data: runs, error: runsError } = await db
    .from('calibration_runs')
    .select('id, label, created_at, method, sample_size')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(2)

  if (runsError) {
    throwActionError('getLatestTwoRuns', 'Unable to load calibration runs', runsError)
  }

  if (!runs || runs.length === 0) return []

  // Fetch stats for each run
  const results: RunComparisonRow[] = []

  for (const run of runs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runId = (run as any).id

    const [constructs, items, flagged] = await Promise.all([
      db.from('construct_reliability').select('*', { count: 'exact', head: true }).eq('calibration_run_id', runId),
      db.from('item_statistics').select('*', { count: 'exact', head: true }).eq('calibration_run_id', runId),
      db
        .from('item_statistics')
        .select('*', { count: 'exact', head: true })
        .eq('calibration_run_id', runId)
        .eq('flagged', true),
    ])

    results.push({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runId: (run as any).id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runLabel: (run as any).label,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runCreatedAt: (run as any).created_at,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      method: (run as any).method ?? 'unknown',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sampleSize: (run as any).sample_size,
      constructCount: constructs.count ?? 0,
      itemsAnalyzed: items.count ?? 0,
      itemsFlagged: flagged.count ?? 0,
    })
  }

  return results
}

