import 'server-only'
import { mapInstrumentStageRunRow } from './instrument-mappers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseLikertFormat, type LikertFormat, type LikertState, LIKERT_STEP, LEASE_MS } from '@/lib/instrument/likert/contracts'

export async function listLikertFormats(db: SupabaseClient): Promise<LikertFormat[]> {
  const { data, error } = await db.from('response_formats').select('id,name,type,config,is_active').eq('type', 'likert').eq('is_active', true).order('name')
  if (error) throw error
  return (data ?? []).flatMap(row => { try { return [parseLikertFormat(row)] } catch { return [] } })
}

export async function likertSpecSnapshot(db: SupabaseClient, buildId: string): Promise<Record<string, unknown>> {
  const { data, error } = await db.rpc('instrument_likert_spec_snapshot', { p_build_id: buildId })
  if (error) throw error
  return data
}

/** Expiry only releases a lease; the commit RPC fences a delayed worker. */
export async function expireLikertStep(db: SupabaseClient, buildId: string): Promise<void> {
  const { error } = await db.from('instrument_stage_runs').update({ status: 'failure', completed_at: new Date().toISOString(), error_message: 'Step lease expired; resumable from last checkpoint.' })
    .eq('build_id', buildId).eq('stage_key', LIKERT_STEP).eq('status', 'running').lt('started_at', new Date(Date.now() - LEASE_MS).toISOString())
  if (error) throw error
}

export async function commitLikertStep(db: SupabaseClient, input: {
  jobId: string; stepId: string; revision: number; expectedSpec: Record<string, unknown>; state: LikertState
  cells?: Record<string, unknown>; candidates?: Record<string, unknown>[]; buildStatus?: string; output?: Record<string, unknown>
}): Promise<void> {
  const { error } = await db.rpc('commit_instrument_likert_step', {
    p_job_id: input.jobId, p_step_id: input.stepId, p_revision: input.revision, p_expected_spec: input.expectedSpec,
    p_state: input.state, p_cells: input.cells ?? null, p_candidates: input.candidates ?? [], p_build_status: input.buildStatus ?? null, p_output: input.output ?? {},
  })
  if (error) throw new Error(error.message)
}

/** Resolve linked boundary definitions instead of passing UUIDs to a model. */
export async function loadLikertBoundaryDefinitions(db: SupabaseClient, ids: string[]): Promise<Array<{ id: string; name: string; definition: string }>> {
  if (!ids.length) return []
  const { data, error } = await db.from('constructs').select('id,name,definition').in('id', [...new Set(ids)]).is('deleted_at', null)
  if (error) throw error
  return (data ?? []).map(row => ({ id: row.id, name: row.name, definition: row.definition ?? '' }))
}

/** The execution path loads one checkpoint; raw historical reviews are exported separately. */
export async function latestLikertJob(db: SupabaseClient, buildId: string) {
  const { data, error } = await db.from('instrument_stage_runs').select('*').eq('build_id', buildId).eq('stage_key', 'autonomous_likert').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data ? mapInstrumentStageRunRow(data) : null
}
