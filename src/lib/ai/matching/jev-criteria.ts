/**
 * The wording the Jev decision model judges against.
 *
 * Pure: no I/O, no clock, no randomness. The words ARE the model here — a
 * criteria change is a behaviour change, so the whole file is versioned by
 * `JEV_CRITERIA_VERSION` (stored as `promptVersion` on every run) and should
 * only be edited alongside a re-run of the evaluation harness in
 * `scripts/evals/jev-pipeline-redesign-eval.mjs`.
 */

import type {
  AssessmentLevel,
  AssessmentOutcome,
  Brief,
  MatchingFactor,
} from '@/types/ai'
import type { JevQuestion, JevRequest } from '@/lib/ai/providers/jev'

/** Bump whenever any wording below changes. Recorded as `promptVersion`. */
export const JEV_CRITERIA_VERSION = 1

/** Stage-1 relevance scale, worst first. The answer is a 0–4 weighted value. */
export const RELEVANCE_LEVELS: readonly string[] = [
  'Not relevant: measuring this would tell us little about success in this role',
  'Marginal: occasionally useful but not a differentiator',
  'Useful: contributes to performance in this role',
  'Important: a clear driver of success in this role',
  'Critical: among the few things that most separate strong from weak performers in this role',
]

/** Stage-2 shortlist scale, worst first. The answer is a 0–3 weighted value. */
export const RERANK_LEVELS: readonly string[] = [
  'Least essential of the shortlist: the first to drop if the assessment had to be shorter',
  'Useful but secondary to the others on the shortlist',
  'Core: clearly belongs in the assessment for this role',
  'Defining: the role cannot be assessed properly without it',
]

/** Seniority choices offered to the level question. */
export const LEVEL_CRITERIA: Record<AssessmentLevel, string> = {
  ic: 'Individual contributor with no direct reports',
  first_line_manager: 'Manages a team of individual contributors',
  mid_manager: 'Manages managers or a function',
  senior_leader: 'Leads a division or major business unit',
  executive: 'C-suite or equivalent enterprise leadership',
}

/** Reserved question key for the seniority question (stage 1 only). */
export const LEVEL_QUESTION_KEY = 'level'

const DECISION_LABELS: Record<AssessmentOutcome, string> = {
  selection: 'selection (hiring into this role)',
  development: "development (planning a person's growth in this role)",
  team_composition: 'team composition (balancing a team around this role)',
}

/** How the decision being made is described to the model in `state.decision`. */
export function decisionLabel(outcome: AssessmentOutcome): string {
  return DECISION_LABELS[outcome]
}

/** Slug of a factor name, used as its question key. May collide; see `buildQuestionKeys`. */
export function questionKeyFor(factor: MatchingFactor): string {
  return factor.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Assign one unique question key per factor, in factor order.
 *
 * Returns key → factorId: the model echoes keys, never ids, so this map is the
 * only way answers get attributed. Collisions (two factors slugging the same,
 * or a factor named "Level") are disambiguated with the id, never dropped.
 */
export function buildQuestionKeys(factors: MatchingFactor[]): Map<string, string> {
  const keys = new Map<string, string>()
  const used = new Set<string>([LEVEL_QUESTION_KEY])

  for (const factor of factors) {
    const base = questionKeyFor(factor) || 'factor'
    let key = base
    if (used.has(key)) {
      key = `${base}_${factor.id.slice(0, 8)}`
      let suffix = 2
      while (used.has(key)) {
        key = `${base}_${factor.id.slice(0, 8)}_${suffix}`
        suffix += 1
      }
    }
    used.add(key)
    keys.set(key, factor.id)
  }

  return keys
}

/** The definition/indicator/category fragment appended to both question types. */
export function factorDetail(factor: MatchingFactor): string {
  const parts: string[] = []
  const definition = factor.definition?.trim()
  if (definition) parts.push(`Definition: ${definition}`)
  const high = factor.indicatorsHigh?.trim()
  if (high) parts.push(`High performers: ${high}`)
  const low = factor.indicatorsLow?.trim()
  if (low) parts.push(`Low performers: ${low}`)
  const category = factor.category?.trim()
  if (category) parts.push(`(Category: ${category}.)`)
  return parts.join(' ')
}

/** Stage-1 question: how much would measuring this factor tell us about this role? */
export function buildRelevanceQuestion(factor: MatchingFactor): JevQuestion {
  const detail = factorDetail(factor)
  return {
    type: 'score',
    instructions:
      'The state contains a position description and the decision being made. ' +
      `How important is it to measure the competency "${factor.name}" in a pre-hire ` +
      'psychometric assessment for this role? Judge what separates strong from merely ' +
      'adequate performers in this specific role at its level, not what is generically ' +
      `desirable.${detail ? ` ${detail}` : ''}`,
    criteria: [...RELEVANCE_LEVELS],
  }
}

/** Stage-1 seniority question — the soft level signal. */
export function buildLevelQuestion(): JevQuestion {
  return {
    type: 'choice',
    instructions: 'What seniority level is this role?',
    criteria: { ...LEVEL_CRITERIA },
  }
}

/** Stage-2 question: how essential is this factor relative to the rest of the shortlist? */
export function buildRerankQuestion(factor: MatchingFactor): JevQuestion {
  const detail = factorDetail(factor)
  return {
    type: 'score',
    instructions:
      'The state contains a position description and a shortlist of competencies ' +
      'already judged relevant. Relative to the OTHER shortlisted competencies, how ' +
      `essential is "${factor.name}" to measure for this role?${detail ? ` ${detail}` : ''}`,
    criteria: [...RERANK_LEVELS],
  }
}

/** Plain-text rendering of a brief, used as `state.role_brief` when no raw PD is held. */
export function renderBriefState(brief: Brief): string {
  const lines: string[] = [
    `Role title: ${brief.roleTitle || '(unspecified)'}`,
    `Level: ${brief.level}`,
    `Function: ${brief.function || '(unspecified)'}`,
    `Decision intent: ${brief.outcomeIntent || brief.outcome}`,
  ]

  const section = (title: string, items: string[]) => {
    if (items.length === 0) return
    lines.push(`${title}:`)
    for (const item of items) lines.push(`- ${item}`)
  }

  section('Responsibilities', brief.responsibilities)
  section('Context signals', brief.contextSignals)
  section('Technical requirements', brief.technicalRequirements)

  return lines.join('\n')
}

function buildState(
  outcome: AssessmentOutcome,
  rawText: string | undefined,
  brief: Brief,
): Record<string, unknown> {
  const decision = decisionLabel(outcome)
  const text = rawText?.trim()
  return text
    ? { decision, position_description: text }
    : { decision, role_brief: renderBriefState(brief) }
}

export interface JevStage1Input {
  modelId: string
  outcome: AssessmentOutcome
  /** Raw position description; preferred over the brief when present. */
  rawText?: string
  brief: Brief
  /** Outcome-eligible factors — NOT level-filtered; the level is a soft penalty. */
  factors: MatchingFactor[]
}

export interface JevStage2Input {
  modelId: string
  outcome: AssessmentOutcome
  rawText?: string
  brief: Brief
  shortlist: MatchingFactor[]
}

/** Build the single stage-1 call: the level question plus one question per factor. */
export function buildStage1Request(
  input: JevStage1Input,
): { request: JevRequest; keys: Map<string, string> } {
  const keys = buildQuestionKeys(input.factors)
  const keyList = [...keys.keys()]
  const questions: Record<string, JevQuestion> = {
    [LEVEL_QUESTION_KEY]: buildLevelQuestion(),
  }
  input.factors.forEach((factor, index) => {
    questions[keyList[index]] = buildRelevanceQuestion(factor)
  })

  return {
    request: {
      model: input.modelId,
      state: buildState(input.outcome, input.rawText, input.brief),
      questions,
    },
    keys,
  }
}

/** Build the stage-2 rerank call. No level question — it was answered in stage 1. */
export function buildStage2Request(
  input: JevStage2Input,
): { request: JevRequest; keys: Map<string, string> } {
  const keys = buildQuestionKeys(input.shortlist)
  const keyList = [...keys.keys()]
  const questions: Record<string, JevQuestion> = {}
  input.shortlist.forEach((factor, index) => {
    questions[keyList[index]] = buildRerankQuestion(factor)
  })

  return {
    request: {
      model: input.modelId,
      state: {
        ...buildState(input.outcome, input.rawText, input.brief),
        shortlisted_competencies: input.shortlist.map((f) => f.name),
      },
      questions,
    },
    keys,
  }
}
