/**
 * The ranking maths of the Jev engine.
 *
 * Pure: no I/O, no clock, no randomness — every function here is a total
 * function of its arguments, which is what makes the engine's behaviour
 * reproducible and testable without touching the decision endpoint.
 */

import type {
  AssessmentLevel,
  Brief,
  FactorRanking,
  MatchingFactor,
} from '@/types/ai'
import type { JevAnswer } from '@/lib/ai/providers/jev'

export interface JevRankingConfig {
  /** Minimum confidence before Jev's level answer overrides the brief's. */
  levelConfidenceGate: number
  /** Points deducted from a factor that does not apply at the resolved level. */
  levelPenalty: number
  /** Run the stage-2 shortlist rerank. */
  rerank: boolean
  /** How many factors go into the stage-2 shortlist. */
  shortlistSize: number
}

export const DEFAULT_JEV_RANKING_CONFIG: JevRankingConfig = {
  levelConfidenceGate: 0.7,
  levelPenalty: 0.5,
  rerank: true,
  shortlistSize: 12,
}

/** Top of the stage-1 relevance scale — `RELEVANCE_LEVELS.length - 1`. */
const RELEVANCE_MAX = 4

const LEVELS: readonly AssessmentLevel[] = [
  'ic',
  'first_line_manager',
  'mid_manager',
  'senior_leader',
  'executive',
]

const LEVEL_LABELS: Record<AssessmentLevel, string> = {
  ic: 'individual contributor',
  first_line_manager: 'first-line manager',
  mid_manager: 'mid-level manager',
  senior_leader: 'senior leader',
  executive: 'executive',
}

function isAssessmentLevel(value: string): value is AssessmentLevel {
  return (LEVELS as readonly string[]).includes(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Decide which seniority level the ranking is judged against.
 *
 * Jev's own read of the position description wins only when it is a level we
 * recognise AND it carries enough confidence; otherwise the extracted brief
 * stands. A missing confidence is treated as no confidence.
 */
export function resolveLevel(
  answer: JevAnswer | undefined,
  briefLevel: AssessmentLevel,
  gate: number,
): { level: AssessmentLevel; source: 'jev' | 'brief'; confidence: number | null } {
  if (answer?.type === 'choice' && isAssessmentLevel(answer.choice)) {
    const confidence = typeof answer.confidence === 'number' ? answer.confidence : null
    if (confidence !== null && confidence >= gate) {
      return { level: answer.choice, source: 'jev', confidence }
    }
    return { level: briefLevel, source: 'brief', confidence }
  }
  return { level: briefLevel, source: 'brief', confidence: null }
}

export interface ScoredFactor {
  factor: MatchingFactor
  /** Jev's raw 0–4 relevance value. */
  rawScore: number
  /** Raw score after the level penalty, floored at 0. */
  penalisedScore: number
  confidence: number | null
}

/**
 * Attach Jev's stage-1 answers to their factors and apply the soft level penalty.
 *
 * Factors Jev did not score are dropped rather than scored zero — a missing
 * answer is an absence of evidence, not evidence of irrelevance.
 */
export function scoreFactors(
  factors: MatchingFactor[],
  answers: Record<string, JevAnswer>,
  keys: Map<string, string>,
  resolvedLevel: AssessmentLevel,
  penalty: number,
): ScoredFactor[] {
  const factorById = new Map(factors.map((f) => [f.id, f]))
  const scored: ScoredFactor[] = []

  for (const [key, factorId] of keys) {
    const factor = factorById.get(factorId)
    if (!factor) continue
    const answer = answers[key]
    if (answer?.type !== 'score') continue

    const applicable = factor.applicableLevels ?? []
    const mismatched = applicable.length > 0 && !applicable.includes(resolvedLevel)
    const penalisedScore = Math.max(0, mismatched ? answer.score - penalty : answer.score)

    scored.push({
      factor,
      rawScore: answer.score,
      penalisedScore,
      confidence: typeof answer.confidence === 'number' ? answer.confidence : null,
    })
  }

  return scored
}

/** Order by penalised score, descending. Ties break on raw score, then name. */
export function orderByScore(scored: ScoredFactor[]): ScoredFactor[] {
  return [...scored].sort((a, b) => {
    if (b.penalisedScore !== a.penalisedScore) return b.penalisedScore - a.penalisedScore
    if (b.rawScore !== a.rawScore) return b.rawScore - a.rawScore
    return a.factor.name.localeCompare(b.factor.name)
  })
}

/**
 * Fold the stage-2 shortlist scores back into the stage-1 order.
 *
 * Only the shortlist moves. Shortlisted factors Jev failed to rescore keep
 * their stage-1 order behind the rescored ones, and everything below the
 * shortlist is untouched.
 */
export function mergeRerank(
  ordered: ScoredFactor[],
  shortlistSize: number,
  stage2Scores: Map<string, number> | null,
): ScoredFactor[] {
  if (!stage2Scores || stage2Scores.size === 0) return [...ordered]

  const head = ordered.slice(0, shortlistSize)
  const tail = ordered.slice(shortlistSize)
  const rescored: Array<{ item: ScoredFactor; index: number; score: number }> = []
  const unscored: ScoredFactor[] = []

  head.forEach((item, index) => {
    const score = stage2Scores.get(item.factor.id)
    if (typeof score === 'number') rescored.push({ item, index, score })
    else unscored.push(item)
  })

  rescored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index))

  return [...rescored.map((entry) => entry.item), ...unscored, ...tail]
}

/**
 * How many competencies to recommend, from the shape of the score distribution.
 *
 * Order-independent — it counts scores, it does not read positions.
 */
export function recommendedCountFrom(scored: ScoredFactor[]): {
  minimum: number
  optimal: number
  maximum: number
} {
  const n = scored.length
  if (n === 0) return { minimum: 0, optimal: 0, maximum: 0 }

  const minimum = Math.min(5, n)
  const strong = scored.filter((s) => s.penalisedScore >= 3.0).length
  const optimal = Math.min(clamp(strong, 5, 8), n)
  const usable = scored.filter((s) => s.penalisedScore >= 2.5).length
  const maximum = Math.min(clamp(usable, optimal, 12), n)

  return { minimum, optimal, maximum }
}

/**
 * Project the final order onto the `FactorRanking` contract the rest of the
 * app already consumes.
 *
 * `relevanceScore` is always the factor's OWN stage-1 relevance (penalised),
 * even when the stage-2 rerank decided its position — so after a rerank the
 * score sequence is not guaranteed to be monotone in rank. That is deliberate:
 * rank answers "which matter most relative to each other", the score answers
 * "how relevant is this one", and a factor must never carry another's number.
 *
 * `incrementalValue`/`cumulativeValue` are a declining curve rather than a
 * measured redundancy — Jev judges each factor independently, so there is no
 * incremental-information signal to report. They exist so `isValidRankingsPayload`
 * and the existing consumers keep working.
 */
export function toRankings(final: ScoredFactor[]): FactorRanking[] {
  const n = final.length
  const base = final.map((s, index) => {
    const rank = index + 1
    const relevanceScore = Math.round(clamp(s.penalisedScore / RELEVANCE_MAX, 0, 1) * 100)
    return {
      factorId: s.factor.id,
      factorName: s.factor.name,
      rank,
      relevanceScore,
      reasoning: '',
      incrementalValue: Math.round(relevanceScore * Math.max(0, 1 - (rank - 1) / n)),
    }
  })

  const total = base.reduce((sum, r) => sum + r.incrementalValue, 0)
  let running = 0

  return base.map((r) => {
    running += r.incrementalValue
    return {
      ...r,
      cumulativeValue: total === 0 ? 0 : Math.round((running / total) * 100),
    }
  })
}

/** Summary used when the reasons stage produced nothing. */
export function fallbackSummary(
  brief: Brief,
  count: number,
  level: AssessmentLevel,
): string {
  const title = brief.roleTitle?.trim() || 'this role'
  return (
    `Ranked ${count} capabilities for ${title} at ${LEVEL_LABELS[level]} level, ` +
    "ordered by how much each would tell you about a candidate's fit for the role."
  )
}
