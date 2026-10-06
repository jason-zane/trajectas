import { describe, expect, it, vi } from 'vitest'
import { MultipleTrajectoryPeopleError } from '@/lib/features/workspace-features'
const calls = vi.hoisted(() => ({ feature: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/features/access', () => ({ requireInsightExperience: calls.feature }))
vi.mock('@/lib/auth/authorization', () => ({ requireParticipantAccess: async () => ({ scope: { isPlatformAdmin: false } }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: calls.from }) }))
import { getComparisonCanvas } from '@/app/actions/canvas'
describe('individual trajectory selection boundary', () => {
  it('rejects multiple distinct people before loading histories or scores', async () => {
    const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']
    const query = { select: vi.fn(), in: vi.fn(), is: vi.fn().mockResolvedValue({ data: ids.map(id => ({ id, person_key: id, email: 'test@example.test', campaigns: { client_id: 'test-client' } })), error: null }) }
    query.select.mockReturnValue(query); query.in.mockReturnValue(query); calls.from.mockReturnValue(query)
    await expect(getComparisonCanvas(ids, 'individual')).rejects.toBeInstanceOf(MultipleTrajectoryPeopleError)
    expect(calls.feature).toHaveBeenCalledWith('individual')
    expect(calls.from).toHaveBeenCalledTimes(1)
    expect(calls.from).toHaveBeenCalledWith('campaign_participants')
  })
})
