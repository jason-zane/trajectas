import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAssessRouteTiming } from '@/lib/assess/route-timing'
import { createAssessSessionProof } from '@/lib/assess/session-proof'
import { sendResponse } from 'next/dist/server/send-response'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), rateLimit: vi.fn(), logActionError: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/security/rate-limit', () => ({ checkAssessApiTokenRateLimit: mocks.rateLimit }))
vi.mock('@/lib/security/action-errors', () => ({ logActionError: mocks.logActionError }))

const { POST: saveBatch } = await import('@/app/api/assess/save-batch/route')
const { POST: progress } = await import('@/app/api/assess/progress/route')
const sessionId = '550e8400-e29b-41d4-a716-446655440000'
const itemId = '550e8400-e29b-41d4-a716-446655440001'
const token = 'a'.repeat(64)
let now: number

beforeEach(() => {
  now = 100
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubEnv('INTERNAL_API_KEY', 'synthetic-route-timing-'.repeat(4))
  mocks.rateLimit.mockImplementation(async () => { now += 7.5; return { allowed: true } })
})

function timings(response: Response) {
  const header = response.headers.get('server-timing')!
  expect(response.headers.get('x-assess-timing')).toBe(header)
  expect(header).toMatch(/^(?:assess_(?:token_rl|rpc|handler);dur=\d+\.\d)(?:, assess_(?:token_rl|rpc|handler);dur=\d+\.\d)*$/)
  expect(header).not.toContain(token)
  expect(header).not.toContain(sessionId)
  return Object.fromEntries(header.split(', ').map(phase => {
    const [name, duration] = phase.split(';dur=')
    return [name, Number(duration)]
  }))
}
const routes = [
  { name: 'save-batch', handler: saveBatch, source: 'apiAssessSaveBatch.rpc', success: [itemId], denied: -1,
    body: { token, sessionId, saves: [{ itemId, responseValue: 3, idempotencyKey: 'answer-1' }] } },
  { name: 'progress', handler: progress, source: 'apiAssessProgress.rpc', success: true, denied: false,
    body: { token, sessionId, sectionId: itemId, itemIndex: 1 } },
]

describe.each(routes)('$name route timing without changing authorization', route => {
  function request(body: unknown = route.body, proof?: string) {
    return new Request(`http://localhost/api/assess/${route.name}`, {
      method: 'POST', body: JSON.stringify(body), headers: {
        'Server-Timing': `untrusted;desc="${token}"`,
        ...(proof ? { 'x-assess-session-proof': proof } : {}),
      },
    })
  }

  it('measures token rate limit, RPC and handler time independently on success', async () => {
    mocks.rpc.mockImplementation(async () => { now += 42.3; return { data: route.success, error: null } })
    const response = await route.handler(request())
    expect(response.status).toBe(200)
    expect(timings(response)).toEqual({ assess_token_rl: 7.5, assess_rpc: 42.3, assess_handler: 49.8 })
    expect(mocks.rateLimit).toHaveBeenCalledWith(route.name, token)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.logActionError).not.toHaveBeenCalled()
  })

  it('accepts a bound proof but still lets the RPC deny revoked or unowned access', async () => {
    mocks.rpc.mockResolvedValue({ data: route.denied, error: null })
    const response = await route.handler(request(route.body, createAssessSessionProof(token, sessionId)))
    expect(response.status).toBe(403)
    expect(timings(response)).toHaveProperty('assess_rpc')
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.logActionError).not.toHaveBeenCalled()
  })

  it('rejects a proof bound to another token before rate limiting or the RPC', async () => {
    const proof = createAssessSessionProof('b'.repeat(64), sessionId)
    const response = await route.handler(request(route.body, proof))
    expect(response.status).toBe(403)
    expect(timings(response)).toEqual({ assess_handler: 0 })
    expect(mocks.rateLimit).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('retains the per-token 429 and Retry-After without calling the RPC', async () => {
    mocks.rateLimit.mockImplementation(async () => { now += 9; return { allowed: false, retryAfterSeconds: 17 } })
    const response = await route.handler(request())
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('17')
    expect(timings(response)).toEqual({ assess_token_rl: 9, assess_handler: 9 })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('records the RPC error with the safe logger and returns numeric timing on 500', async () => {
    const error = { code: '57014', message: `private provider detail ${token}` }
    mocks.rpc.mockImplementation(async () => { now += 123; return { data: null, error } })
    const response = await route.handler(request())
    expect(response.status).toBe(500)
    expect(timings(response)).toEqual({ assess_token_rl: 7.5, assess_rpc: 123, assess_handler: 130.5 })
    expect(mocks.logActionError).toHaveBeenCalledExactlyOnceWith(route.source, error)
    expect(await response.text()).not.toContain(token)
  })

  it('times and logs a rejected RPC transport promise without leaking its error', async () => {
    const error = new Error(`transport detail ${token}`)
    mocks.rpc.mockImplementation(async () => { now += 91; throw error })
    const response = await route.handler(request())
    expect(response.status).toBe(500)
    expect(timings(response)).toEqual({ assess_token_rl: 7.5, assess_rpc: 91, assess_handler: 98.5 })
    expect(mocks.logActionError).toHaveBeenCalledExactlyOnceWith(route.source, error)
    expect(await response.text()).not.toContain(token)
  })

  it('adds only handler timing to invalid input without touching the limiter or database', async () => {
    const response = await route.handler(request({}))
    expect(response.status).toBe(400)
    expect(timings(response)).toEqual({ assess_handler: 0 })
    expect(mocks.rateLimit).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('keeps the request-body size cap and reports handler timing on 413', async () => {
    const response = await route.handler(new Request(`http://localhost/api/assess/${route.name}`, {
      method: 'POST', body: 'x'.repeat(65 * 1024),
    }))
    expect(response.status).toBe(413)
    expect(timings(response)).toHaveProperty('assess_handler')
    expect(mocks.rateLimit).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

it('appends to existing response timing and keeps unrelated response headers', () => {
  const timing = createAssessRouteTiming()
  const response = new Response('OK', { headers: { 'Server-Timing': 'proxy;dur=5.0', 'Retry-After': '7' } })
  now += 25
  expect(timing.finish(response)).toBe(response)
  expect(response.headers.get('server-timing')).toBe('proxy;dur=5.0, assess_handler;dur=25.0')
  expect(response.headers.get('x-assess-timing')).toBe('assess_handler;dur=25.0')
  expect(response.headers.get('retry-after')).toBe('7')
})

it('does not output non-finite or negative clock values', () => {
  const timing = createAssessRouteTiming()
  now = Number.NaN
  expect(timing.finish(new Response()).headers.get('server-timing')).toBe('assess_handler;dur=0.0')
})

it('keeps route timings through actual Next response handling when proxy already set Server-Timing', async () => {
  vi.stubEnv('NEXT_RUNTIME', 'nodejs')
  const timing = createAssessRouteTiming()
  now += 125
  const response = timing.finish(new Response('OK'))
  const headers = new Map([['server-timing', 'rl;dur=4.0, proxy;dur=5.0']])
  const end = vi.fn()
  const outbound = {
    originalResponse: { end },
    getHeader: (name: string) => headers.get(name.toLowerCase()),
    appendHeader: (name: string, value: string) => { headers.set(name.toLowerCase(), value) },
  }
  await sendResponse(
    { method: 'HEAD' } as Parameters<typeof sendResponse>[0],
    outbound as unknown as Parameters<typeof sendResponse>[1],
    response,
  )
  expect(headers.get('server-timing')).toBe('rl;dur=4.0, proxy;dur=5.0')
  expect(headers.get('x-assess-timing')).toBe('assess_handler;dur=125.0')
  expect(end).toHaveBeenCalledOnce()
})
