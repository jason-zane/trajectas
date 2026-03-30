/**
 * Model resolver — single source of truth for "which model handles this task."
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { AIPromptPurpose } from '@/types/database'

export interface TaskModelConfig {
  purpose: AIPromptPurpose
  modelId: string
  config: { temperature?: number; max_tokens?: number }
}

export class AIModelConfigError extends Error {
  constructor(
    public readonly purpose: AIPromptPurpose,
    message = `No AI model is configured for "${purpose}".`,
  ) {
    super(message)
    this.name = 'AIModelConfigError'
  }
}

/**
 * Returns the configured model and settings for a given AI task purpose.
 */
export async function getModelForTask(purpose: AIPromptPurpose): Promise<TaskModelConfig> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ai_model_configs')
    .select('purpose, model_id, config')
    .eq('purpose', purpose)
    .single()

  if (error || !data?.model_id) {
    throw new AIModelConfigError(
      purpose,
      error?.message ?? `No AI model is configured for "${purpose}".`,
    )
  }

  return {
    purpose,
    modelId: data.model_id as string,
    config: (data.config as TaskModelConfig['config']) ?? {},
  }
}
