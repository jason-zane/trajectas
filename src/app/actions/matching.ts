'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdminScope, resolveAuthorizedScope } from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'

export type MatchingRunWithMeta = {
  id: string
  clientId: string
  clientName: string
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
  const db = await createClient()
  const { data, error } = await db
    .from('matching_runs')
    .select('*, clients(name), diagnostic_sessions(name), matching_results(count)')
    .order('created_at', { ascending: false })

  if (error) {
    throwActionError('getMatchingRuns', 'Unable to load matching runs.', error)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? '',
    diagnosticSessionId: row.diagnostic_session_id,
    sessionTitle: row.diagnostic_sessions?.title ?? row.diagnostic_sessions?.name ?? '',
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

  const db = await createClient()
  let query = db
    .from('matching_runs')
    .select('*, clients(name), diagnostic_sessions(name), matching_results(count)')
    .order('created_at', { ascending: false })

  if (!scope.isPlatformAdmin) {
    query = query.in('client_id', scope.clientIds)
  }

  const { data, error } = await query
  if (error) {
    throwActionError(
      'getWorkspaceMatchingRuns',
      'Unable to load matching runs.',
      error
    )
  }

  const runIds = (data ?? []).map((row) => String(row.id))
  const recommendationsByRun = new Map<string, WorkspaceMatchingRecommendation[]>()

  if (runIds.length > 0) {
    const { data: recommendationRows, error: recommendationsError } = await db
      .from('matching_results')
      .select('matching_run_id, rank, relevance_score, reasoning, incremental_value, factors(name)')
      .in('matching_run_id', runIds)
      .order('rank', { ascending: true })

    if (recommendationsError) {
      throwActionError(
        'getWorkspaceMatchingRuns.recommendations',
        'Unable to load matching runs.',
        recommendationsError
      )
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
    const clientRow = getRelatedRecord(row.clients)
    const sessionRow = getRelatedRecord(row.diagnostic_sessions)

    return {
      id: String(row.id),
      clientId: String(row.client_id),
      clientName: clientRow?.name ? String(clientRow.name) : '',
      diagnosticSessionId: String(row.diagnostic_session_id),
      sessionTitle: sessionRow?.name ? String(sessionRow.name) : '',
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

export async function getClientsForMatchingSelect(): Promise<SelectOption[]> {
  await requireAdminScope()
  const db = await createClient()
  const { data, error } = await db
    .from('clients')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    throwActionError(
      'getClientsForMatchingSelect',
      'Unable to load clients.',
      error
    )
  }
  return data ?? []
}

export async function getSessionsForMatchingSelect(clientId?: string): Promise<{ id: string; title: string }[]> {
  await requireAdminScope()
  const db = await createClient()
  let query = db
    .from('diagnostic_sessions')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query
  if (error) {
    throwActionError(
      'getSessionsForMatchingSelect',
      'Unable to load diagnostic sessions.',
      error
    )
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    title:
      typeof row.title === 'string' && row.title.trim().length > 0
        ? row.title
        : typeof row.name === 'string' && row.name.trim().length > 0
          ? row.name
          : 'Untitled session',
  }))
}
