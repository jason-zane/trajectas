import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  access: vi.fn(), confidentiality: vi.fn(), responses: vi.fn(),
  admin: vi.fn(), rls: vi.fn(), audit: vi.fn(), feature: vi.fn(),
}))
vi.mock('@/lib/auth/authorization', () => ({
  AuthorizationError: class extends Error {},
  requireSessionAccess: mocks.access,
  assertIndividualResultsAccess: mocks.confidentiality,
}))
vi.mock('@/lib/features/access', () => ({ requireWorkspaceFeature: mocks.feature }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.rls }))
vi.mock('@/lib/dal/participants', () => ({ getParticipantResponses: mocks.responses }))
vi.mock('@/lib/auth/support-sessions', () => ({ logSupportSessionDataAccess: mocks.audit }))
vi.mock('@/lib/security/action-errors', () => ({ logActionError: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getParticipantResponses } from '@/app/actions/participants'
import { AuthorizationError } from '@/lib/auth/authorization'

const sessionId = '11111111-1111-4111-8111-111111111111'
const access = { scope: { isPlatformAdmin: false }, confidentialityMode: 'standard', clientId: 'client', partnerId: 'partner' }
const admin = {}
beforeEach(() => {
  mocks.access.mockResolvedValue(access)
  mocks.admin.mockReturnValue(admin)
  mocks.responses.mockResolvedValue([{ sectionId: 'section', items: [{ responseValue: 1 }] }])
})

describe('session item response access', () => {
  it('reads authorized token sessions through the admin client even when RLS hides null client_id', async () => {
    const groups = await getParticipantResponses(sessionId)
    expect(groups[0].items[0].responseValue).toBe(1)
    expect(mocks.confidentiality).toHaveBeenCalledWith(access.scope, 'standard')
    expect(mocks.responses).toHaveBeenCalledWith(admin, sessionId)
    expect(mocks.rls).not.toHaveBeenCalled()
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ resourceId: sessionId, clientId: 'client' }))
  })

  it('does not read responses for a session outside the workspace', async () => {
    mocks.access.mockRejectedValue(new AuthorizationError('Unauthorized'))
    expect(await getParticipantResponses(sessionId)).toEqual([])
    expect(mocks.responses).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })

  it('enforces aggregate-only confidentiality before using elevated reads', async () => {
    mocks.access.mockResolvedValue({ ...access, confidentialityMode: 'aggregate_only' })
    mocks.confidentiality.mockImplementation(() => { throw new AuthorizationError('Aggregate only') })
    await expect(getParticipantResponses(sessionId)).rejects.toThrow('Aggregate only')
    expect(mocks.responses).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
})
