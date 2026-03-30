'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { openRouterProvider } from '@/lib/ai/providers/openrouter'
import type { AIPromptPurpose } from '@/types/database'

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
  const configs = await getModelConfigs()
  return configs.find((config) => config.purpose === purpose) ?? null
}

export async function getModelSelectionBootstrap(): Promise<{
  configuredModels: Partial<Record<AIPromptPurpose, string>>
  textModels: Awaited<ReturnType<typeof openRouterProvider.listModels>>
  embeddingModels: Awaited<ReturnType<typeof openRouterProvider.listModels>>
}> {
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
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('ai_model_configs')
    .select('model_id')
    .eq('purpose', purpose)
    .single()

  return (data?.model_id as string | undefined) ?? null
}

/**
 * Updates or inserts the model_id for a given purpose.
 */
export async function updateModelForPurpose(
  purpose: AIPromptPurpose,
  modelId: string,
  config?: { temperature?: number; max_tokens?: number },
): Promise<{ success: true } | { error: string }> {
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

  revalidatePath('/settings/models')
  return { success: true }
}
