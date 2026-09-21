import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ admin: vi.fn(), manager: vi.fn(), save: vi.fn(), audit: vi.fn(), revalidate: vi.fn(), tag: vi.fn() }))
vi.mock('@/lib/auth/authorization', () => ({ requireAdminScope: mocks.admin }))
vi.mock('@/lib/dal/model-management', () => ({ requireModelManager: mocks.manager, setCapabilityChannel: mocks.save }))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEventSafe: mocks.audit }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate, updateTag: mocks.tag }))
import { updateCapabilityAvailability } from '@/app/actions/model-management'
const id = '11111111-1111-4111-8111-111111111111'
beforeEach(() => { mocks.admin.mockResolvedValue({}); mocks.manager.mockResolvedValue({actor:{id:'actor'}}); mocks.save.mockResolvedValue(undefined) })
it('rejects unauthorized calls before mutation', async () => {
  mocks.admin.mockRejectedValue(new Error('Unauthorized'))
  await expect(updateCapabilityAvailability({ids:[id],channel:'public',enabled:true})).rejects.toThrow('Unauthorized')
  expect(mocks.save).not.toHaveBeenCalled()
})
it('rejects unsupported columns rather than passing arbitrary keys into updates', async () => {
  expect(await updateCapabilityAvailability({ids:[id],channel:'client_id',enabled:true})).toHaveProperty('error')
  expect(mocks.save).not.toHaveBeenCalled()
})
it('deduplicates a bulk request, records the actor and invalidates consumers', async () => {
  expect(await updateCapabilityAvailability({ids:[id,id],channel:'public',enabled:true})).toEqual({})
  expect(mocks.save).toHaveBeenCalledWith([id],'public',true)
  expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({actorProfileId:'actor',metadata:{ids:[id],channel:'public',enabled:true}}))
  expect(mocks.revalidate).toHaveBeenCalledWith('/capability-model')
  expect(mocks.tag).toHaveBeenCalledWith('taxonomy')
})
it('reports persistence failure without claiming a successful change', async () => {
  mocks.save.mockRejectedValue(new Error('Could not save availability.'))
  expect(await updateCapabilityAvailability({ids:[id],channel:'public',enabled:true})).toEqual({error:'Could not save availability.'})
  expect(mocks.audit).not.toHaveBeenCalled()
})
