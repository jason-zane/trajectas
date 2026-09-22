/**
 * The reasons stage — the only LLM call left in the Jev pipeline.
 *
 * Jev ranks; it does not explain. This asks a cheap text model to write the
 * per-competency "why" and an overall summary for the handful of picks a user
 * actually reads.
 *
 * Non-fatal by construction: every failure path returns an empty result after
 * logging, because a ranking without prose is still a ranking, and the caller
 * has already spent the user's time on two decision calls.
 */

import type { Brief } from '@/types/ai'
import type { AIProvider } from '@/lib/ai/providers'
import { getDefaultProvider } from '@/lib/ai/providers'
import { getActiveSystemPrompt, type ActiveSystemPrompt } from '@/lib/ai/prompt-config'
import { getModelForTask, type TaskModelConfig } from '@/lib/ai/model-config'
import { logActionError } from '@/lib/security/action-errors'

export interface ExplanationPick {
  factorId: string
  factorName: string
  definition: string
  /** 0–100 relevance from the matcher — context for the writer, not a constraint. */
  relevanceScore: number
}

export interface RankingExplanation {
  summary: string | null
  /** Keyed by factorId. Missing keys simply have no reason. */
  reasons: Record<string, string>
  usage: { inputTokens: number; outputTokens: number }
}

export interface RankingExplanationDeps {
  provider?: AIProvider
  modelConfig?: TaskModelConfig
  prompt?: ActiveSystemPrompt
}

export interface RankingExplanationInput {
  brief: Brief
  picks: ExplanationPick[]
}

const EMPTY: RankingExplanation = {
  summary: null,
  reasons: {},
  usage: { inputTokens: 0, outputTokens: 0 },
}

/** Build the user prompt. Exported for tests. */
export function buildExplanationPrompt(input: RankingExplanationInput): string {
  const lines = input.picks
    .map(
      (p) =>
        `- ${p.factorId} | ${p.factorName} (${p.relevanceScore}% match): ${p.definition}`,
    )
    .join('\n')

  return (
    '## Role brief\n' +
    JSON.stringify(input.brief) +
    "\n\n## Competencies selected for the assessment (with the matcher's relevance score, 0–100)\n" +
    lines +
    '\n\nWrite the reasons and the summary. JSON only.'
  )
}

/**
 * Parse the model's JSON, tolerating fences and surrounding prose.
 *
 * Keys are trusted only if they name a pick: the model is told to key by
 * factorId, but it sometimes keys by name, so an unambiguous name is mapped
 * back and anything else is dropped rather than surfaced against the wrong
 * competency. Exported for tests.
 */
export function parseExplanation(
  content: string,
  validIds: Set<string>,
  idByName?: Map<string, string>,
): { summary: string | null; reasons: Record<string, string> } {
  const parsed = tolerantJsonParse(content)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { summary: null, reasons: {} }
  }

  const obj = parsed as Record<string, unknown>
  const summaryRaw = typeof obj.summary === 'string' ? obj.summary.trim() : ''
  const summary = summaryRaw.length > 0 ? summaryRaw : null

  const reasons: Record<string, string> = {}
  const rawReasons = obj.reasons
  if (rawReasons !== null && typeof rawReasons === 'object' && !Array.isArray(rawReasons)) {
    for (const [key, value] of Object.entries(rawReasons as Record<string, unknown>)) {
      if (typeof value !== 'string') continue
      const text = value.trim()
      if (text.length === 0) continue
      const id = validIds.has(key) ? key : idByName?.get(key)
      if (!id) continue
      reasons[id] = text
    }
  }

  return { summary, reasons }
}

/** Run the reasons stage. Never throws. */
export async function runRankingExplanation(
  input: RankingExplanationInput,
  deps: RankingExplanationDeps = {},
): Promise<RankingExplanation> {
  if (input.picks.length === 0) return { ...EMPTY, reasons: {} }

  try {
    const modelConfig = deps.modelConfig ?? (await getModelForTask('ranking_explanation'))
    const prompt = deps.prompt ?? (await getActiveSystemPrompt('ranking_explanation'))
    const provider = deps.provider ?? (await getDefaultProvider())

    const response = await provider.complete({
      prompt: buildExplanationPrompt(input),
      systemPrompt: prompt.content,
      model: modelConfig.modelId,
      temperature: modelConfig.config.temperature ?? 0.4,
      maxTokens: modelConfig.config.max_tokens ?? 900,
      responseFormat: 'json',
    })

    const { summary, reasons } = parseExplanation(
      response.content,
      new Set(input.picks.map((p) => p.factorId)),
      buildIdByName(input.picks),
    )

    return {
      summary,
      reasons,
      usage: {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      },
    }
  } catch (error) {
    logActionError('matching.explanation', error)
    return { ...EMPTY, reasons: {} }
  }
}

/** name → id, minus any name shared by two picks (ambiguous keys are dropped). */
function buildIdByName(picks: ExplanationPick[]): Map<string, string> {
  const byName = new Map<string, string>()
  const ambiguous = new Set<string>()
  for (const pick of picks) {
    if (byName.has(pick.factorName)) ambiguous.add(pick.factorName)
    else byName.set(pick.factorName, pick.factorId)
  }
  for (const name of ambiguous) byName.delete(name)
  return byName
}

/** JSON.parse, retrying on the outermost object when the model wraps it in prose. */
function tolerantJsonParse(content: string): unknown {
  let cleaned = content.trim()
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/)
  if (fenceMatch) cleaned = fenceMatch[1].trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}
