import { describe, expect, it } from 'vitest'

import type { Brief, MatchingFactor } from '@/types/ai'
import type { JevAnswer } from '@/lib/ai/providers/jev'
import { isValidRankingsPayload } from '@/lib/ai/prompts/competency-matching'
import {
  DEFAULT_JEV_RANKING_CONFIG,
  fallbackSummary,
  mergeRerank,
  orderByScore,
  recommendedCountFrom,
  resolveLevel,
  scoreFactors,
  toRankings,
  type ScoredFactor,
} from '@/lib/ai/matching/jev-ranking'
import {
  buildLevelQuestion,
  buildQuestionKeys,
  buildRelevanceQuestion,
  buildRerankQuestion,
  buildStage1Request,
  buildStage2Request,
  decisionLabel,
  factorDetail,
  JEV_CRITERIA_VERSION,
  LEVEL_QUESTION_KEY,
  questionKeyFor,
  RELEVANCE_LEVELS,
  RERANK_LEVELS,
  renderBriefState,
} from '@/lib/ai/matching/jev-criteria'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function factor(overrides: Partial<MatchingFactor> & { id: string; name: string }): MatchingFactor {
  return {
    definition: `${overrides.name} definition`,
    ...overrides,
  }
}

function brief(overrides: Partial<Brief> = {}): Brief {
  return {
    roleTitle: 'Nurse Unit Manager',
    level: 'first_line_manager',
    function: 'healthcare',
    outcome: 'selection',
    outcomeIntent: 'hiring a ward manager',
    responsibilities: ['Run the ward roster'],
    contextSignals: ['Public hospital'],
    technicalRequirements: ['AHPRA registration'],
    confidence: 'high',
    ...overrides,
  }
}

function scoreAnswer(score: number, confidence?: number): JevAnswer {
  return confidence === undefined
    ? { type: 'score', score }
    : { type: 'score', score, confidence }
}

function scored(
  name: string,
  penalisedScore: number,
  rawScore = penalisedScore,
  id = name.toLowerCase(),
): ScoredFactor {
  return {
    factor: factor({ id, name }),
    rawScore,
    penalisedScore,
    confidence: null,
  }
}

// ---------------------------------------------------------------------------
// resolveLevel
// ---------------------------------------------------------------------------

describe('resolveLevel', () => {
  it('uses Jev when the choice is a real level and confidence clears the gate', () => {
    const answer: JevAnswer = { type: 'choice', choice: 'mid_manager', confidence: 0.82 }
    expect(resolveLevel(answer, 'ic', 0.7)).toEqual({
      level: 'mid_manager',
      source: 'jev',
      confidence: 0.82,
    })
  })

  it('accepts confidence exactly on the gate', () => {
    const answer: JevAnswer = { type: 'choice', choice: 'executive', confidence: 0.7 }
    expect(resolveLevel(answer, 'ic', 0.7).source).toBe('jev')
  })

  it('falls back to the brief below the gate but keeps the confidence', () => {
    const answer: JevAnswer = { type: 'choice', choice: 'executive', confidence: 0.4 }
    expect(resolveLevel(answer, 'ic', 0.7)).toEqual({
      level: 'ic',
      source: 'brief',
      confidence: 0.4,
    })
  })

  it('falls back to the brief when confidence is missing', () => {
    const answer: JevAnswer = { type: 'choice', choice: 'executive' }
    expect(resolveLevel(answer, 'senior_leader', 0.7)).toEqual({
      level: 'senior_leader',
      source: 'brief',
      confidence: null,
    })
  })

  it('falls back to the brief when the choice is not a level we recognise', () => {
    const answer: JevAnswer = { type: 'choice', choice: 'director', confidence: 0.99 }
    expect(resolveLevel(answer, 'ic', 0.7)).toEqual({
      level: 'ic',
      source: 'brief',
      confidence: null,
    })
  })

  it('falls back to the brief when the answer is missing or the wrong type', () => {
    expect(resolveLevel(undefined, 'ic', 0.7).source).toBe('brief')
    expect(resolveLevel({ type: 'noul', noul: true }, 'ic', 0.7).level).toBe('ic')
    expect(resolveLevel(scoreAnswer(3), 'mid_manager', 0.7).level).toBe('mid_manager')
  })
})

// ---------------------------------------------------------------------------
// scoreFactors
// ---------------------------------------------------------------------------

describe('scoreFactors', () => {
  const drive = factor({ id: 'f1', name: 'Drive', applicableLevels: [] })
  const strategy = factor({ id: 'f2', name: 'Strategy', applicableLevels: ['executive'] })
  const coaching = factor({
    id: 'f3',
    name: 'Coaching',
    applicableLevels: ['first_line_manager', 'mid_manager'],
  })

  const keys = new Map([
    ['drive', 'f1'],
    ['strategy', 'f2'],
    ['coaching', 'f3'],
  ])

  it('penalises only factors whose non-empty applicableLevels exclude the level', () => {
    const result = scoreFactors(
      [drive, strategy, coaching],
      { drive: scoreAnswer(3.2), strategy: scoreAnswer(3.0), coaching: scoreAnswer(2.5, 0.6) },
      keys,
      'first_line_manager',
      0.5,
    )

    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ rawScore: 3.2, penalisedScore: 3.2, confidence: null })
    expect(result[1].penalisedScore).toBeCloseTo(2.5)
    expect(result[2]).toMatchObject({ penalisedScore: 2.5, confidence: 0.6 })
  })

  it('clamps the penalised score at zero', () => {
    const result = scoreFactors([strategy], { strategy: scoreAnswer(0.2) }, new Map([['strategy', 'f2']]), 'ic', 0.5)
    expect(result[0].penalisedScore).toBe(0)
    expect(result[0].rawScore).toBe(0.2)
  })

  it('treats a factor with no applicableLevels field as applying everywhere', () => {
    const untagged = factor({ id: 'f4', name: 'Untagged' })
    const result = scoreFactors([untagged], { untagged: scoreAnswer(2.5) }, new Map([['untagged', 'f4']]), 'executive', 0.5)
    expect(result[0].penalisedScore).toBe(2.5)
  })

  it('skips factors with no score answer, and keys naming an unknown factor', () => {
    const result = scoreFactors(
      [drive, strategy],
      { drive: { type: 'choice', choice: 'x' }, strategy: scoreAnswer(4) },
      new Map([
        ['drive', 'f1'],
        ['ghost', 'missing-id'],
        ['strategy', 'f2'],
      ]),
      'executive',
      0.5,
    )
    expect(result.map((r) => r.factor.id)).toEqual(['f2'])
  })
})

// ---------------------------------------------------------------------------
// orderByScore
// ---------------------------------------------------------------------------

describe('orderByScore', () => {
  it('orders by penalised score, then raw score, then name — deterministically', () => {
    const input: ScoredFactor[] = [
      scored('Beta', 3.0, 3.0),
      scored('Alpha', 3.0, 3.0),
      scored('Gamma', 3.0, 3.5),
      scored('Delta', 4.0, 4.0),
    ]
    expect(orderByScore(input).map((s) => s.factor.name)).toEqual([
      'Delta',
      'Gamma',
      'Alpha',
      'Beta',
    ])
  })

  it('does not mutate the input', () => {
    const input = [scored('Beta', 1), scored('Alpha', 2)]
    orderByScore(input)
    expect(input.map((s) => s.factor.name)).toEqual(['Beta', 'Alpha'])
  })
})

// ---------------------------------------------------------------------------
// mergeRerank
// ---------------------------------------------------------------------------

describe('mergeRerank', () => {
  const ordered = [
    scored('A', 4.0),
    scored('B', 3.5),
    scored('C', 3.0),
    scored('D', 2.0),
  ]

  it('returns the stage-1 order when there are no stage-2 scores', () => {
    expect(mergeRerank(ordered, 3, null).map((s) => s.factor.name)).toEqual(['A', 'B', 'C', 'D'])
    expect(mergeRerank(ordered, 3, new Map()).map((s) => s.factor.name)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ])
  })

  it('reorders the shortlist by stage-2 score and leaves the tail alone', () => {
    const stage2 = new Map([
      ['a', 1],
      ['b', 3],
      ['c', 2],
    ])
    expect(mergeRerank(ordered, 3, stage2).map((s) => s.factor.name)).toEqual(['B', 'C', 'A', 'D'])
  })

  it('keeps stage-1 order for stage-2 ties', () => {
    const stage2 = new Map([
      ['a', 2],
      ['b', 2],
      ['c', 2],
    ])
    expect(mergeRerank(ordered, 3, stage2).map((s) => s.factor.name)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('puts shortlisted factors missing a stage-2 score after the rescored ones', () => {
    const stage2 = new Map([['c', 3]])
    expect(mergeRerank(ordered, 3, stage2).map((s) => s.factor.name)).toEqual(['C', 'A', 'B', 'D'])
  })
})

// ---------------------------------------------------------------------------
// recommendedCountFrom
// ---------------------------------------------------------------------------

describe('recommendedCountFrom', () => {
  it('is all zero for an empty set', () => {
    expect(recommendedCountFrom([])).toEqual({ minimum: 0, optimal: 0, maximum: 0 })
  })

  it('caps everything at n for a tiny pool', () => {
    const input = [scored('A', 4), scored('B', 3.4), scored('C', 1)]
    expect(recommendedCountFrom(input)).toEqual({ minimum: 3, optimal: 3, maximum: 3 })
  })

  it('floors optimal and maximum at 5 when every score is compressed', () => {
    const input = Array.from({ length: 10 }, (_, i) => scored(`F${i}`, 2.0))
    expect(recommendedCountFrom(input)).toEqual({ minimum: 5, optimal: 5, maximum: 5 })
  })

  it('caps optimal at 8 and maximum at 12 when everything scores high', () => {
    const input = Array.from({ length: 25 }, (_, i) => scored(`F${i}`, 3.9))
    expect(recommendedCountFrom(input)).toEqual({ minimum: 5, optimal: 8, maximum: 12 })
  })

  it('ignores the order it is given', () => {
    const input = [scored('A', 1), scored('B', 3.5), scored('C', 2.6), scored('D', 3.1), scored('E', 0)]
    expect(recommendedCountFrom(input)).toEqual(recommendedCountFrom([...input].reverse()))
  })
})

// ---------------------------------------------------------------------------
// toRankings
// ---------------------------------------------------------------------------

describe('toRankings', () => {
  it('produces a payload the existing validator accepts', () => {
    const rankings = toRankings([scored('A', 4), scored('B', 3), scored('C', 1)])
    expect(isValidRankingsPayload({ rankings, summary: '' })).toBe(true)
  })

  it('ranks from 1 with the highest relevance first and scores inside 0–100', () => {
    const rankings = toRankings([scored('A', 4), scored('B', 2), scored('C', 0)])
    expect(rankings.map((r) => r.rank)).toEqual([1, 2, 3])
    expect(rankings.map((r) => r.relevanceScore)).toEqual([100, 50, 0])
    for (const r of rankings) {
      expect(r.relevanceScore).toBeGreaterThanOrEqual(0)
      expect(r.relevanceScore).toBeLessThanOrEqual(100)
      expect(r.reasoning).toBe('')
    }
  })

  it('clamps a score above the top of the scale', () => {
    expect(toRankings([scored('A', 6)])[0].relevanceScore).toBe(100)
  })

  it('ends the cumulative curve at exactly 100', () => {
    const rankings = toRankings([scored('A', 4), scored('B', 3.2), scored('C', 2.4), scored('D', 1)])
    expect(rankings[rankings.length - 1].cumulativeValue).toBe(100)
    expect(rankings[0].cumulativeValue).toBeLessThan(100)
    expect(rankings[0].incrementalValue).toBeGreaterThan(rankings[3].incrementalValue)
  })

  it('returns zero cumulative values when nothing scored', () => {
    const rankings = toRankings([scored('A', 0), scored('B', 0)])
    expect(rankings.map((r) => r.cumulativeValue)).toEqual([0, 0])
  })

  it('handles an empty list', () => {
    expect(toRankings([])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// fallbackSummary + config defaults
// ---------------------------------------------------------------------------

describe('fallbackSummary', () => {
  it('names the role and the level label', () => {
    expect(fallbackSummary(brief(), 12, 'first_line_manager')).toBe(
      'Ranked 12 capabilities for Nurse Unit Manager at first-line manager level, ordered by how much each would tell you about a candidate\'s fit for the role.',
    )
  })

  it('falls back to "this role" when the brief has no title', () => {
    expect(fallbackSummary(brief({ roleTitle: '  ' }), 3, 'executive')).toContain(
      'for this role at executive level',
    )
  })

  it('labels every level', () => {
    const labels = (['ic', 'first_line_manager', 'mid_manager', 'senior_leader', 'executive'] as const).map(
      (level) => fallbackSummary(brief(), 1, level),
    )
    expect(labels.map((l) => l.split(' at ')[1].split(' level')[0])).toEqual([
      'individual contributor',
      'first-line manager',
      'mid-level manager',
      'senior leader',
      'executive',
    ])
  })
})

describe('DEFAULT_JEV_RANKING_CONFIG', () => {
  it('matches the designed defaults', () => {
    expect(DEFAULT_JEV_RANKING_CONFIG).toEqual({
      levelConfidenceGate: 0.7,
      levelPenalty: 0.5,
      rerank: true,
      shortlistSize: 12,
    })
  })
})

// ---------------------------------------------------------------------------
// Criteria
// ---------------------------------------------------------------------------

describe('question keys', () => {
  it('slugs a factor name', () => {
    expect(questionKeyFor(factor({ id: 'x', name: 'Drive & Energy (core)' }))).toBe('drive_energy_core')
  })

  it('disambiguates colliding slugs with the factor id', () => {
    const factors = [
      factor({ id: 'aaaaaaaa-1111', name: 'Drive' }),
      factor({ id: 'aaaaaaaa-2222', name: 'Drive!' }),
      factor({ id: 'aaaaaaaa-3333', name: 'drive' }),
    ]
    const keys = buildQuestionKeys(factors)
    expect([...keys.keys()]).toEqual(['drive', 'drive_aaaaaaaa', 'drive_aaaaaaaa_2'])
    expect([...keys.values()]).toEqual(['aaaaaaaa-1111', 'aaaaaaaa-2222', 'aaaaaaaa-3333'])
    expect(keys.size).toBe(3)
  })

  it('never collides with the reserved level key, and never emits an empty key', () => {
    const keys = buildQuestionKeys([
      factor({ id: 'l1234567-aaaa', name: 'Level' }),
      factor({ id: 'e1234567-bbbb', name: '---' }),
    ])
    expect([...keys.keys()]).toEqual(['level_l1234567', 'factor'])
  })
})

describe('factorDetail', () => {
  it('includes every populated fragment in order', () => {
    expect(
      factorDetail(
        factor({
          id: 'f',
          name: 'Drive',
          definition: 'Sustained effort.',
          indicatorsHigh: 'Pushes through.',
          indicatorsLow: 'Coasts.',
          category: 'Executing',
        }),
      ),
    ).toBe(
      'Definition: Sustained effort. High performers: Pushes through. Low performers: Coasts. (Category: Executing.)',
    )
  })

  it('omits empty fragments', () => {
    expect(
      factorDetail(factor({ id: 'f', name: 'Drive', definition: 'Sustained effort.', indicatorsHigh: '  ' })),
    ).toBe('Definition: Sustained effort.')
    expect(factorDetail({ id: 'f', name: 'Drive', definition: '' })).toBe('')
  })
})

describe('question builders', () => {
  it('builds a 5-level relevance question naming the factor and its definition', () => {
    const question = buildRelevanceQuestion(
      factor({ id: 'f', name: 'Resilience', definition: 'Recovers from setbacks.' }),
    )
    expect(question.type).toBe('score')
    expect(question).toHaveProperty('criteria', [...RELEVANCE_LEVELS])
    expect(question.instructions).toContain('"Resilience"')
    expect(question.instructions).toContain('Definition: Recovers from setbacks.')
  })

  it('omits the detail fragment entirely when there is nothing to say', () => {
    const question = buildRelevanceQuestion({ id: 'f', name: 'Resilience', definition: '' })
    expect(question.instructions.endsWith('not what is generically desirable.')).toBe(true)
  })

  it('builds a 4-level rerank question', () => {
    const question = buildRerankQuestion(factor({ id: 'f', name: 'Resilience' }))
    expect(question).toHaveProperty('criteria', [...RERANK_LEVELS])
    expect(question.instructions).toContain('Relative to the OTHER shortlisted competencies')
    expect(buildRerankQuestion({ id: 'f', name: 'Bare', definition: '' }).instructions.endsWith('for this role?')).toBe(true)
  })

  it('builds the level question with the five seniority levels', () => {
    const question = buildLevelQuestion()
    expect(question.type).toBe('choice')
    expect(Object.keys((question as { criteria: Record<string, string> }).criteria)).toEqual([
      'ic',
      'first_line_manager',
      'mid_manager',
      'senior_leader',
      'executive',
    ])
  })

  it('labels each decision', () => {
    expect(decisionLabel('selection')).toBe('selection (hiring into this role)')
    expect(decisionLabel('development')).toContain('development')
    expect(decisionLabel('team_composition')).toContain('team composition')
  })
})

describe('renderBriefState', () => {
  it('renders the populated fields as plain text bullets', () => {
    const text = renderBriefState(brief())
    expect(text).toContain('Role title: Nurse Unit Manager')
    expect(text).toContain('Level: first_line_manager')
    expect(text).toContain('Decision intent: hiring a ward manager')
    expect(text).toContain('Responsibilities:\n- Run the ward roster')
    expect(text).toContain('- AHPRA registration')
  })

  it('marks unspecified fields and omits empty sections', () => {
    const text = renderBriefState(
      brief({
        roleTitle: '',
        function: '',
        outcomeIntent: '',
        responsibilities: [],
        contextSignals: [],
        technicalRequirements: [],
      }),
    )
    expect(text).toContain('Role title: (unspecified)')
    expect(text).toContain('Function: (unspecified)')
    expect(text).toContain('Decision intent: selection')
    expect(text).not.toContain('Responsibilities:')
  })
})

describe('buildStage1Request', () => {
  const factors = [
    factor({ id: 'f1', name: 'Drive', definition: 'Sustained effort.' }),
    factor({ id: 'f2', name: 'Coaching', definition: 'Grows others.' }),
  ]

  it('sends the raw position description when there is one', () => {
    const { request, keys } = buildStage1Request({
      modelId: 'typesafe/jev-1.13',
      outcome: 'selection',
      rawText: '  Ward manager, 40 beds.  ',
      brief: brief(),
      factors,
    })

    expect(request.model).toBe('typesafe/jev-1.13')
    expect(request.state).toEqual({
      decision: 'selection (hiring into this role)',
      position_description: 'Ward manager, 40 beds.',
    })
    expect(keys.size).toBe(2)
  })

  it('renders the brief when there is no raw text', () => {
    const withoutRaw = buildStage1Request({
      modelId: 'm',
      outcome: 'development',
      brief: brief(),
      factors,
    })
    const blankRaw = buildStage1Request({
      modelId: 'm',
      outcome: 'development',
      rawText: '   ',
      brief: brief(),
      factors,
    })

    const state = withoutRaw.request.state as Record<string, string>
    expect(state.role_brief).toContain('Role title: Nurse Unit Manager')
    expect(state.position_description).toBeUndefined()
    expect(blankRaw.request.state).toEqual(withoutRaw.request.state)
  })

  it('asks the level question plus one 5-level question per factor', () => {
    const { request, keys } = buildStage1Request({
      modelId: 'm',
      outcome: 'selection',
      brief: brief(),
      factors,
    })

    expect(Object.keys(request.questions)).toEqual([LEVEL_QUESTION_KEY, 'drive', 'coaching'])
    const level = request.questions[LEVEL_QUESTION_KEY]
    expect(level.type).toBe('choice')
    expect(Object.keys((level as { criteria: Record<string, string> }).criteria)).toHaveLength(5)

    const drive = request.questions.drive
    expect(drive.type).toBe('score')
    expect((drive as { criteria: string[] }).criteria).toHaveLength(5)
    expect(drive.instructions).toContain('"Drive"')
    expect(drive.instructions).toContain('Sustained effort.')
    expect(keys.get('drive')).toBe('f1')
    expect(keys.get('coaching')).toBe('f2')
  })
})

describe('buildStage2Request', () => {
  it('adds the shortlist names to the state and asks no level question', () => {
    const shortlist = [factor({ id: 'f1', name: 'Drive' }), factor({ id: 'f2', name: 'Coaching' })]
    const { request, keys } = buildStage2Request({
      modelId: 'm',
      outcome: 'team_composition',
      rawText: 'A position description.',
      brief: brief(),
      shortlist,
    })

    expect(request.state).toEqual({
      decision: 'team composition (balancing a team around this role)',
      position_description: 'A position description.',
      shortlisted_competencies: ['Drive', 'Coaching'],
    })
    expect(Object.keys(request.questions)).toEqual(['drive', 'coaching'])
    expect(request.questions.drive.type).toBe('score')
    expect((request.questions.drive as { criteria: string[] }).criteria).toHaveLength(4)
    expect(keys.get('coaching')).toBe('f2')
  })
})

describe('JEV_CRITERIA_VERSION', () => {
  it('is the version recorded as promptVersion', () => {
    expect(JEV_CRITERIA_VERSION).toBe(1)
  })
})
