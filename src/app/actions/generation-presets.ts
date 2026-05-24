'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import type { GenerationPreset, PresetExemplar } from '@/types/database'
import { presetWriteSchema, type PresetWriteInput } from '@/lib/validations/generation'

// =============================================================================
// Row mapping
// =============================================================================

interface PresetRow {
  id: string
  name: string
  description: string | null
  measurement_mode: GenerationPreset['measurementMode']
  measurement_mode_description: string | null
  audience: Record<string, unknown> | null
  use_context: GenerationPreset['useContext']
  use_context_description: string | null
  response_format_id: string | null
  response_format_rationale: string | null
  rubric: string | null
  exemplars: PresetExemplar[] | null
  critique_emphasis: string | null
  sd_tolerance: GenerationPreset['sdTolerance'] | null
  difficulty_mix: GenerationPreset['difficultyMix'] | null
  critique_strictness: GenerationPreset['critiqueStrictness']
  pipeline_defaults: GenerationPreset['pipelineDefaults'] | null
  recommended_target_per_construct: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  created_by: string | null
}

function mapPresetRow(row: PresetRow): GenerationPreset {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    measurementMode: row.measurement_mode,
    measurementModeDescription: row.measurement_mode_description ?? undefined,
    audience: (row.audience ?? {}) as GenerationPreset['audience'],
    useContext: row.use_context,
    useContextDescription: row.use_context_description ?? undefined,
    responseFormatId: row.response_format_id ?? undefined,
    responseFormatRationale: row.response_format_rationale ?? undefined,
    rubric: row.rubric ?? undefined,
    exemplars: row.exemplars ?? [],
    critiqueEmphasis: row.critique_emphasis ?? undefined,
    sdTolerance: row.sd_tolerance ?? undefined,
    difficultyMix: row.difficulty_mix ?? undefined,
    critiqueStrictness: row.critique_strictness,
    pipelineDefaults: row.pipeline_defaults ?? {},
    recommendedTargetPerConstruct: row.recommended_target_per_construct,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
    createdBy: row.created_by ?? undefined,
  }
}

function presetToRow(input: PresetWriteInput): Record<string, unknown> {
  return {
    name: input.name,
    description: input.description ?? null,
    measurement_mode: input.measurementMode,
    measurement_mode_description: input.measurementModeDescription ?? null,
    audience: input.audience,
    use_context: input.useContext,
    use_context_description: input.useContextDescription ?? null,
    response_format_id: input.responseFormatId ?? null,
    response_format_rationale: input.responseFormatRationale ?? null,
    rubric: input.rubric ?? null,
    exemplars: input.exemplars,
    critique_emphasis: input.critiqueEmphasis ?? null,
    sd_tolerance: input.sdTolerance ?? null,
    difficulty_mix: input.difficultyMix ?? null,
    critique_strictness: input.critiqueStrictness,
    pipeline_defaults: input.pipelineDefaults,
    recommended_target_per_construct: input.recommendedTargetPerConstruct,
  }
}

// =============================================================================
// Reads
// =============================================================================

export async function listGenerationPresets(): Promise<GenerationPreset[]> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('generation_presets')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[generation-presets] list failed', error)
    return []
  }
  return (data as PresetRow[]).map(mapPresetRow)
}

export async function getGenerationPreset(
  id: string,
): Promise<GenerationPreset | null> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('generation_presets')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('[generation-presets] get failed', error)
    return null
  }
  return data ? mapPresetRow(data as PresetRow) : null
}

// =============================================================================
// Writes
// =============================================================================

export interface PresetMutationResult {
  ok: boolean
  preset?: GenerationPreset
  errors?: Record<string, string[]>
  message?: string
}

export async function createGenerationPreset(
  input: PresetWriteInput,
): Promise<PresetMutationResult> {
  const scope = await requireAdminScope()
  const parsed = presetWriteSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors,
      message: 'Validation failed',
    }
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('generation_presets')
    .insert({
      ...presetToRow(parsed.data),
      created_by: scope.actor?.id ?? null,
    })
    .select('*')
    .single()

  if (error) {
    return { ok: false, message: error.message }
  }

  revalidatePath('/generate/presets')
  return { ok: true, preset: mapPresetRow(data as PresetRow) }
}

export async function updateGenerationPreset(
  id: string,
  input: PresetWriteInput,
): Promise<PresetMutationResult> {
  await requireAdminScope()
  const parsed = presetWriteSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors,
      message: 'Validation failed',
    }
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('generation_presets')
    .update(presetToRow(parsed.data))
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error) {
    return { ok: false, message: error.message }
  }

  revalidatePath('/generate/presets')
  revalidatePath(`/generate/presets/${id}`)
  return { ok: true, preset: mapPresetRow(data as PresetRow) }
}

export async function deleteGenerationPreset(id: string): Promise<PresetMutationResult> {
  await requireAdminScope()
  const db = createAdminClient()
  const { error } = await db
    .from('generation_presets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) {
    return { ok: false, message: error.message }
  }

  revalidatePath('/generate/presets')
  return { ok: true }
}

export async function duplicateGenerationPreset(
  id: string,
): Promise<PresetMutationResult> {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const { data: original, error: readErr } = await db
    .from('generation_presets')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (readErr || !original) {
    return { ok: false, message: 'Original preset not found' }
  }

  const o = original as PresetRow
  const { data, error } = await db
    .from('generation_presets')
    .insert({
      name: `${o.name} (copy)`,
      description: o.description,
      measurement_mode: o.measurement_mode,
      measurement_mode_description: o.measurement_mode_description,
      audience: o.audience,
      use_context: o.use_context,
      use_context_description: o.use_context_description,
      response_format_id: o.response_format_id,
      response_format_rationale: o.response_format_rationale,
      rubric: o.rubric,
      exemplars: o.exemplars,
      critique_emphasis: o.critique_emphasis,
      sd_tolerance: o.sd_tolerance,
      difficulty_mix: o.difficulty_mix,
      critique_strictness: o.critique_strictness,
      pipeline_defaults: o.pipeline_defaults,
      recommended_target_per_construct: o.recommended_target_per_construct,
      created_by: scope.actor?.id ?? null,
    })
    .select('*')
    .single()

  if (error) {
    return { ok: false, message: error.message }
  }

  revalidatePath('/generate/presets')
  return { ok: true, preset: mapPresetRow(data as PresetRow) }
}

// =============================================================================
// Helper for the generation kickoff — resolves a preset into a PlaybookSnapshot
// =============================================================================

export async function resolvePresetSnapshot(
  presetId: string | undefined,
): Promise<GenerationPreset | null> {
  if (!presetId) return null
  return getGenerationPreset(presetId)
}
