'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
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

/**
 * Returns just the model ID for a given purpose. Lightweight helper for
 * client components that only need to seed a default value.
 */
export async function getDefaultModelIdForPurpose(purpose: AIPromptPurpose): Promise<string> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('ai_model_configs')
    .select('model_id')
    .eq('purpose', purpose)
    .single()

  return (data?.model_id as string | undefined) ?? 'anthropic/claude-sonnet-4-5'
}

/**
 * Updates the model_id (and optional config JSONB) for a given purpose.
 */
export async function updateModelForPurpose(
  purpose: AIPromptPurpose,
  modelId: string,
  config?: { temperature?: number; max_tokens?: number },
): Promise<{ success: true } | { error: string }> {
  const supabase = createAdminClient()

  const updatePayload: Record<string, unknown> = { model_id: modelId }
  if (config !== undefined) {
    updatePayload.config = config
  }

  const { error } = await supabase
    .from('ai_model_configs')
    .update(updatePayload)
    .eq('purpose', purpose)

  if (error) return { error: error.message }

  revalidatePath('/settings/models')
  return { success: true }
}
