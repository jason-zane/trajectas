import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getModelForTask: vi.fn(),
  getActiveSystemPrompt: vi.fn(),
  getDefaultProvider: vi.fn(),
  getProvider: vi.fn(),
  runJevMatching: vi.fn(),
  runRankingExplanation: vi.fn(),
  logActionError: vi.fn(),
  complete: vi.fn(),
}))

vi.mock('@/lib/ai/model-config', () => ({ getModelForTask: mocks.getModelForTask }))
vi.mock('@/lib/ai/prompt-config', () => ({ getActiveSystemPrompt: mocks.getActiveSystemPrompt }))
vi.mock('@/lib/ai/providers', () => ({
  getDefaultProvider: mocks.getDefaultProvider,
  getProvider: mocks.getProvider,
}))
vi.mock('@/lib/ai/matching/jev-engine', () => ({ runJevMatching: mocks.runJevMatching }))
vi.mock('@/lib/ai/matching/ranking-explanation', () => ({
  runRankingExplanation: mocks.runRankingExplanation,
}))
vi.mock('@/lib/security/action-errors', () => ({
  logActionError: mocks.logActionError,
  throwActionError: vi.fn(),
}))

import type { Brief, MatchingFactor, MatchingInput } from '@/types/ai'
import { runMatching } from '@/lib/ai/matching/engine'

const JEV_MODEL = 'typesafe/jev-1.13'

const brief: Brief = {
  roleTitle: 'Nurse Unit Manager',
  level: 'ic',
  function: 'healthcare',
  outcome: 'selection',
  outcomeIntent: 'hiring',
  responsibilities: [],
  contextSignals: [],
  technicalRequirements: [],
  confidence: 'high',
}

const anyLevelFactor: MatchingFactor = {
  id: 'f1',
  name: 'Drive',
  definition: 'Sustained effort.',
  applicableLevels: [],
}
const executiveOnlyFactor: MatchingFactor = {
  id: 'f2',
  name: 'Enterprise Strategy',
  definition: 'Sets enterprise direction.',
  applicableLevels: ['executive'],
}

const briefInput: MatchingInput = {
  source: { kind: 'brief', brief, rawText: 'A ward manager position description.' },
  availableFactors: [anyLevelFactor, executiveOnlyFactor],
}

function llmPayload() {
  return JSON.stringify({
    summary: 'LLM summary.',
    rankings: [
      {
        factorId: 'f1',
        factorName: 'Drive',
        rank: 1,
        relevanceScore: 90,
        reasoning: 'LLM reason.',
        incrementalValue: 90,
        cumulativeValue: 100,
      },
    ],
    recommendedCount: { minimum: 1, optimal: 1, maximum: 1 },
  })
}

beforeEach(() => {
  mocks.getModelForTask.mockResolvedValue({
    purpose: 'competency_matching',
    modelId: JEV_MODEL,
    config: {},
  })
  mocks.getActiveSystemPrompt.mockResolvedValue({
    id: 'p1',
    name: 'Matching',
    purpose: 'competency_matching',
    content: 'System prompt.',
    version: 7,
  })
  mocks.complete.mockResolvedValue({
    content: llmPayload(),
    model: 'anthropic/claude-sonnet-4-5',
    provider: 'custom',
    usage: { inputTokens: 10, outputTokens: 20 },
  })
  mocks.getDefaultProvider.mockResolvedValue({
    type: 'custom',
    name: 'Test',
    isAvailable: async () => true,
    complete: mocks.complete,
  })
  mocks.runRankingExplanation.mockResolvedValue({
    summary: null,
    reasons: {},
    usage: { inputTokens: 0, outputTokens: 0 },
  })
})

function jevOutput() {
  return {
    rankings: [
      { factorId: 'f2', factorName: 'Enterprise Strategy', rank: 1, relevanceScore: 88, reasoning: '', incrementalValue: 88, cumulativeValue: 60 },
      { factorId: 'f1', factorName: 'Drive', rank: 2, relevanceScore: 70, reasoning: '', incrementalValue: 35, cumulativeValue: 100 },
    ],
    summary: 'Jev fallback summary.',
    recommendedCount: { minimum: 2, optimal: 2, maximum: 2 },
    usage: { inputTokens: 5000, outputTokens: 30 },
    modelUsed: 'typesafe/jev-1.13-20260917',
    promptVersion: 1,
    engine: 'jev' as const,
    resolvedLevel: 'mid_manager' as const,
    levelConfidence: 0.91,
    levelSource: 'jev' as const,
  }
}

describe('runMatching routing', () => {
  it('(a) routes a brief to the Jev engine and merges the reasons stage', async () => {
    mocks.getModelForTask.mockResolvedValue({
      purpose: 'competency_matching',
      modelId: `~${JEV_MODEL}`,
      config: { reasons_count: 1 },
    })
    mocks.runJevMatching.mockResolvedValue(jevOutput())
    mocks.runRankingExplanation.mockResolvedValue({
      summary: 'Written summary.',
      reasons: { f2: 'Because strategy.' },
      usage: { inputTokens: 700, outputTokens: 300 },
    })

    const result = await runMatching(briefInput)

    expect(mocks.runJevMatching).toHaveBeenCalledWith(
      { source: briefInput.source, availableFactors: briefInput.availableFactors },
      { modelId: `~${JEV_MODEL}`, config: {} },
    )
    // reasons_count = 1 → only the top pick is sent for prose.
    expect(mocks.runRankingExplanation).toHaveBeenCalledWith({
      brief,
      picks: [
        {
          factorId: 'f2',
          factorName: 'Enterprise Strategy',
          definition: 'Sets enterprise direction.',
          relevanceScore: 88,
        },
      ],
    })

    expect(result.engine).toBe('jev')
    expect(result.resolvedLevel).toBe('mid_manager')
    expect(result.summary).toBe('Written summary.')
    expect(result.rankings[0].reasoning).toBe('Because strategy.')
    expect(result.rankings[1].reasoning).toBe('')
    expect(result.usage).toEqual({ inputTokens: 5700, outputTokens: 330 })
    expect(mocks.complete).not.toHaveBeenCalled()
  })

  it('(a2) keeps the engine summary when the reasons stage produced none', async () => {
    mocks.runJevMatching.mockResolvedValue(jevOutput())

    const result = await runMatching(briefInput)

    expect(result.summary).toBe('Jev fallback summary.')
    expect(result.usage).toEqual({ inputTokens: 5000, outputTokens: 30 })
  })

  it('(b) falls back to the LLM path with fallback_model_id when Jev throws', async () => {
    mocks.getModelForTask.mockResolvedValue({
      purpose: 'competency_matching',
      modelId: JEV_MODEL,
      config: { fallback_model_id: 'anthropic/claude-opus-4-1' },
    })
    mocks.runJevMatching.mockRejectedValue(new Error('jev exploded'))

    const result = await runMatching(briefInput)

    expect(mocks.logActionError).toHaveBeenCalledWith('matching.jev', expect.any(Error))
    expect(mocks.complete).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'anthropic/claude-opus-4-1' }),
    )
    expect(result.engine).toBe('llm')
    expect(result.summary).toBe('LLM summary.')
    expect(result.promptVersion).toBe(7)
  })

  it('(b2) uses the default fallback model when the config does not name one', async () => {
    mocks.runJevMatching.mockRejectedValue(new Error('jev exploded'))

    await runMatching(briefInput)

    expect(mocks.complete).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'anthropic/claude-sonnet-4-5' }),
    )
  })

  it('(c) never sends a diagnostic source to Jev, substituting the fallback model', async () => {
    const result = await runMatching({
      source: { kind: 'diagnostic', clientId: 'c1', diagnosticData: { d1: 3.2 } },
      availableFactors: [anyLevelFactor, executiveOnlyFactor],
    })

    expect(mocks.runJevMatching).not.toHaveBeenCalled()
    expect(result.engine).toBe('llm')
    const call = mocks.complete.mock.calls[0][0] as { model: string; prompt: string }
    expect(call.model).toBe('anthropic/claude-sonnet-4-5')
    // Diagnostic pools are not level-filtered.
    expect(call.prompt).toContain('Enterprise Strategy')
  })

  it('(d) applies the hard level filter on the LLM path', async () => {
    mocks.getModelForTask.mockResolvedValue({
      purpose: 'competency_matching',
      modelId: 'anthropic/claude-sonnet-4-5',
      config: { temperature: 0.1, max_tokens: 2048 },
    })

    const result = await runMatching(briefInput)

    expect(mocks.runJevMatching).not.toHaveBeenCalled()
    const call = mocks.complete.mock.calls[0][0] as {
      prompt: string
      temperature: number
      maxTokens: number
    }
    expect(call.prompt).toContain('Drive')
    expect(call.prompt).not.toContain('Enterprise Strategy')
    expect(call.temperature).toBe(0.1)
    expect(call.maxTokens).toBe(2048)
    expect(result.engine).toBe('llm')
    expect(result.modelUsed).toBe('anthropic/claude-sonnet-4-5')
  })

  it('(e) returns an empty output without calling the model when nothing survives the filter', async () => {
    mocks.getModelForTask.mockResolvedValue({
      purpose: 'competency_matching',
      modelId: 'anthropic/claude-sonnet-4-5',
      config: {},
    })

    const result = await runMatching({
      source: { kind: 'brief', brief },
      availableFactors: [executiveOnlyFactor],
    })

    expect(result).toMatchObject({
      rankings: [],
      summary: 'No eligible factors matched this brief.',
      recommendedCount: { minimum: 0, optimal: 0, maximum: 0 },
      modelUsed: 'anthropic/claude-sonnet-4-5',
      engine: 'llm',
    })
    expect(mocks.complete).not.toHaveBeenCalled()
    expect(mocks.getDefaultProvider).not.toHaveBeenCalled()
  })

  it('passes validated Jev knobs through and ignores garbage', async () => {
    mocks.getModelForTask.mockResolvedValue({
      purpose: 'competency_matching',
      modelId: JEV_MODEL,
      config: {
        level_confidence_gate: 0.55,
        level_penalty: 'lots',
        rerank: false,
        shortlist_size: 6.7,
        reasons_count: 'many',
      },
    })
    mocks.runJevMatching.mockResolvedValue(jevOutput())

    await runMatching(briefInput)

    expect(mocks.runJevMatching).toHaveBeenCalledWith(expect.anything(), {
      modelId: JEV_MODEL,
      config: { levelConfidenceGate: 0.55, rerank: false, shortlistSize: 6 },
    })
    // reasons_count fell back to 8, so both rankings are sent for prose.
    expect(mocks.runRankingExplanation.mock.calls[0][0].picks).toHaveLength(2)
  })

  it('honours an explicit modelId override', async () => {
    mocks.runJevMatching.mockResolvedValue(jevOutput())

    await runMatching(briefInput, { modelId: 'typesafe/jev-2.0' })

    expect(mocks.runJevMatching).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ modelId: 'typesafe/jev-2.0' }),
    )
  })
})
