import { afterEach, describe, expect, it, vi } from 'vitest'
import { getOrCreateSectionForms } from '@/lib/dal/session-forms'

const log = vi.hoisted(() => vi.fn())
vi.mock('@/lib/security/action-errors', () => ({ logActionError: log }))

function fixture() {
  const rpc = vi.fn()
  const from = vi.fn(() => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }))
  return { rpc, from }
}
const input = { sessionId: 'session', assessmentId: 'assessment', campaignId: null }
afterEach(() => vi.useRealTimers())

describe('idempotent form transport recovery', () => {
  it('retries closed sockets at most twice, re-reading the revision before each assembly', async () => {
    vi.useFakeTimers()
    const db = fixture()
    db.rpc.mockResolvedValueOnce({ data: null, error: { code: '', message: 'TypeError: fetch failed' } })
      .mockResolvedValueOnce({ data: null, error: { code: '', message: 'TypeError: fetch failed' } })
      .mockResolvedValue({ data: 1, error: null })
    const outcome = getOrCreateSectionForms(db as never, input)
    await vi.runAllTimersAsync()
    expect(await outcome).toBeInstanceOf(Map)
    expect(db.rpc).toHaveBeenCalledTimes(3)
    expect(log).not.toHaveBeenCalled()
  })

  it.each(['42501', '23514', 'PGRST301'])('never retries a database or authorization denial (%s)', async code => {
    const db = fixture()
    db.rpc.mockResolvedValue({ data: null, error: { code, message: 'denied' } })
    expect(await getOrCreateSectionForms(db as never, input)).toEqual({ error: 'Unable to load this assessment right now' })
    expect(db.rpc).toHaveBeenCalledTimes(1)
    expect(db.from).not.toHaveBeenCalled()
  })

  it('fails closed and logs once when the bounded network retry budget is exhausted', async () => {
    vi.useFakeTimers()
    const db = fixture()
    db.rpc.mockResolvedValue({ data: null, error: { code: '', message: 'TypeError: fetch failed' } })
    const outcome = getOrCreateSectionForms(db as never, input)
    await vi.runAllTimersAsync()
    expect(await outcome).toEqual({ error: 'Unable to load this assessment right now' })
    expect(db.rpc).toHaveBeenCalledTimes(3)
    expect(log).toHaveBeenCalledTimes(1)
  })
})
