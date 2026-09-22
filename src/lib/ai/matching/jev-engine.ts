/**
 * The Jev matching engine — two decision calls, then pure maths.
 *
 * Stage 1 asks one question per outcome-eligible factor plus a seniority
 * question, in a single call (Jev judges questions independently, so batching
 * costs nothing and saves a round trip). Stage 2 rescores the shortlist
 * against each other, which is the only comparative judgement in the pipeline
 * — and is non-fatal, because a failed rerank still leaves a usable stage-1
 * order.
 *
 * Reasons are NOT produced here; `engine.ts` runs that LLM stage afterwards.
 */

import type { AssessmentLevel, MatchingInput, MatchingOutput } from '@/types/ai'
import { ProviderRequestError } from '@/types/ai'
import { decide } from '@/lib/ai/providers/jev'
import { logActionError } from '@/lib/security/action-errors'
import {
  buildStage1Request,
  buildStage2Request,
  JEV_CRITERIA_VERSION,
  LEVEL_QUESTION_KEY,
} from './jev-criteria'
import {
  alignScoresToOrder,
  DEFAULT_JEV_RANKING_CONFIG,
  fallbackSummary,
  mergeRerank,
  orderByScore,
  recommendedCountFrom,
  resolveLevel,
  scoreFactors,
  toRankings,
  type JevRankingConfig,
} from './jev-ranking'

export interface JevMatchingOptions {
  /** Jev model id, e.g. "typesafe/jev-1.13". */
  modelId: string
  /** Per-run overrides of the ranking knobs. */
  config?: Partial<JevRankingConfig>
  /** Injectable decision client — tests and the parity script. */
  decide?: typeof decide
}

export interface JevMatchingOutput extends MatchingOutput {
  engine: 'jev'
  /** The level the penalty was applied against. */
  resolvedLevel: AssessmentLevel
  levelConfidence: number | null
  levelSource: 'jev' | 'brief'
}

export async function runJevMatching(
  input: MatchingInput & { source: { kind: 'brief' } },
  options: JevMatchingOptions,
): Promise<JevMatchingOutput> {
  const config = { ...DEFAULT_JEV_RANKING_CONFIG, ...options.config }
  const decideFn = options.decide ?? decide
  const { brief, rawText } = input.source

  const stage1 = buildStage1Request({
    modelId: options.modelId,
    outcome: brief.outcome,
    rawText,
    brief,
    factors: input.availableFactors,
  })

  const response1 = await decideFn(stage1.request)

  const level = resolveLevel(
    response1.answers[LEVEL_QUESTION_KEY],
    brief.level,
    config.levelConfidenceGate,
  )

  const scored = scoreFactors(
    input.availableFactors,
    response1.answers,
    stage1.keys,
    level.level,
    config.levelPenalty,
  )

  if (scored.length === 0) {
    throw new ProviderRequestError('jev', 'Jev returned no factor scores')
  }

  const ordered = orderByScore(scored)

  let inputTokens = response1.usage.inputTokens
  let outputTokens = response1.usage.outputTokens
  let stage2Scores: Map<string, number> | null = null

  if (config.rerank && ordered.length > 1) {
    try {
      const stage2 = buildStage2Request({
        modelId: options.modelId,
        outcome: brief.outcome,
        rawText,
        brief,
        shortlist: ordered.slice(0, config.shortlistSize).map((s) => s.factor),
      })
      const response2 = await decideFn(stage2.request)
      inputTokens += response2.usage.inputTokens
      outputTokens += response2.usage.outputTokens

      const scores = new Map<string, number>()
      for (const [key, factorId] of stage2.keys) {
        const answer = response2.answers[key]
        if (answer?.type === 'score') scores.set(factorId, answer.score)
      }
      stage2Scores = scores
    } catch (error) {
      // A failed rerank is a lost refinement, not a lost run.
      logActionError('matching.jev.rerank', error)
    }
  }

  const merged = mergeRerank(ordered, config.shortlistSize, stage2Scores)
  const final = stage2Scores ? alignScoresToOrder(merged, config.shortlistSize) : merged
  const rankings = toRankings(final)

  return {
    rankings,
    summary: fallbackSummary(brief, rankings.length, level.level),
    recommendedCount: recommendedCountFrom(final),
    usage: { inputTokens, outputTokens },
    modelUsed: response1.model,
    promptVersion: JEV_CRITERIA_VERSION,
    engine: 'jev',
    resolvedLevel: level.level,
    levelConfidence: level.confidence,
    levelSource: level.source,
  }
}
