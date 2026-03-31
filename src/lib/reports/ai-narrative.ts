// =============================================================================
// src/lib/reports/ai-narrative.ts
// Optional AI narrative enhancement via OpenRouter.
// Called when narrative_mode === 'ai_enhanced' on the snapshot.
// Falls back to derived narrative if prompt is unavailable or call fails.
// =============================================================================

import { getActiveSystemPrompt } from '@/lib/ai/prompt-config'
import { OpenRouterProvider } from '@/lib/ai/providers/openrouter'
import { getModelForTask } from '@/lib/ai/model-config'
import { resolvePersonToken } from './narrative'
import type { PersonReferenceType } from '@/types/database'

export interface AIEnhanceInput {
  entityName: string
  derivedNarrative: string
  pompScore: number
  bandLabel: string
  personReference: PersonReferenceType
  firstName?: string
}

/**
 * Enhance a derived narrative paragraph using OpenRouter.
 * Returns the derived narrative unchanged if the prompt is unavailable
 * or if the AI call fails — this must never throw.
 */
export async function enhanceNarrative(input: AIEnhanceInput): Promise<string> {
  try {
    const prompt = await getActiveSystemPrompt('report_narrative')
    const taskConfig = await getModelForTask('item_generation')  // reuse same model tier
    const model = taskConfig.modelId

    const userMessage = [
      `Entity: ${input.entityName}`,
      `POMP Score: ${input.pompScore} (${input.bandLabel})`,
      `Derived narrative to enhance:`,
      input.derivedNarrative,
    ].join('\n')

    const provider = new OpenRouterProvider()
    const response = await provider.complete({
      model,
      systemPrompt: prompt.content,
      prompt: userMessage,
    })

    const text = response.content
    if (!text || text.trim().length < 10) {
      return input.derivedNarrative
    }

    return resolvePersonToken(text.trim(), input.personReference, input.firstName)
  } catch (err) {
    console.error('[ai-narrative] Enhancement failed — falling back to derived:', err)
    return input.derivedNarrative
  }
}
