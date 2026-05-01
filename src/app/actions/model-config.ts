'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { openRouterProvider } from '@/lib/ai/providers/openrouter'
import type { AIPromptPurpose } from '@/types/database'
import {
  aiPromptPurposeSchema,
  applyModelToAllPurposesSchema,
  updateModelForPurposeSchema,
} from '@/lib/validations/model-config'

export interface ModelConfigRow {
  id: string
  purpose: AIPromptPurpose
  modelId: string
  displayName: string
  providerName: string
  config: { temperature?: number; max_tokens?: number }
  updatedAt: string
}

/**
 * Returns all ai_model_configs rows that have a purpose set,
 * joined with the provider name.
 */
export async function getModelConfigs(): Promise<ModelConfigRow[]> {
  await requireAdminScope()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('ai_model_configs')
    .select('id, purpose, model_id, display_name, config, updated_at, ai_providers(name)')
    .not('purpose', 'is', null)
    .order('purpose')

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: row.id as string,
    purpose: row.purpose as AIPromptPurpose,
    modelId: row.model_id as string,
    displayName: row.display_name as string,
    providerName: (row.ai_providers as unknown as { name: string } | null)?.name ?? 'Unknown',
    config: (row.config as { temperature?: number; max_tokens?: number }) ?? {},
    updatedAt: row.updated_at as string,
  }))
}

export async function getModelConfigForPurpose(
  purpose: AIPromptPurpose,
): Promise<ModelConfigRow | null> {
  const parsed = aiPromptPurposeSchema.safeParse(purpose)
  if (!parsed.success) return null
  await requireAdminScope()
  const configs = await getModelConfigs()
  return configs.find((config) => config.purpose === purpose) ?? null
}

export async function getModelSelectionBootstrap(): Promise<{
  configuredModels: Partial<Record<AIPromptPurpose, string>>
  textModels: Awaited<ReturnType<typeof openRouterProvider.listModels>>
  embeddingModels: Awaited<ReturnType<typeof openRouterProvider.listModels>>
}> {
  await requireAdminScope()
  const [configs, textModels, embeddingModels] = await Promise.all([
    getModelConfigs(),
    openRouterProvider.listModels('text'),
    openRouterProvider.listModels('embeddings'),
  ])

  return {
    configuredModels: Object.fromEntries(
      configs.map((config) => [config.purpose, config.modelId]),
    ) as Partial<Record<AIPromptPurpose, string>>,
    textModels,
    embeddingModels,
  }
}

/**
 * Returns just the model ID for a given purpose. Lightweight helper for
 * client components that only need to seed a default value.
 */
export async function getDefaultModelIdForPurpose(
  purpose: AIPromptPurpose,
): Promise<string | null> {
  const parsed = aiPromptPurposeSchema.safeParse(purpose)
  if (!parsed.success) return null
  await requireAdminScope()
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('ai_model_configs')
    .select('model_id')
    .eq('purpose', purpose)
    .single()

  return (data?.model_id as string | undefined) ?? null
}

/** All non-embedding purposes that the global selector applies to. */
const TEXT_PURPOSES: AIPromptPurpose[] = [
  'chat',
  'item_generation',
  'factor_item_generation',
  'library_import_structuring',
  'preflight_analysis',
  'competency_matching',
  'ranking_explanation',
  'diagnostic_analysis',
  'report_narrative',
  'report_strengths_analysis',
  'report_development_advice',
]

/**
 * Applies the same model to all non-embedding purposes in one operation.
 */
export async function applyModelToAllPurposes(
  modelId: string,
): Promise<{ success: true } | { error: string }> {
  const parsed = applyModelToAllPurposesSchema.safeParse({ modelId })
  if (!parsed.success) return { error: 'Invalid model ID' }
  const scope = await requireAdminScope()
  const supabase = createAdminClient()

  const { data: provider, error: providerError } = await supabase
    .from('ai_providers')
    .select('id')
    .eq('name', 'OpenRouter')
    .single()

  if (providerError || !provider) {
    return { error: 'OpenRouter provider not found in database' }
  }

  // Upsert all text purposes in parallel
  const results = await Promise.all(
    TEXT_PURPOSES.map(async (purpose) => {
      const { data: existing } = await supabase
        .from('ai_model_configs')
        .select('id, config')
        .eq('purpose', purpose)
        .maybeSingle()

      const payload = {
        provider_id: provider.id as string,
        purpose,
        model_id: modelId,
        display_name: modelId,
        is_default: false,
        config: (existing?.config as { temperature?: number; max_tokens?: number } | null) ?? {},
      }

      return existing?.id
        ? supabase.from('ai_model_configs').update(payload).eq('id', existing.id as string)
        : supabase.from('ai_model_configs').insert(payload)
    }),
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: failed.error.message }

  revalidatePath('/settings/ai')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'ai_model.bulk_updated',
    targetTable: 'ai_model_configs',
    targetId: null,
    metadata: { modelId, purposes: TEXT_PURPOSES },
  })
  return { success: true }
}

/**
 * Updates or inserts the model_id for a given purpose.
 */
export async function updateModelForPurpose(
  purpose: AIPromptPurpose,
  modelId: string,
  config?: { temperature?: number; max_tokens?: number },
): Promise<{ success: true } | { error: string }> {
  const parsed = updateModelForPurposeSchema.safeParse({ purpose, modelId, config })
  if (!parsed.success) return { error: 'Invalid input' }
  const scope = await requireAdminScope()
  const supabase = createAdminClient()

  // Look up the OpenRouter provider id
  const { data: provider, error: providerError } = await supabase
    .from('ai_providers')
    .select('id')
    .eq('name', 'OpenRouter')
    .single()

  if (providerError || !provider) {
    return { error: 'OpenRouter provider not found in database' }
  }

  const { data: existing } = await supabase
    .from('ai_model_configs')
    .select('id, config')
    .eq('purpose', purpose)
    .maybeSingle()

  const nextConfig =
    config ??
    ((existing?.config as { temperature?: number; max_tokens?: number } | null) ?? {})

  const payload = {
    provider_id: provider.id as string,
    purpose,
    model_id: modelId,
    display_name: modelId, // use model id as display name; label shown in UI comes from OpenRouter model list
    is_default: false,
    config: nextConfig,
  }

  const { error } = existing?.id
    ? await supabase
        .from('ai_model_configs')
        .update(payload)
        .eq('id', existing.id as string)
    : await supabase
        .from('ai_model_configs')
        .insert(payload)

  if (error) return { error: error.message }

  revalidatePath('/settings/ai')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'ai_model.updated',
    targetTable: 'ai_model_configs',
    targetId: existing?.id ? String(existing.id) : null,
    metadata: {
      purpose,
      modelId,
      config: nextConfig,
    },
  })
  return { success: true }
}
