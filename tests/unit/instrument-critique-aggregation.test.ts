import { expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
const fixture = vi.hoisted(() => ({ complete: vi.fn(), persist: vi.fn(), items: ['keep', 'revise', 'drop', 'malformed', 'error'].map((id, i) => ({ id, stem: `Statement ${i}`, status: 'candidate' })) }))
vi.mock('@/lib/dal/instrument', () => ({ listCandidateItemsByBlueprint: async () => fixture.items, updateCandidateItem: fixture.persist }))
vi.mock('@/lib/ai/model-config', () => ({ getModelForTask: async () => ({ modelId: 'test/model' }) }))
vi.mock('@/lib/ai/prompt-config', () => ({ getActiveSystemPrompt: async () => ({ content: 'Review these items.' }) }))
vi.mock('@/lib/ai/providers/openrouter', () => ({ openRouterProvider: { complete: fixture.complete } }))
import { runCritiquePass } from '@/lib/instrument/critique'

it('counts inner critique results instead of the concurrency wrapper and distinguishes malformed responses', async () => {
  fixture.complete.mockImplementation(async ({ prompt }: { prompt: string }) => {
    const index = Number(prompt.match(/Statement (\d)/)?.[1])
    if (index === 4) throw new Error('Provider unavailable')
    return { content: index === 3 ? 'broken' : JSON.stringify({ verdict: ['keep', 'revise', 'drop'][index], reason: 'A substantive critique.' }) }
  })
  const result = await runCritiquePass({} as SupabaseClient, 'blueprint', 'Dependability')
  expect(result.stats).toEqual({ totalItems: 5, kept: 1, revised: 1, dropped: 1, failedParses: 1, providerErrors: 1 })
  expect(result.results.map(item => item.verdict).sort()).toEqual(['drop', 'keep', 'revise'])
  expect(fixture.persist).toHaveBeenCalledTimes(3)
})
