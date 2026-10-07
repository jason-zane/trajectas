import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'
import { AuthorizationError } from '@/lib/auth/authorization'

const state = vi.hoisted(() => ({
  features: {} as Record<string, unknown>,
  manage: vi.fn(), open: vi.fn(), writes: vi.fn(), audit: vi.fn(), revalidate: vi.fn(),
  participants: [] as Record<string, unknown>[],
}))
vi.mock('@/lib/dal/workspace-features', () => ({ getEffectiveWorkspaceFeatures: async () => state.features }))
vi.mock('@/lib/auth/authorization', async original => ({
  ...await original<typeof import('@/lib/auth/authorization')>(),
  requireCampaignManage: state.manage,
}))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEvent: state.audit }))
vi.mock('next/cache', () => ({ revalidatePath: state.revalidate, revalidateTag: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => {
  state.open()
  return { from: (table: string) => {
    const filters: [string, unknown][] = []
    let values: Record<string, unknown> = {}
    const query = {
      update: (patch: Record<string, unknown>) => { values = patch; return query },
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query },
      is: (key: string, value: unknown) => { filters.push([key, value]); return query },
      then: (resolve: (value: unknown) => unknown) => {
        const matched = state.participants.filter(row => filters.every(([key, value]) => row[key] === value))
        state.writes({ table, values, filters, matched: matched.length })
        for (const row of matched) Object.assign(row, values)
        return Promise.resolve({ error: null }).then(resolve)
      },
    }
    return query
  } }
} }))
import { removeParticipant, restoreParticipant } from '@/app/actions/campaigns'

const access = { scope: { actor: { id: 'synthetic-manager' } }, partnerId: 'synthetic-partner', clientId: 'synthetic-client' }
beforeEach(() => {
  state.features = defaultWorkspaceFeatures('partner')
  state.participants = [
    { id: 'participant', campaign_id: 'managed', deleted_at: null },
    { id: 'foreign-participant', campaign_id: 'foreign', deleted_at: null },
  ]
  state.manage.mockImplementation(async (campaignId: string) => {
    if (campaignId !== 'managed') throw new AuthorizationError('Foreign campaign is unavailable.')
    return access
  })
})

describe('participant Remove and Undo share campaign-management availability', () => {
  it.each([true, false])('removes and undoes together with invitations %s, retaining scope and audit', async invitations => {
    state.features.participantInvitations = invitations
    expect(await removeParticipant('managed', 'participant')).toEqual({ success: true })
    expect(state.participants[0].deleted_at).toEqual(expect.any(String))
    expect(await restoreParticipant('managed', 'participant')).toEqual({ success: true })
    expect(state.participants[0].deleted_at).toBeNull()
    expect(state.participants[1].deleted_at).toBeNull()
    expect(state.manage.mock.calls).toEqual([['managed'], ['managed']])
    expect(state.writes).toHaveBeenCalledTimes(2)
    for (const eventType of ['campaign.participant.removed', 'campaign.participant.restored']) {
      expect(state.audit).toHaveBeenCalledWith({ actorProfileId: 'synthetic-manager', eventType,
        targetTable: 'campaign_participants', targetId: 'participant', partnerId: access.partnerId,
        clientId: access.clientId, metadata: { campaignId: 'managed' } })
    }
    expect(state.revalidate).toHaveBeenCalledWith('/campaigns/managed/participants')
  })

  it.each([removeParticipant, restoreParticipant])('denies %s before authorization or a service client when management is off', async action => {
    state.features.campaignManagement = false
    await expect(action('managed', 'participant')).rejects.toThrow('not enabled')
    expect(state.manage).not.toHaveBeenCalled()
    expect(state.open).not.toHaveBeenCalled()
    expect(state.writes).not.toHaveBeenCalled()
    expect(state.audit).not.toHaveBeenCalled()
  })

  it.each([removeParticipant, restoreParticipant])('retains %s role and foreign-campaign denial before service writes', async action => {
    state.features.participantInvitations = false
    expect(await action('foreign', 'foreign-participant')).toHaveProperty('error', 'Foreign campaign is unavailable.')
    state.manage.mockRejectedValue(new AuthorizationError('Not authorized to manage this campaign.'))
    expect(await action('managed', 'participant')).toHaveProperty('error', 'Not authorized to manage this campaign.')
    expect(state.open).not.toHaveBeenCalled()
    expect(state.writes).not.toHaveBeenCalled()
    expect(state.audit).not.toHaveBeenCalled()
  })

  it.each([removeParticipant, restoreParticipant])('keeps %s participant writes confined to the supplied authorized campaign', async action => {
    state.participants[1].deleted_at = 'synthetic-existing-removal'
    await action('managed', 'foreign-participant')
    expect(state.participants[1].deleted_at).toBe('synthetic-existing-removal')
    expect(state.writes).toHaveBeenCalledWith(expect.objectContaining({ matched: 0,
      filters: expect.arrayContaining([['id', 'foreign-participant'], ['campaign_id', 'managed']]) }))
  })
})
