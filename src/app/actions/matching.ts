'use server'

import { createAdminClient } from '@/lib/supabase/admin'

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

export async function getMatchingRuns(): Promise<MatchingRunWithMeta[]> {
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

export type SelectOption = { id: string; name: string }

export async function getOrganizationsForMatchingSelect(): Promise<SelectOption[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('organizations')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getSessionsForMatchingSelect(organizationId?: string): Promise<{ id: string; title: string }[]> {
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
