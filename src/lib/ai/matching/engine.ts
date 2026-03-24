/**
 * Competency-matching engine.
 *
 * Orchestrates the full pipeline: resolve provider, build prompt,
 * call AI, parse response, return structured output.
 */

import type { AIProviderType, MatchingInput, MatchingOutput } from '@/types/ai'
import { ResponseParseError } from '@/types/ai'
import { getProvider, getDefaultProvider } from '@/lib/ai/providers'
import {
  buildMatchingPrompt,
  isValidRankingsPayload,
  PROMPT_VERSION,
} from '@/lib/ai/prompts/competency-matching'

export interface MatchingOptions {
  /** Explicit provider type. Falls back to the first available provider. */
  providerId?: AIProviderType
  /** Override the model (reserved for future per-request model selection). */
  modelId?: string
  /** Reserved for future prompt-version routing. */
  promptVersion?: number
}

/**
 * Run the competency-matching pipeline end-to-end.
 */
export async function runMatching(
  input: MatchingInput,
  options: MatchingOptions = {},
): Promise<MatchingOutput> {
  // 1. Resolve provider
  const provider = options.providerId
    ? getProvider(options.providerId)
    : await getDefaultProvider()

  // 2. Build prompt
  const { system, user } = buildMatchingPrompt(input)

  // 3. Call provider
  const response = await provider.complete({
    prompt: user,
    systemPrompt: system,
    temperature: 0.3,
    maxTokens: 4096,
    responseFormat: 'json',
  })

  // 4. Parse and validate
  const parsed = parseJsonResponse(response.content)

  if (!isValidRankingsPayload(parsed)) {
    throw new ResponseParseError(
      'AI response does not conform to the expected rankings schema.',
    )
  }

  // 5. Assemble output
  return {
    rankings: parsed.rankings.map((r, i) => ({
      ...r,
      rank: r.rank ?? i + 1,
      cumulativeValue: r.cumulativeValue ?? 0,
    })),
    summary: parsed.summary,
    recommendedCount: parsed.recommendedCount ?? {
      minimum: Math.min(3, parsed.rankings.length),
      optimal: Math.min(7, parsed.rankings.length),
      maximum: parsed.rankings.length,
    },
    modelUsed: response.model,
    promptVersion: PROMPT_VERSION,
  }
}

/** Parse JSON from AI response, stripping markdown fences if present. */
function parseJsonResponse(content: string): unknown {
  let cleaned = content.trim()
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  }

  try {
    return JSON.parse(cleaned)
  } catch (error) {
    throw new ResponseParseError(
      `Content is not valid JSON: ${cleaned.slice(0, 200)}...`,
      error,
    )
  }
}
