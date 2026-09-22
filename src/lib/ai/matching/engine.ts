/**
 * Competency-matching engine — routing, plus the original LLM pipeline.
 *
 * Two engines answer the same contract:
 *
 * - **Jev** (`typesafe/…` model id, brief sources only): a decision model
 *   scores every outcome-eligible factor independently. The seniority level is
 *   a soft penalty here, not a filter, so a factor the library did not tag for
 *   this level can still be picked when the role genuinely calls for it.
 * - **LLM** (everything else): one completion ranks a level-filtered pool.
 *
 * Which one runs is the `competency_matching` model id — no env var, no flag
 * table. Any Jev failure falls through to the LLM engine with
 * `fallback_model_id`, so the switch is safe to flip and safe to leave.
 */

import type {
  AIProviderType,
  AssessmentLevel,
  MatchingInput,
  MatchingOutput,
} from '@/types/ai'
import { ResponseParseError } from '@/types/ai'
import { getProvider, getDefaultProvider } from '@/lib/ai/providers'
import { getActiveSystemPrompt } from '@/lib/ai/prompt-config'
import {
  buildMatchingPrompt,
  isValidRankingsPayload,
  PROMPT_VERSION,
} from '@/lib/ai/prompts/competency-matching'
import { getModelForTask, type TaskModelConfig } from '@/lib/ai/model-config'
import { isJevModelId } from '@/lib/ai/model-ids'
import { logActionError } from '@/lib/security/action-errors'
import { runJevMatching } from './jev-engine'
import { runRankingExplanation } from './ranking-explanation'
import type { JevRankingConfig } from './jev-ranking'

export interface MatchingOptions {
  /** Explicit provider type. Falls back to the first available provider. */
  providerId?: AIProviderType
  /** Override the model (reserved for future per-request model selection). */
  modelId?: string
  /** Reserved for future prompt-version routing. */
  promptVersion?: number
}

/** `MatchingOutput` plus the two diagnostics the Architect surfaces. */
export type MatchingRunOutput = MatchingOutput & {
  engine?: 'jev' | 'llm'
  resolvedLevel?: AssessmentLevel
}

const DEFAULT_FALLBACK_MODEL_ID = 'anthropic/claude-sonnet-4-5'
const DEFAULT_REASONS_COUNT = 8

/**
 * Run the competency-matching pipeline end-to-end.
 */
export async function runMatching(
  input: MatchingInput,
  options: MatchingOptions = {},
): Promise<MatchingRunOutput> {
  const taskConfig = await getModelForTask('competency_matching')
  const configuredModelId = options.modelId ?? taskConfig.modelId
  const knobs = readJevKnobs(taskConfig.config)

  if (isJevModelId(configuredModelId)) {
    if (input.source.kind === 'brief') {
      try {
        return await runJevPath(input, input.source, configuredModelId, knobs)
      } catch (error) {
        logActionError('matching.jev', error)
      }
    }
    // Diagnostic sources never reach Jev, and a Jev failure lands here too.
    return runLlmMatching(input, options, knobs.fallbackModelId, taskConfig)
  }

  return runLlmMatching(input, options, configuredModelId, taskConfig)
}

/** Jev ranking, then the (non-fatal) LLM reasons stage merged on top. */
async function runJevPath(
  input: MatchingInput,
  source: Extract<MatchingInput['source'], { kind: 'brief' }>,
  modelId: string,
  knobs: JevKnobs,
): Promise<MatchingRunOutput> {
  const output = await runJevMatching(
    { source, availableFactors: input.availableFactors },
    { modelId, config: knobs.ranking },
  )

  const definitionById = new Map(
    input.availableFactors.map((f) => [f.id, f.definition]),
  )
  const picks = output.rankings.slice(0, knobs.reasonsCount).map((r) => ({
    factorId: r.factorId,
    factorName: r.factorName,
    definition: definitionById.get(r.factorId) ?? '',
    relevanceScore: r.relevanceScore,
  }))

  const explanation = await runRankingExplanation({ brief: source.brief, picks })

  return {
    ...output,
    rankings: output.rankings.map((r) => ({
      ...r,
      reasoning: explanation.reasons[r.factorId] ?? r.reasoning,
    })),
    summary: explanation.summary ?? output.summary,
    usage: {
      inputTokens: (output.usage?.inputTokens ?? 0) + explanation.usage.inputTokens,
      outputTokens: (output.usage?.outputTokens ?? 0) + explanation.usage.outputTokens,
    },
    engine: 'jev',
  }
}

/** The original single-completion pipeline, over a hard level-filtered pool. */
async function runLlmMatching(
  input: MatchingInput,
  options: MatchingOptions,
  modelId: string,
  taskConfig: TaskModelConfig,
): Promise<MatchingRunOutput> {
  const filtered = applyLevelFilter(input)

  if (filtered.availableFactors.length === 0) {
    return {
      rankings: [],
      summary: 'No eligible factors matched this brief.',
      recommendedCount: { minimum: 0, optimal: 0, maximum: 0 },
      usage: { inputTokens: 0, outputTokens: 0 },
      modelUsed: modelId,
      promptVersion: PROMPT_VERSION,
      engine: 'llm',
    }
  }

  const provider = options.providerId
    ? getProvider(options.providerId)
    : await getDefaultProvider()

  const prompt = await getActiveSystemPrompt('competency_matching')
  const { user } = buildMatchingPrompt(filtered)

  const response = await provider.complete({
    prompt: user,
    systemPrompt: prompt.content,
    model: modelId,
    temperature: taskConfig.config.temperature ?? 0.3,
    maxTokens: taskConfig.config.max_tokens ?? 4096,
    responseFormat: 'json',
  })

  const parsed = parseJsonResponse(response.content)

  if (!isValidRankingsPayload(parsed)) {
    throw new ResponseParseError(
      'AI response does not conform to the expected rankings schema.',
    )
  }

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
    promptVersion: prompt.version ?? PROMPT_VERSION,
    usage: response.usage,
    engine: 'llm',
  }
}

/**
 * The LLM engine's hard level filter. An empty `applicableLevels` means the
 * factor applies everywhere. Diagnostic sources have no level to filter on.
 */
function applyLevelFilter(input: MatchingInput): MatchingInput {
  if (input.source.kind !== 'brief') return input
  const level = input.source.brief.level
  return {
    ...input,
    availableFactors: input.availableFactors.filter((f) => {
      const levels = f.applicableLevels ?? []
      return levels.length === 0 || levels.includes(level)
    }),
  }
}

interface JevKnobs {
  ranking: Partial<JevRankingConfig>
  reasonsCount: number
  fallbackModelId: string
}

/**
 * Read the optional Jev knobs off the model row's `config` JSON.
 *
 * The settings UI strips unknown keys, so these are set by SQL when set at
 * all — everything is validated and anything unusable is ignored in favour of
 * the code default.
 */
function readJevKnobs(config: TaskModelConfig['config']): JevKnobs {
  const raw = (config ?? {}) as Record<string, unknown>
  const ranking: Partial<JevRankingConfig> = {}

  const gate = finiteNumber(raw.level_confidence_gate)
  if (gate !== null && gate >= 0 && gate <= 1) ranking.levelConfidenceGate = gate

  const penalty = finiteNumber(raw.level_penalty)
  if (penalty !== null && penalty >= 0) ranking.levelPenalty = penalty

  if (typeof raw.rerank === 'boolean') ranking.rerank = raw.rerank

  const shortlist = finiteNumber(raw.shortlist_size)
  if (shortlist !== null && shortlist >= 1) ranking.shortlistSize = Math.floor(shortlist)

  const reasons = finiteNumber(raw.reasons_count)
  const fallback = typeof raw.fallback_model_id === 'string' ? raw.fallback_model_id.trim() : ''

  return {
    ranking,
    reasonsCount: reasons !== null && reasons >= 0 ? Math.floor(reasons) : DEFAULT_REASONS_COUNT,
    fallbackModelId: fallback.length > 0 ? fallback : DEFAULT_FALLBACK_MODEL_ID,
  }
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Parse JSON from AI response, tolerating fences and prose/reasoning wrappers. */
function parseJsonResponse(content: string): unknown {
  let cleaned = content.trim()
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  }

  try {
    return JSON.parse(cleaned)
  } catch (error) {
    // Fallback: some models (esp. reasoning models) prepend a <think> block or
    // prose around the JSON. Extract the outermost { ... } object and retry.
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        // fall through to the error below
      }
    }
    throw new ResponseParseError(
      `Content is not valid JSON: ${cleaned.slice(0, 200)}...`,
      error,
    )
  }
}
