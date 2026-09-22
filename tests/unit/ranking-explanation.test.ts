import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  logActionError: vi.fn(),
  getModelForTask: vi.fn(),
  getActiveSystemPrompt: vi.fn(),
  getDefaultProvider: vi.fn(),
}))

vi.mock('@/lib/security/action-errors', () => ({
  logActionError: mocks.logActionError,
  throwActionError: vi.fn(),
}))

vi.mock('@/lib/ai/model-config', () => ({ getModelForTask: mocks.getModelForTask }))
vi.mock('@/lib/ai/prompt-config', () => ({ getActiveSystemPrompt: mocks.getActiveSystemPrompt }))
vi.mock('@/lib/ai/providers', () => ({ getDefaultProvider: mocks.getDefaultProvider }))

import type { AIProvider } from '@/lib/ai/providers'
import type { Brief } from '@/types/ai'
import {
  buildExplanationPrompt,
  parseExplanation,
  runRankingExplanation,
  type ExplanationPick,
} from '@/lib/ai/matching/ranking-explanation'

const brief: Brief = {
  roleTitle: 'Nurse Unit Manager',
  level: 'first_line_manager',
  function: 'healthcare',
  outcome: 'selection',
  outcomeIntent: 'hiring a ward manager',
  responsibilities: ['Run the ward roster'],
  contextSignals: [],
  technicalRequirements: [],
  confidence: 'high',
}

const picks: ExplanationPick[] = [
  { factorId: 'f1', factorName: 'Drive', definition: 'Sustained effort.', relevanceScore: 92 },
  { factorId: 'f2', factorName: 'Coaching', definition: 'Grows others.', relevanceScore: 81 },
]

function providerReturning(content: string, usage = { inputTokens: 900, outputTokens: 220 }): AIProvider {
  return {
    type: 'custom',
    name: 'Test',
    isAvailable: async () => true,
    complete: vi.fn(async () => ({ content, usage, model: 'anthropic/claude-haiku-4.5', provider: 'custom' as const })),
  }
}

const deps = {
  modelConfig: {
    purpose: 'ranking_explanation' as const,
    modelId: 'anthropic/claude-haiku-4.5',
    config: { temperature: 0.4, max_tokens: 900 },
  },
  prompt: {
    id: 'p1',
    name: 'Ranking Explanation v1',
    purpose: 'ranking_explanation' as const,
    content: 'You are an organisational psychologist.',
    version: 1,
  },
}

beforeEach(() => {
  mocks.logActionError.mockReset()
})

// ---------------------------------------------------------------------------
// parseExplanation
// ---------------------------------------------------------------------------

describe('parseExplanation', () => {
  const validIds = new Set(['f1', 'f2'])
  const idByName = new Map([
    ['Drive', 'f1'],
    ['Coaching', 'f2'],
  ])

  it('parses plain JSON', () => {
    expect(
      parseExplanation('{"summary":" Two sentences. ","reasons":{"f1":" Because. "}}', validIds),
    ).toEqual({ summary: 'Two sentences.', reasons: { f1: 'Because.' } })
  })

  it('parses fenced JSON', () => {
    const content = '```json\n{"summary":"S","reasons":{"f2":"R"}}\n```'
    expect(parseExplanation(content, validIds)).toEqual({ summary: 'S', reasons: { f2: 'R' } })
  })

  it('parses JSON wrapped in prose', () => {
    const content = 'Here you go:\n{"summary":"S","reasons":{"f1":"R"}}\nHope that helps.'
    expect(parseExplanation(content, validIds)).toEqual({ summary: 'S', reasons: { f1: 'R' } })
  })

  it('maps name-keyed reasons back to ids when a map is supplied', () => {
    expect(
      parseExplanation('{"summary":"S","reasons":{"Drive":"R1","Coaching":"R2"}}', validIds, idByName),
    ).toEqual({ summary: 'S', reasons: { f1: 'R1', f2: 'R2' } })
  })

  it('drops keys that are neither a known id nor a known name', () => {
    expect(
      parseExplanation('{"summary":"S","reasons":{"f9":"R","Unknown":"R","f1":"Keep"}}', validIds, idByName)
        .reasons,
    ).toEqual({ f1: 'Keep' })
  })

  it('drops non-string and blank values', () => {
    expect(
      parseExplanation('{"summary":"S","reasons":{"f1":42,"f2":"   "}}', validIds).reasons,
    ).toEqual({})
  })

  it('returns a null summary when it is missing, blank or not a string', () => {
    expect(parseExplanation('{"reasons":{"f1":"R"}}', validIds).summary).toBeNull()
    expect(parseExplanation('{"summary":"  ","reasons":{}}', validIds).summary).toBeNull()
    expect(parseExplanation('{"summary":7,"reasons":{}}', validIds).summary).toBeNull()
  })

  it('returns empty for unparseable, non-object, and array-shaped content', () => {
    expect(parseExplanation('not json at all', validIds)).toEqual({ summary: null, reasons: {} })
    expect(parseExplanation('{oops', validIds)).toEqual({ summary: null, reasons: {} })
    expect(parseExplanation('[1,2,3]', validIds)).toEqual({ summary: null, reasons: {} })
    expect(parseExplanation('"a string"', validIds)).toEqual({ summary: null, reasons: {} })
  })

  it('tolerates a reasons field that is not an object', () => {
    expect(parseExplanation('{"summary":"S","reasons":["R"]}', validIds)).toEqual({
      summary: 'S',
      reasons: {},
    })
  })
})

// ---------------------------------------------------------------------------
// buildExplanationPrompt
// ---------------------------------------------------------------------------

describe('buildExplanationPrompt', () => {
  it('lists one line per pick, keyed by factorId', () => {
    const prompt = buildExplanationPrompt({ brief, picks })
    expect(prompt).toContain('## Role brief')
    expect(prompt).toContain('"roleTitle":"Nurse Unit Manager"')
    expect(prompt).toContain('- f1 | Drive (92% match): Sustained effort.')
    expect(prompt).toContain('- f2 | Coaching (81% match): Grows others.')
    expect(prompt.endsWith('Write the reasons and the summary. JSON only.')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// runRankingExplanation
// ---------------------------------------------------------------------------

describe('runRankingExplanation', () => {
  it('returns the parsed reasons and the provider usage', async () => {
    const provider = providerReturning('{"summary":"A summary.","reasons":{"f1":"R1","Coaching":"R2"}}')

    const result = await runRankingExplanation({ brief, picks }, { ...deps, provider })

    expect(result).toEqual({
      summary: 'A summary.',
      reasons: { f1: 'R1', f2: 'R2' },
      usage: { inputTokens: 900, outputTokens: 220 },
    })
    expect(provider.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'anthropic/claude-haiku-4.5',
        systemPrompt: 'You are an organisational psychologist.',
        temperature: 0.4,
        maxTokens: 900,
        responseFormat: 'json',
      }),
    )
    expect(mocks.logActionError).not.toHaveBeenCalled()
  })

  it('resolves the model, prompt and provider from config when not injected', async () => {
    const provider = providerReturning('{"summary":"S","reasons":{}}')
    mocks.getModelForTask.mockResolvedValue({
      purpose: 'ranking_explanation',
      modelId: 'configured/model',
      config: {},
    })
    mocks.getActiveSystemPrompt.mockResolvedValue({ ...deps.prompt, content: 'Configured prompt.' })
    mocks.getDefaultProvider.mockResolvedValue(provider)

    await runRankingExplanation({ brief, picks })

    expect(provider.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'configured/model',
        systemPrompt: 'Configured prompt.',
        temperature: 0.4,
        maxTokens: 900,
      }),
    )
  })

  it('returns an empty result and logs when the provider throws', async () => {
    const provider: AIProvider = {
      type: 'custom',
      name: 'Test',
      isAvailable: async () => true,
      complete: vi.fn(async () => {
        throw new Error('upstream 500')
      }),
    }

    const result = await runRankingExplanation({ brief, picks }, { ...deps, provider })

    expect(result).toEqual({ summary: null, reasons: {}, usage: { inputTokens: 0, outputTokens: 0 } })
    expect(mocks.logActionError).toHaveBeenCalledWith('matching.explanation', expect.any(Error))
  })

  it('returns an empty result when the model config is missing', async () => {
    mocks.getModelForTask.mockRejectedValue(new Error('No AI model is configured'))

    const result = await runRankingExplanation({ brief, picks })

    expect(result.summary).toBeNull()
    expect(mocks.logActionError).toHaveBeenCalledWith('matching.explanation', expect.any(Error))
  })

  it('returns an empty result without calling the provider when there are no picks', async () => {
    const provider = providerReturning('{"summary":"S","reasons":{}}')

    const result = await runRankingExplanation({ brief, picks: [] }, { ...deps, provider })

    expect(result).toEqual({ summary: null, reasons: {}, usage: { inputTokens: 0, outputTokens: 0 } })
    expect(provider.complete).not.toHaveBeenCalled()
    expect(mocks.logActionError).not.toHaveBeenCalled()
  })

  it('drops a reason keyed by a name two picks share', async () => {
    const provider = providerReturning('{"summary":"S","reasons":{"Drive":"ambiguous"}}')
    const duplicated: ExplanationPick[] = [
      picks[0],
      { factorId: 'f3', factorName: 'Drive', definition: 'Other drive.', relevanceScore: 60 },
    ]

    const result = await runRankingExplanation({ brief, picks: duplicated }, { ...deps, provider })

    expect(result.reasons).toEqual({})
  })
})
