import { createAdminClient } from '@/lib/supabase/admin'
import type { AIPromptPurpose } from '@/types/database'

export interface ActiveSystemPrompt {
  id: string
  name: string
  purpose: AIPromptPurpose
  content: string
  version: number
}

export class AISystemPromptError extends Error {
  constructor(
    public readonly purpose: AIPromptPurpose,
    message = `No active system prompt is configured for "${purpose}".`,
  ) {
    super(message)
    this.name = 'AISystemPromptError'
  }
}

export async function getActiveSystemPrompt(
  purpose: AIPromptPurpose,
): Promise<ActiveSystemPrompt> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('ai_system_prompts')
    .select('id, name, purpose, content, version')
    .eq('purpose', purpose)
    .eq('is_active', true)
    .single()

  if (error || !data?.content) {
    throw new AISystemPromptError(
      purpose,
      error?.message ?? `No active system prompt is configured for "${purpose}".`,
    )
  }

  return {
    id: data.id as string,
    name: data.name as string,
    purpose,
    content: data.content as string,
    version: data.version as number,
  }
}
