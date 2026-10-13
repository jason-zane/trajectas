import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), scope: vi.fn(), access: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.from }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/authorization', () => ({
  AuthorizationError: class extends Error {}, resolveAuthorizedScope: mocks.scope,
  requireSessionAccess: mocks.access,
  isUnconfinedPlatformAdmin: (scope: { isPlatformAdmin: boolean }) => scope.isPlatformAdmin,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getConstructScoresForFactor } from '@/app/actions/sessions'

const sessionId = '11111111-1111-4111-8111-111111111111'
function query(data: unknown) {
  const result = { data, error: null }
  const chain = {
    select: () => chain, eq: () => chain, in: () => chain,
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  return chain
}
function setup(config: Record<string, unknown>, response: number, reverseScored = false, optionValues: number[] = []) {
  mocks.from.mockImplementation((table: string) => query({
    factor_constructs: [{ construct_id: 'construct', constructs: { name: 'Construct' } }],
    items: [{ id: 'item', construct_id: 'construct', reverse_scored: reverseScored,
      response_formats: { type: 'likert', config },
      item_options: optionValues.map(value => ({ value, exclude_from_scoring: false })),
    }],
    participant_responses: [{ item_id: 'item', response_value: response }],
  }[table]))
}
beforeEach(() => { mocks.scope.mockResolvedValue({ isPlatformAdmin: true }) })

describe('construct score drilldown scale', () => {
  it.each([[2, false, 20], [6, false, 100], [2, true, 80]])(
    'scores a six-point response %s, reversed %s, as %s', async (response, reverseScored, expected) => {
      setup({ points: 6 }, response, reverseScored)
      expect((await getConstructScoresForFactor(sessionId, 'factor'))[0].scaledScore).toBe(expected)
    },
  )
  it('uses explicit scoring bounds', async () => {
    setup({ minValue: 0, maxValue: 10 }, 2)
    expect((await getConstructScoresForFactor(sessionId, 'factor'))[0].scaledScore).toBe(20)
  })
  it('uses the actual option scale when format config has no bounds', async () => {
    setup({}, 2, false, [1, 2, 3, 4, 5, 6])
    expect((await getConstructScoresForFactor(sessionId, 'factor'))[0].scaledScore).toBe(20)
  })
})
