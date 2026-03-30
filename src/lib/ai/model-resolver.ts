/**
 * model-resolver.ts
 *
 * Resolves the correct model ID and config for a given AI task purpose.
 * Reads from ai_model_configs (is_default = true, purpose = X).
 * Falls back to hardcoded defaults when the DB has no config for a purpose.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import type { AIPromptPurpose } from '@/types/database'

const FALLBACK_MODELS: Record<AIPromptPurpose, { model: string; temperature: number; maxTokens: number }> = {
  competency_matching:  { model: 'anthropic/claude-sonnet-4-5', temperature: 0.3,  maxTokens: 4096 },
  ranking_explanation:  { model: 'google/gemini-2.0-flash-001', temperature: 0.5,  maxTokens: 2048 },
  diagnostic_analysis:  { model: 'anthropic/claude-sonnet-4-5', temperature: 0.3,  maxTokens: 4096 },
  item_generation:      { model: 'anthropic/claude-sonnet-4-5', temperature: 0.8,  maxTokens: 4096 },
  preflight_analysis:   { model: 'anthropic/claude-sonnet-4-5', temperature: 0.3,  maxTokens: 2048 },
}

export interface ModelConfig {
  model: string
  temperature: number
  maxTokens: number
}

/**
 * Returns the model + config to use for a given task purpose.
 * Queries ai_model_configs for a row where purpose = X and is_default = true.
 * Falls back to FALLBACK_MODELS on DB error or missing row.
 */
export async function getModelForTask(purpose: AIPromptPurpose): Promise<ModelConfig> {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('ai_model_configs')
      .select('model_id, config')
      .eq('purpose', purpose)
      .eq('is_default', true)
      .limit(1)
      .single()

    if (error || !data) return FALLBACK_MODELS[purpose]

    const config = data.config as { temperature?: number; max_tokens?: number } | null
    return {
      model:       data.model_id,
      temperature: config?.temperature ?? FALLBACK_MODELS[purpose].temperature,
      maxTokens:   config?.max_tokens  ?? FALLBACK_MODELS[purpose].maxTokens,
    }
  } catch {
    return FALLBACK_MODELS[purpose]
  }
}
