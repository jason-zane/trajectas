'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope, resolveAuthorizedScope } from '@/lib/auth/authorization'

export type MatchingRunWithMeta = {
  id: string
  organizationId: string
  organizationName: string
  diagnosticSessionId: string
  sessionTitle: string
  status: string
  resultCount: number
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  created_at: string
}

export type WorkspaceMatchingRecommendation = {
  factorName: string
  rank: number
  relevanceScore: number
  reasoning?: string
  incrementalValue?: number
}

export type WorkspaceMatchingRunWithMeta = MatchingRunWithMeta & {
  recommendations: WorkspaceMatchingRecommendation[]
}

function getRelatedRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0]
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null
  }

  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getRelatedCount(value: unknown) {
  const record = getRelatedRecord(value)
  return record?.count ? Number(record.count) : 0
}

export async function getMatchingRuns(): Promise<MatchingRunWithMeta[]> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('matching_runs')
    .select('*, organizations(name), diagnostic_sessions(title), matching_results(count)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organizations?.name ?? '',
    diagnosticSessionId: row.diagnostic_session_id,
    sessionTitle: row.diagnostic_sessions?.title ?? '',
    status: row.status,
    resultCount: row.matching_results?.[0]?.count ?? 0,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    errorMessage: row.error_message ?? undefined,
    created_at: row.created_at,
  }))
}

export async function getWorkspaceMatchingRuns(): Promise<WorkspaceMatchingRunWithMeta[]> {
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin && scope.clientIds.length === 0) {
    return []
  }

  const db = createAdminClient()
  let query = db
    .from('matching_runs')
    .select('*, organizations(name), diagnostic_sessions(title), matching_results(count)')
    .order('created_at', { ascending: false })

  if (!scope.isPlatformAdmin) {
    query = query.in('organization_id', scope.clientIds)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const runIds = (data ?? []).map((row) => String(row.id))
  const recommendationsByRun = new Map<string, WorkspaceMatchingRecommendation[]>()

  if (runIds.length > 0) {
    const { data: recommendationRows, error: recommendationsError } = await db
      .from('matching_results')
      .select('matching_run_id, rank, relevance_score, reasoning, incremental_value, factors(name)')
      .in('matching_run_id', runIds)
      .order('rank', { ascending: true })

    if (recommendationsError) {
      throw new Error(recommendationsError.message)
    }

    for (const row of recommendationRows ?? []) {
      const runId = String(row.matching_run_id)
      const list = recommendationsByRun.get(runId) ?? []
      if (list.length >= 3) {
        continue
      }

      const factorRow = getRelatedRecord(row.factors)
      const factor = factorRow?.name ? String(factorRow.name) : 'Unnamed factor'

      list.push({
        factorName: factor,
        rank: Number(row.rank),
        relevanceScore: Number(row.relevance_score ?? 0),
        reasoning: row.reasoning ? String(row.reasoning) : undefined,
        incrementalValue:
          row.incremental_value !== null && row.incremental_value !== undefined
            ? Number(row.incremental_value)
            : undefined,
      })

      recommendationsByRun.set(runId, list)
    }
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const organizationRow = getRelatedRecord(row.organizations)
    const sessionRow = getRelatedRecord(row.diagnostic_sessions)

    return {
      id: String(row.id),
      organizationId: String(row.organization_id),
      organizationName: organizationRow?.name ? String(organizationRow.name) : '',
      diagnosticSessionId: String(row.diagnostic_session_id),
      sessionTitle: sessionRow?.title ? String(sessionRow.title) : '',
      status: String(row.status),
      resultCount: getRelatedCount(row.matching_results),
      startedAt: row.started_at ? String(row.started_at) : undefined,
      completedAt: row.completed_at ? String(row.completed_at) : undefined,
      errorMessage: row.error_message ? String(row.error_message) : undefined,
      created_at: String(row.created_at),
      recommendations: recommendationsByRun.get(String(row.id)) ?? [],
    }
  })
}

export type SelectOption = { id: string; name: string }

export async function getOrganizationsForMatchingSelect(): Promise<SelectOption[]> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('organizations')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getSessionsForMatchingSelect(organizationId?: string): Promise<{ id: string; title: string }[]> {
  await requireAdminScope()
  const db = createAdminClient()
  let query = db
    .from('diagnostic_sessions')
    .select('id, title')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}
