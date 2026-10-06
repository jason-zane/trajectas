import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ exists: false, marked: false, authorize: vi.fn() }))
vi.mock('@/lib/auth/participant-runtime', async original => ({
  ...await original<typeof import('@/lib/auth/participant-runtime')>(),
  requireParticipantRuntimeCampaignAssessmentAccess: state.authorize,
}))
vi.mock('@/lib/dal/public-builds', () => ({ markPublicBuildStarted: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  from(table: string) {
    let inserting = false
    let updating = false
    let freshRead = false
    const query: Record<string, unknown> = {}
    for (const key of ['select', 'eq', 'in', 'single']) query[key] = () => query
    query.abortSignal = () => { freshRead = true; return query }
    query.insert = () => { inserting = true; return query }
    query.update = () => { updating = true; return query }
    query.then = (resolve: (result: unknown) => unknown) => {
      if (table === 'campaign_participants' && updating) {
        state.marked = true
        return Promise.resolve({ data: null, error: null }).then(resolve)
      }
      if (table !== 'participant_sessions') throw new Error(`Unexpected table ${table}`)
      if (inserting) {
        // Another render wins between the initial read and our insert.
        state.exists = true
        return Promise.resolve({ data: null, error: { code: '23505' } }).then(resolve)
      }
      // Simulate the render's memoized empty GET unless the caller opts out.
      return Promise.resolve({ data: freshRead && state.exists ? { id: 'winner-session' } : null, error: null }).then(resolve)
    }
    return query
  },
}) }))
import { startSession } from '@/app/actions/assess'

beforeEach(() => { state.exists = false; state.marked = false; state.authorize.mockResolvedValue(undefined) })

it('recovers a concurrent session start with a fresh read and marks participation started', async () => {
  const result = await startSession('synthetic-token',
    '30000000-0000-4000-8000-000000000600',
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000500')
  expect(result).toEqual({ id: 'winner-session' })
  expect(state.marked).toBe(true)
  expect(state.authorize).toHaveBeenCalled()
})
