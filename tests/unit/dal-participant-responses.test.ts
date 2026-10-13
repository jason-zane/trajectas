import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { getParticipantResponses } from '@/lib/dal/participants'

function query(data: unknown, error: unknown = null) {
  const result = { data, error }
  const chain = {
    select: () => chain, eq: () => chain, order: () => chain,
    maybeSingle: async () => result,
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  return chain
}
function client(from: ReturnType<typeof vi.fn>) { return { from } as unknown as SupabaseClient }

describe('participant response query states', () => {
  it('surfaces a session lookup error instead of claiming no responses were recorded', async () => {
    const from = vi.fn(() => query(null, { message: 'Transport failure', code: '08006' }))
    await expect(getParticipantResponses(client(from), 'session')).rejects.toThrow('Unable to load participant session')
    expect(from).toHaveBeenCalledTimes(1)
  })
  it('returns an empty result only when the session is absent', async () => {
    const from = vi.fn(() => query(null))
    expect(await getParticipantResponses(client(from), 'session')).toEqual([])
    expect(from).toHaveBeenCalledTimes(1)
  })
  it('renders a stored scalar Likert answer whose optional response_data is empty', async () => {
    const from = vi.fn((table: string) => query({
      participant_sessions: { assessment_id: 'assessment' },
      assessment_sections: [{ id: 'section', title: 'Questionnaire', display_order: 0, assessment_section_items: [{ item_id: 'item', display_order: 0, items: { id: 'item', stem: 'Synthetic question' } }] }],
      participant_responses: [{ item_id: 'item', response_value: 1, response_data: {}, response_time_ms: 45 }],
    }[table]))
    expect(await getParticipantResponses(client(from), 'session')).toEqual([expect.objectContaining({
      sectionId: 'section', items: [expect.objectContaining({ itemId: 'item', responseValue: 1, responseTimeMs: 45 })],
    })])
  })
})
