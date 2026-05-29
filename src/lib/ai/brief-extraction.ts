/**
 * Brief extraction — the Architect's first AI stage.
 *
 * Reads free text about a role (pasted, uploaded, or typed) plus the decision
 * the user is making, and produces a structured `Brief` the matcher consumes.
 *
 * Mirrors the shape of the competency-matching engine: resolve provider +
 * model, build prompt, call AI, parse + validate structured output.
 */

import type {
  AIProviderType,
  AssessmentLevel,
  AssessmentOutcome,
  Brief,
} from '@/types/ai'
import { ResponseParseError } from '@/types/ai'
import { getProvider, getDefaultProvider } from '@/lib/ai/providers'
import { getActiveSystemPrompt } from '@/lib/ai/prompt-config'
import { getModelForTask } from '@/lib/ai/model-config'

const LEVELS: readonly AssessmentLevel[] = [
  'ic',
  'first_line_manager',
  'mid_manager',
  'senior_leader',
  'executive',
]
const OUTCOMES: readonly AssessmentOutcome[] = [
  'selection',
  'development',
  'team_composition',
]

export interface BriefExtractionInput {
  /** Raw role text — pasted/uploaded position description or typed description. */
  rawText: string
  /** The user's stated decision (chip label), e.g. "succession planning". */
  outcomeIntent: string
}

export interface BriefExtractionOptions {
  providerId?: AIProviderType
  modelId?: string
}

/** Run the brief-extraction pipeline end-to-end. */
export async function runBriefExtraction(
  input: BriefExtractionInput,
  options: BriefExtractionOptions = {},
): Promise<Brief> {
  const provider = options.providerId
    ? getProvider(options.providerId)
    : await getDefaultProvider()

  const taskConfig = await getModelForTask('brief_extraction')
  const modelId = options.modelId ?? taskConfig.modelId
  const prompt = await getActiveSystemPrompt('brief_extraction')

  const response = await provider.complete({
    prompt: buildBriefExtractionPrompt(input),
    systemPrompt: prompt.content,
    model: modelId,
    temperature: taskConfig.config.temperature ?? 0.2,
    maxTokens: taskConfig.config.max_tokens ?? 1500,
    responseFormat: 'json',
  })

  return normaliseBrief(parseJsonResponse(response.content), input.outcomeIntent)
}

/** Build the user prompt for brief extraction. */
export function buildBriefExtractionPrompt(input: BriefExtractionInput): string {
  return `## Decision being made

${input.outcomeIntent || '(not specified)'}

## Role description

${input.rawText.trim()}

Extract the brief as a single JSON object following the schema in the system prompt. Output JSON only.`
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
      `Brief is not valid JSON: ${cleaned.slice(0, 200)}...`,
      error,
    )
  }
}

/** Coerce the model's snake_case JSON into a validated camelCase Brief. */
function normaliseBrief(value: unknown, fallbackIntent: string): Brief {
  if (typeof value !== 'object' || value === null) {
    throw new ResponseParseError('Brief response is not an object.')
  }
  const obj = value as Record<string, unknown>

  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
  const strArray = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
      : []

  const level = LEVELS.includes(obj.level as AssessmentLevel)
    ? (obj.level as AssessmentLevel)
    : 'mid_manager'
  const outcome = OUTCOMES.includes(obj.outcome as AssessmentOutcome)
    ? (obj.outcome as AssessmentOutcome)
    : 'selection'
  const confidence =
    obj.confidence === 'high' || obj.confidence === 'medium' || obj.confidence === 'low'
      ? obj.confidence
      : 'medium'

  return {
    roleTitle: str(obj.role_title),
    level,
    function: str(obj.function),
    outcome,
    outcomeIntent: str(obj.outcome_intent) || fallbackIntent,
    responsibilities: strArray(obj.responsibilities),
    contextSignals: strArray(obj.context_signals),
    technicalRequirements: strArray(obj.technical_requirements),
    confidence,
  }
}
