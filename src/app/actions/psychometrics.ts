'use server'

import { requireAdminScope } from '@/lib/auth/authorization'
import { createAdminClient } from '@/lib/supabase/admin'

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

  const { data: latestRun } = await db
    .from('calibration_runs')
    .select('id')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!latestRun) return []

  const { data: stats } = await db
    .from('item_statistics')
    .select('item_id, difficulty, discrimination, flagged')
    .eq('calibration_run_id', latestRun.id)

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

  const { data: latestRun } = await db
    .from('calibration_runs')
    .select('id')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!latestRun) return []

  const { data: rows } = await db
    .from('construct_reliability')
    .select('construct_id, cronbach_alpha')
    .eq('calibration_run_id', latestRun.id)

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
  normGroupCount: number
}

export async function getPsychometricOverview(): Promise<PsychometricOverview> {
  await requireAdminScope()
  const db = createAdminClient()

  const [items, activeItems, flagged, constructs, reliable, runs, norms] =
    await Promise.all([
      db.from('items').select('*', { count: 'exact', head: true }),
      db.from('items').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('item_statistics').select('*', { count: 'exact', head: true }).eq('flagged', true),
      db.from('constructs').select('*', { count: 'exact', head: true }).eq('is_active', true),
      db.from('construct_reliability').select('*', { count: 'exact', head: true }).gte('cronbach_alpha', 0.7),
      db.from('calibration_runs').select('created_at').order('created_at', { ascending: false }).limit(1),
      db.from('norm_groups').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ])

  return {
    totalItems: items.count ?? 0,
    activeItems: activeItems.count ?? 0,
    flaggedItems: flagged.count ?? 0,
    constructCount: constructs.count ?? 0,
    reliableConstructs: reliable.count ?? 0,
    calibrationRuns: (await db.from('calibration_runs').select('*', { count: 'exact', head: true })).count ?? 0,
    lastCalibrationDate: runs.data?.[0]?.created_at ?? null,
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
  const { data: latestRun } = await db
    .from('calibration_runs')
    .select('id')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!latestRun) return []

  const { data: stats } = await db
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

  const { data: latestRun } = await db
    .from('calibration_runs')
    .select('id')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!latestRun) return []

  const { data: rows } = await db
    .from('construct_reliability')
    .select(`
      construct_id, cronbach_alpha, omega_total, split_half,
      sem, item_count, response_count, mean, standard_deviation,
      constructs(name)
    `)
    .eq('calibration_run_id', latestRun.id)
    .order('cronbach_alpha', { ascending: true })

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

  const { data } = await db
    .from('calibration_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

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

  const { data } = await db
    .from('norm_groups')
    .select('*, norm_tables(count)')
    .eq('is_active', true)
    .order('sample_size', { ascending: false })

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
