import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ send: vi.fn(), limit: vi.fn(), bot: vi.fn(), log: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '127.0.0.1' }) }))
vi.mock('botid/server', () => ({ checkBotId: mocks.bot }))
vi.mock('@/lib/email/provider', () => ({ sendHtmlEmail: mocks.send }))
vi.mock('@/lib/security/rate-limit', () => ({ checkKeyedRateLimit: mocks.limit }))
vi.mock('@/lib/security/action-errors', () => ({ logActionError: mocks.log }))
vi.mock('@/lib/public-builds/constants', () => ({ getPublicBuildsMode: () => 'closed' }))
import { requestBuildAccess } from '@/app/actions/public-build-access'

beforeEach(() => { vi.resetAllMocks(); mocks.bot.mockResolvedValue({ isBot: false }); mocks.limit.mockResolvedValue({ allowed: true }); mocks.send.mockResolvedValue({ id: 'accepted' }) })
describe('requestBuildAccess', () => {
  it('notifies Trajectas and confirms to the normalized requester without granting access', async () => {
    expect(await requestBuildAccess({ email: ' Person@Example.com ' })).toEqual({ success: true, confirmationSent: true })
    expect(mocks.send).toHaveBeenNthCalledWith(1, expect.objectContaining({ to: 'hello@trajectas.com', replyTo: 'person@example.com' }))
    expect(mocks.send).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: 'person@example.com', replyTo: 'hello@trajectas.com' }))
    expect(mocks.limit).toHaveBeenCalledTimes(3)
    expect(mocks.send.mock.calls[1][0].text).toContain('does not grant access')
  })
  it('rejects invalid addresses before any mail or bot checks', async () => {
    expect(await requestBuildAccess({ email: 'invalid' })).toHaveProperty('error')
    expect(mocks.bot).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled()
  })
  it('rejects bots and fails closed if bot verification is unavailable', async () => {
    mocks.bot.mockResolvedValueOnce({ isBot: true })
    expect(await requestBuildAccess({ email: 'person@example.com' })).toHaveProperty('error')
    mocks.bot.mockRejectedValueOnce(new Error('unavailable'))
    expect(await requestBuildAccess({ email: 'person@example.com' })).toHaveProperty('error')
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it.each([1, 2, 3])('sends no emails when rate limit %i denies the request', async blocked => {
    for (let i = 1; i < blocked; i++) mocks.limit.mockResolvedValueOnce({ allowed: true })
    mocks.limit.mockResolvedValueOnce({ allowed: false })
    expect(await requestBuildAccess({ email: 'person@example.com' })).toHaveProperty('error')
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('never acknowledges a request if notification delivery failed', async () => {
    mocks.send.mockRejectedValueOnce(new Error('provider rejected'))
    expect(await requestBuildAccess({ email: 'person@example.com' })).toHaveProperty('error')
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })
  it('reports partial success if only the requester confirmation fails', async () => {
    mocks.send.mockResolvedValueOnce({ id: 'accepted' }).mockRejectedValueOnce(new Error('rejected'))
    expect(await requestBuildAccess({ email: 'person@example.com' })).toEqual({ success: true, confirmationSent: false })
  })
})
