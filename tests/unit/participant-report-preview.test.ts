import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ access: vi.fn(), manage: vi.fn(), adminFrom: vi.fn(), rlsFrom: vi.fn(), feature: vi.fn(), predicates: vi.fn() }))
vi.mock('@/lib/auth/authorization', () => ({ requireParticipantAccess: mocks.access, canManageCampaign: mocks.manage }))
vi.mock('@/lib/features/access', () => ({ requireWorkspaceFeature: vi.fn(), isWorkspaceFeatureEnabled: mocks.feature }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.adminFrom }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: mocks.rlsFrom }) }))
vi.mock('@/lib/auth/support-sessions', () => ({ logSupportSessionDataAccess: vi.fn() }))
vi.mock('@/lib/supabase/mappers', () => ({ mapReportSnapshotRow: (row: unknown) => row }))
vi.mock('@/lib/security/action-errors', () => ({ logActionError: vi.fn(), throwActionError: (_name: string, message: string) => { throw new Error(message) } }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }))

import { getReportSnapshotsForParticipant } from '@/app/actions/reports'

const participantId = '11111111-1111-4111-8111-111111111111'
const access = { scope: { isPlatformAdmin: false, isLocalDevelopmentBypass: false }, clientId: null, partnerId: 'partner', confidentialityMode: 'standard' }
const ready = { id: 'ready-report', status: 'ready', releasedAt: undefined }
function query(data: unknown, error: unknown = null) {
  const result = { data, error }
  const chain = {
    select: () => chain, eq: (key: string, value: unknown) => { mocks.predicates(key, value); return chain },
    in: (key: string, value: unknown) => { mocks.predicates(key, value); return chain }, order: () => chain,
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  return chain
}
beforeEach(() => {
  mocks.access.mockResolvedValue(access)
  mocks.manage.mockReturnValue(true)
  mocks.feature.mockResolvedValue(false)
  mocks.adminFrom.mockImplementation((table: string) => query(table === 'participant_sessions' ? [{ id: 'session' }] : [ready]))
  mocks.rlsFrom.mockReturnValue(query([]))
})

describe('participant report previews match session report previews', () => {
  it('lets campaign managers see a ready report for an authorized clientless partner campaign', async () => {
    expect(await getReportSnapshotsForParticipant(participantId)).toEqual([expect.objectContaining(ready)])
    expect(mocks.access).toHaveBeenCalledWith(participantId)
    expect(mocks.predicates).toHaveBeenCalledWith('campaign_participant_id', participantId)
    expect(mocks.predicates).toHaveBeenCalledWith('participant_session_id', ['session'])
    expect(mocks.rlsFrom).not.toHaveBeenCalled()
  })
  it('keeps release and audience RLS filtering for ordinary members', async () => {
    mocks.manage.mockReturnValue(false)
    expect(await getReportSnapshotsForParticipant(participantId)).toEqual([])
    expect(mocks.adminFrom).toHaveBeenCalledWith('participant_sessions')
    expect(mocks.adminFrom).not.toHaveBeenCalledWith('report_snapshots')
    expect(mocks.rlsFrom).toHaveBeenCalledWith('report_snapshots')
  })
  it('permits platform support previews only after the participant workspace gate', async () => {
    mocks.manage.mockReturnValue(false)
    mocks.access.mockResolvedValue({ ...access, scope: { ...access.scope, isPlatformAdmin: true } })
    expect(await getReportSnapshotsForParticipant(participantId)).toHaveLength(1)
    expect(mocks.rlsFrom).not.toHaveBeenCalled()
  })
  it('withholds every report for an aggregate-only tenant viewer', async () => {
    mocks.access.mockResolvedValue({ ...access, confidentialityMode: 'aggregate_only' })
    expect(await getReportSnapshotsForParticipant(participantId)).toEqual([])
    expect(mocks.adminFrom).not.toHaveBeenCalled()
    expect(mocks.rlsFrom).not.toHaveBeenCalled()
  })
  it('does not query another workspace when authorization fails', async () => {
    mocks.access.mockRejectedValue(new Error('Unauthorized'))
    await expect(getReportSnapshotsForParticipant(participantId)).rejects.toThrow('Unauthorized')
    expect(mocks.adminFrom).not.toHaveBeenCalled()
    expect(mocks.rlsFrom).not.toHaveBeenCalled()
  })
  it('surfaces a failed session query rather than showing no reports', async () => {
    mocks.adminFrom.mockReturnValue(query(null, { message: 'Database error' }))
    await expect(getReportSnapshotsForParticipant(participantId)).rejects.toThrow('Unable to load report snapshots')
  })
})
