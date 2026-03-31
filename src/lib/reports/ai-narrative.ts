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

// ---------------------------------------------------------------------------
// Strengths analysis — cohesive narrative about top strengths
// ---------------------------------------------------------------------------

export interface StrengthsAnalysisInput {
  highlights: { name: string; pompScore: number; bandLabel: string; definition?: string }[]
  personReference: PersonReferenceType
  firstName?: string
}

/**
 * Generate a synthesised narrative about the participant's top strengths.
 * Returns null on failure — never throws.
 */
export async function generateStrengthsAnalysis(
  input: StrengthsAnalysisInput,
): Promise<string | null> {
  try {
    const prompt = await getActiveSystemPrompt('report_strengths_analysis')
    const taskConfig = await getModelForTask('report_strengths_analysis')
    const model = taskConfig.modelId

    const userMessage = JSON.stringify(
      input.highlights.map((h) => ({
        name: h.name,
        pompScore: h.pompScore,
        bandLabel: h.bandLabel,
        definition: h.definition ?? null,
      })),
    )

    const provider = new OpenRouterProvider()
    const response = await provider.complete({
      model,
      systemPrompt: prompt.content,
      prompt: userMessage,
    })

    const text = response.content
    if (!text || text.trim().length < 10) return null

    return resolvePersonToken(text.trim(), input.personReference, input.firstName)
  } catch (err) {
    console.error('[ai-narrative] Strengths analysis failed:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Development advice — per-entity AI recommendations
// ---------------------------------------------------------------------------

export interface DevelopmentAdviceInput {
  items: {
    name: string
    pompScore: number
    bandLabel: string
    definition?: string
    existingSuggestion?: string | null
  }[]
  personReference: PersonReferenceType
  firstName?: string
}

/**
 * Generate contextual development recommendations for each entity.
 * Returns a map of entityName → aiSuggestion, or null on failure.
 */
export async function generateDevelopmentAdvice(
  input: DevelopmentAdviceInput,
): Promise<{ entityName: string; aiSuggestion: string }[] | null> {
  try {
    const prompt = await getActiveSystemPrompt('report_development_advice')
    const taskConfig = await getModelForTask('report_development_advice')
    const model = taskConfig.modelId

    const userMessage = JSON.stringify(
      input.items.map((item) => ({
        name: item.name,
        pompScore: item.pompScore,
        bandLabel: item.bandLabel,
        definition: item.definition ?? null,
        existingSuggestion: item.existingSuggestion ?? null,
      })),
    )

    const provider = new OpenRouterProvider()
    const response = await provider.complete({
      model,
      systemPrompt: prompt.content,
      prompt: userMessage,
    })

    const text = response.content
    if (!text || text.trim().length < 5) return null

    const parsed = JSON.parse(text.trim())
    if (!Array.isArray(parsed)) return null

    return parsed
      .filter(
        (item: unknown): item is { entityName: string; aiSuggestion: string } =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>).entityName === 'string' &&
          typeof (item as Record<string, unknown>).aiSuggestion === 'string',
      )
      .map((item) => ({
        entityName: item.entityName,
        aiSuggestion: resolvePersonToken(
          item.aiSuggestion,
          input.personReference,
          input.firstName,
        ),
      }))
  } catch (err) {
    console.error('[ai-narrative] Development advice failed:', err)
    return null
  }
}
