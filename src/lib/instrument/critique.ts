/**
 * critique.ts — Second-pass LLM review of candidate items.
 *
 * Critique is a tier-2 quality gate: after generation and dedupe, each item is reviewed
 * for construct fit, contrast avoidance, and measurement-mode alignment.
 *
 * Response contract (seeded in production):
 * { "verdict": "keep" | "revise" | "drop", "reason": "...", "revisedStem": null }
 *
 * This module is defensive: a single item's provider call failing does not fail the batch.
 * Malformed responses are logged and skipped gracefully.
 */

'use server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getModelForTask } from '@/lib/ai/model-config'
import { getActiveSystemPrompt } from '@/lib/ai/prompt-config'
import { openRouterProvider } from '@/lib/ai/providers/openrouter'
import { listCandidateItemsByBlueprint, updateCandidateItem } from '@/lib/dal/instrument'
import { mapWithConcurrency, DEFAULT_CONCURRENCY } from '@/lib/instrument/concurrency'
import type { InstrumentCandidateItemDto } from '@/lib/dal/instrument-mappers'
import type { Audience, MeasurementMode, UseContext } from '@/types/database'

/**
 * Single item critique from the LLM.
 */
export interface ItemCritiqueResult {
  itemId: string
  stem: string
  verdict: 'keep' | 'revise' | 'drop'
  reason?: string
}

/**
 * Full batch critique result.
 */
export interface CritiqueBatchResult {
  results: ItemCritiqueResult[]
  stats: {
    totalItems: number
    kept: number
    revised: number
    dropped: number
    failedParses: number
    providerErrors: number
  }
}

/**
 * Build the critique prompt for a single item, matching the seeded system prompt contract.
 *
 * Input: construct info + measurement mode / audience context.
 * Output: a prompt asking the LLM to judge the item against those constraints.
 */
function buildItemCritiquePrompt(
  item: InstrumentCandidateItemDto,
  constructName: string,
  constructDefinition?: string,
  constructDescription?: string,
  constructIndicatorsLow?: string,
  constructIndicatorsMid?: string,
  constructIndicatorsHigh?: string,
  contrastConstructs?: string[],
  measurementMode?: MeasurementMode,
  measurementModeDescription?: string,
  audience?: Audience,
  useContext?: UseContext,
  useContextDescription?: string,
): string {
  const constructSection = [
    `## Target Construct: ${constructName}`,
    constructDefinition ? `Definition: ${constructDefinition}` : null,
    constructDescription ? `Description: ${constructDescription}` : null,
    constructIndicatorsLow ? `Low scorers: ${constructIndicatorsLow}` : null,
    constructIndicatorsMid ? `Mid scorers: ${constructIndicatorsMid}` : null,
    constructIndicatorsHigh ? `High scorers: ${constructIndicatorsHigh}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const contrastSection = contrastConstructs?.length
    ? `\n## Contrast Constructs (item should NOT fit these):\n${contrastConstructs.map((c) => `- ${c}`).join('\n')}`
    : ''

  const contextSection = [
    measurementMode ? `**Measurement Mode**: ${measurementMode}${measurementModeDescription ? ` — ${measurementModeDescription}` : ''}` : null,
    audience ? `**Audience**: ${JSON.stringify(audience)}` : null,
    useContext ? `**Use Context**: ${useContext}${useContextDescription ? ` — ${useContextDescription}` : ''}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return `Review the following item for construct fit and measurement alignment.

${constructSection}
${contrastSection}

${contextSection ? contextSection + '\n\n' : ''}## Item to Review

"${item.stem}" (${item.reverseScored ? 'reverse-scored' : 'positively-scored'})

Respond with a JSON object:
{ "verdict": "keep|revise|drop", "reason": "one sentence explaining your decision", "revisedStem": null }`
}

/**
 * Parse critique response. Tolerant: returns null on any parse error (logged),
 * and callers skip that item rather than fail the batch.
 *
 * Expected shape: { "verdict": "keep|revise|drop", "reason": "...", "revisedStem": null }
 */
export function parseCritiqueResponse(
  jsonContent: string,
): { verdict: 'keep' | 'revise' | 'drop'; reason?: string } | null {
  try {
    const cleaned = jsonContent
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim()

    const parsed = JSON.parse(cleaned) as unknown

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }

    const obj = parsed as Record<string, unknown>
    const verdict = obj.verdict as unknown

    if (
      typeof verdict !== 'string' ||
      !['keep', 'revise', 'drop'].includes(verdict)
    ) {
      return null
    }

    return {
      verdict: verdict as 'keep' | 'revise' | 'drop',
      reason: typeof obj.reason === 'string' ? obj.reason : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Run critique pass on all candidate items in a blueprint.
 *
 * Uses getActiveSystemPrompt('instrument_critique') if available,
 * otherwise falls back to a generic prompt. Fails if model cannot be resolved.
 *
 * Partial failures (one item's provider call fails) do not fail the batch.
 */
export async function runCritiquePass(
  db: SupabaseClient,
  blueprintId: string,
  constructName: string,
  options?: {
    constructDefinition?: string
    constructDescription?: string
    constructIndicatorsLow?: string
    constructIndicatorsMid?: string
    constructIndicatorsHigh?: string
    contrastConstructs?: string[]
    measurementMode?: MeasurementMode
    measurementModeDescription?: string
    audience?: Audience
    useContext?: UseContext
    useContextDescription?: string
  },
): Promise<CritiqueBatchResult> {
  const items = await listCandidateItemsByBlueprint(db, blueprintId)

  // Resolve model and system prompt
  let systemPrompt: string | null = null
  try {
    const promptConfig = await getActiveSystemPrompt('instrument_critique')
    systemPrompt = promptConfig.content
  } catch {
    // Fall back to inline prompt if not seeded
    systemPrompt = null
  }

  const modelConfig = await getModelForTask('item_critique')
  const model = modelConfig.modelId

  if (!model) {
    throw new Error('No model configured for instrument_critique task')
  }

  // Run critique on each item with bounded concurrency
  const critiqueResults = await mapWithConcurrency(
    items,
    DEFAULT_CONCURRENCY,
    async (item) => {
      const prompt = buildItemCritiquePrompt(
        item,
        constructName,
        options?.constructDefinition,
        options?.constructDescription,
        options?.constructIndicatorsLow,
        options?.constructIndicatorsMid,
        options?.constructIndicatorsHigh,
        options?.contrastConstructs,
        options?.measurementMode,
        options?.measurementModeDescription,
        options?.audience,
        options?.useContext,
        options?.useContextDescription,
      )

      try {
        const response = await openRouterProvider.complete({
          model,
          systemPrompt: systemPrompt || undefined,
          prompt,
          temperature: 0.3,
          maxTokens: 1024,
          responseFormat: 'json',
        })

        const parsed = parseCritiqueResponse(response.content)
        if (!parsed) {
          console.warn(`Critique: malformed response for item ${item.id}`)
          return { ok: false, error: new Error('Malformed response'), itemId: item.id }
        }

        // Persist verdict and reason
        try {
          await updateCandidateItem(db, item.id, {
            critiqueVerdict: parsed.verdict,
            critiqueReason: parsed.reason || null,
          })
        } catch (persistError) {
          console.error(`Critique: failed to persist verdict for item ${item.id}:`, persistError)
          return { ok: false, error: persistError, itemId: item.id }
        }

        return {
          ok: true,
          itemId: item.id,
          stem: item.stem,
          verdict: parsed.verdict,
          reason: parsed.reason,
        }
      } catch (error) {
        console.error(`Critique: provider error for item ${item.id}:`, error)
        return { ok: false, error, itemId: item.id }
      }
    },
  )

  // Aggregate results
  const results: ItemCritiqueResult[] = []
  let kept = 0
  let revised = 0
  let dropped = 0
  let failedParses = 0
  let providerErrors = 0

  for (const result of critiqueResults) {
    if (!result.ok) {
      if (result.error instanceof Error && result.error.message === 'Malformed response') {
        failedParses++
      } else {
        providerErrors++
      }
      continue
    }

    // result is a success result with itemId, stem, verdict, reason
    const successResult = result as unknown as ItemCritiqueResult
    results.push(successResult)

    if (successResult.verdict === 'keep') kept++
    else if (successResult.verdict === 'revise') revised++
    else if (successResult.verdict === 'drop') dropped++
  }

  return {
    results,
    stats: {
      totalItems: items.length,
      kept,
      revised,
      dropped,
      failedParses,
      providerErrors,
    },
  }
}

/**
 * Clear all critique marks on a blueprint's items (for rollback).
 */
export async function clearCritiqueMarks(
  db: SupabaseClient,
  blueprintId: string,
): Promise<void> {
  const items = await listCandidateItemsByBlueprint(db, blueprintId)
  const clearResults = await mapWithConcurrency(
    items,
    DEFAULT_CONCURRENCY,
    async (item) => {
      try {
        await updateCandidateItem(db, item.id, {
          critiqueVerdict: null,
          critiqueReason: null,
        })
      } catch (error) {
        console.error(`Critique clear: failed for ${item.id}:`, error)
        throw error
      }
    },
  )

  const failedClears = clearResults.filter((r) => !r.ok).length
  if (failedClears > 0) {
    console.warn(`Critique clear: ${failedClears} of ${items.length} items failed to clear`)
  }
}
