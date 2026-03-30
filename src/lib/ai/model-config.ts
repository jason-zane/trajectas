/**
 * Model resolver — single source of truth for "which model handles this task."
 *
 * Reads from ai_model_configs in Supabase. Falls back to hardcoded defaults
 * if the DB is unavailable or no row is found for the requested purpose.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { AIPromptPurpose } from '@/types/database'

export interface TaskModelConfig {
  modelId: string
  config: { temperature?: number; max_tokens?: number }
}

const DEFAULTS: Record<AIPromptPurpose, TaskModelConfig> = {
  item_generation: {
    modelId: 'anthropic/claude-sonnet-4-5',
    config: { temperature: 0.8, max_tokens: 4096 },
  },
  preflight_analysis: {
    modelId: 'anthropic/claude-sonnet-4-5',
    config: { temperature: 0.5, max_tokens: 2048 },
  },
  embedding: {
    modelId: 'openai/text-embedding-3-small',
    config: {},
  },
  competency_matching: {
    modelId: 'anthropic/claude-sonnet-4-5',
    config: { temperature: 0.3, max_tokens: 4096 },
  },
  ranking_explanation: {
    modelId: 'anthropic/claude-sonnet-4-5',
    config: { temperature: 0.5, max_tokens: 2048 },
  },
  diagnostic_analysis: {
    modelId: 'anthropic/claude-sonnet-4-5',
    config: { temperature: 0.5, max_tokens: 4096 },
  },
}

/**
 * Returns the configured model and settings for a given AI task purpose.
 * Falls back to hardcoded defaults on any DB error.
 */
export async function getModelForTask(purpose: AIPromptPurpose): Promise<TaskModelConfig> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('ai_model_configs')
      .select('model_id, config')
      .eq('purpose', purpose)
      .single()

    if (error || !data) return DEFAULTS[purpose]

    return {
      modelId: data.model_id as string,
      config: (data.config as TaskModelConfig['config']) ?? {},
    }
  } catch {
    return DEFAULTS[purpose]
  }
}
