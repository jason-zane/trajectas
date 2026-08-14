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
      db.from('calibration_runs').select('created_at, sample_size').order('created_at', { ascending: false }).limit(1),
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

  return {
    totalItems: items.count ?? 0,
    activeItems: activeItems.count ?? 0,
    flaggedItems: flagged.count ?? 0,
    constructCount: constructs.count ?? 0,
    reliableConstructs: reliable.count ?? 0,
    calibrationRuns: calibrationRunsResult.count ?? 0,
    lastCalibrationDate: runs.data?.[0]?.created_at ?? null,
    lastCalibrationSampleSize: runs.data?.[0]?.sample_size ?? null,
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
  return rows.map((row: any) => ({
    constructId: row.construct_id,
    constructName: row.constructs?.name ?? 'Unknown',
    cronbachAlpha: row.cronbach_alpha != null ? Number(row.cronbach_alpha) : null,
    omegaTotal: row.omega_total != null ? Number(row.omega_total) : null,
    splitHalf: row.split_half != null ? Number(row.split_half) : null,
    sem: row.sem != null ? Number(row.sem) : null,
    itemCount: row.item_count,
    responseCount: row.response_count,
    mean: row.mean != null ? Number(row.mean) : null,
    standardDeviation: row.standard_deviation != null ? Number(row.standard_deviation) : null,
  }))
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
export async function runCalibration(input?: {
  runType?: 'initial' | 'monitoring' | 'recalibration' | 'on_demand'
  since?: string
  until?: string
  notes?: string
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
      until: input?.until,
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

    await completeCalibrationRun(db, runId, { sampleSize: uniqueSessions.size })

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

