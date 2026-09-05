import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), log: vi.fn() }))
vi.mock('@/lib/security/action-errors', () => ({ logActionError: mocks.log }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => {
  const chain = { select: () => chain, eq: () => chain, is: () => chain, single: mocks.lookup }
  return { from: () => chain }
} }))
vi.mock('react', async importOriginal => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T) => fn }))

import { validateAccessToken } from '@/app/actions/assess'

describe('participant token lookup failures', () => {
  it('keeps a genuinely unknown token unavailable', async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    expect(await validateAccessToken('f'.repeat(64))).toEqual({ error: 'Invalid or expired access link' })
    expect(mocks.log).not.toHaveBeenCalled()
  })

  it.each(['', '42501'])('treats a lookup failure as a retryable page failure, without authorizing access (%s)', async code => {
    mocks.lookup.mockResolvedValue({ data: null, error: { code, message: 'internal diagnostic' } })
    await expect(validateAccessToken('e'.repeat(64))).rejects.toThrow('Unable to load this assessment right now')
    expect(mocks.log).toHaveBeenCalledWith('validateAccessToken.participant', expect.objectContaining({ code }))
    expect(mocks.lookup).toHaveBeenCalledTimes(1)
  })
})
