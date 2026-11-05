import { EventEmitter } from 'node:events'
import type { IncomingMessage, RequestOptions } from 'node:http'
import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), http: vi.fn(), https: vi.fn() }))
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }))
vi.mock('node:http', () => ({ request: mocks.http }))
vi.mock('node:https', () => ({ request: mocks.https }))

import { requestWebhook } from '@/lib/integrations/webhook-request'
import { readResponseTextWithLimit } from '@/lib/security/request-body'

const publicAddress = { address: '93.184.216.34', family: 4 }
const url = 'https://hooks.example.com/events'
const options = () => ({ method: 'POST' as const, headers: { 'Content-Type': 'application/json' }, body: '{"fixture":true}', signal: new AbortController().signal })
let response: Readable & { statusCode: number }
let socketRequest: EventEmitter & { end: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production')
  mocks.lookup.mockResolvedValue([publicAddress])
  response = Object.assign(Readable.from([Buffer.from('ok')]), { statusCode: 200 })
  const send = (_url: URL, _options: RequestOptions, callback: (message: IncomingMessage) => void) => {
    socketRequest = Object.assign(new EventEmitter(), { end: vi.fn(() => callback(response as IncomingMessage)) })
    return socketRequest
  }
  mocks.https.mockImplementation(send)
  mocks.http.mockImplementation(send)
})

describe('pinned webhook transport', () => {
  it.each([
    'http://localhost/events', 'https://127.0.0.1/events', 'https://10.0.0.1/events',
    'https://169.254.169.254/latest/meta-data', 'https://user:pass@hooks.example.com/events',
    'https://[::ffff:127.0.0.1]/events', 'https://[2002:7f00:1::]/events',
  ])('blocks an unsafe saved URL without resolving or sending: %s', async value => {
    await expect(requestWebhook(value, options())).rejects.toThrow()
    expect(mocks.lookup).not.toHaveBeenCalled()
    expect(mocks.https).not.toHaveBeenCalled()
    expect(mocks.http).not.toHaveBeenCalled()
  })

  it.each([
    [], [{ address: '10.0.0.1', family: 4 }], [{ address: '169.254.169.254', family: 4 }],
    [publicAddress, { address: '127.0.0.1', family: 4 }],
    [{ address: '::ffff:10.0.0.1', family: 6 }], [{ address: 'fc00::1', family: 6 }],
    [{ address: '64:ff9b::7f00:1', family: 6 }], [{ address: 'not-an-ip', family: 4 }],
  ])('rejects empty, invalid or non-public DNS answer sets: %j', async (...addresses) => {
    mocks.lookup.mockResolvedValue(addresses)
    await expect(requestWebhook(url, options())).rejects.toThrow('allowed network addresses')
    expect(mocks.https).not.toHaveBeenCalled()
  })

  it('pins the connection lookup to the vetted address, retaining the original TLS hostname and request', async () => {
    const result = await requestWebhook(url, options())
    expect(await result.text()).toBe('ok')
    expect(mocks.lookup).toHaveBeenCalledExactlyOnceWith('hooks.example.com', { all: true, verbatim: true })
    const [target, connection] = mocks.https.mock.calls[0]
    expect(target.hostname).toBe('hooks.example.com')
    expect(connection).toMatchObject({ agent: false, method: 'POST', family: 4 })
    expect(connection.rejectUnauthorized).not.toBe(false)
    const resolved = vi.fn()
    connection.lookup('hooks.example.com', {}, resolved)
    expect(resolved).toHaveBeenLastCalledWith(null, publicAddress.address, 4)
    connection.lookup('hooks.example.com', { all: true }, resolved)
    expect(resolved).toHaveBeenLastCalledWith(null, [publicAddress])
    expect(mocks.lookup).toHaveBeenCalledOnce()
    expect(socketRequest.end).toHaveBeenCalledWith(options().body)
  })

  it('accepts a public IPv6 answer and a literal public IP without a second DNS lookup', async () => {
    mocks.lookup.mockResolvedValue([{ address: '2606:4700:4700::1111', family: 6 }])
    await requestWebhook(url, options())
    expect(mocks.https.mock.calls[0][1].family).toBe(6)
    await requestWebhook('https://93.184.216.34/events', options())
    expect(mocks.lookup).toHaveBeenCalledOnce()
  })

  it('returns redirects without following them or forwarding the signed payload', async () => {
    response.statusCode = 307
    const result = await requestWebhook(url, options())
    expect(result.status).toBe(307)
    expect(mocks.https).toHaveBeenCalledOnce()
    expect(mocks.http).not.toHaveBeenCalled()
  })

  it('preserves the streaming response limit and cancels oversized bodies', async () => {
    response = Object.assign(Readable.from([Buffer.alloc(2048)]), { statusCode: 200 })
    const result = await requestWebhook(url, options())
    await expect(readResponseTextWithLimit(result, 1024)).rejects.toThrow('1024')
    expect(response.destroyed).toBe(true)
  })

  it('handles a no-content success without creating an invalid response body', async () => {
    response.statusCode = 204
    const result = await requestWebhook(url, options())
    expect(result.ok).toBe(true)
    expect(await result.text()).toBe('')
    expect(response.destroyed).toBe(true)
  })

  it('aborts a pending DNS lookup without ever starting an HTTP request', async () => {
    mocks.lookup.mockImplementation(() => new Promise(() => {}))
    const controller = new AbortController()
    const pending = requestWebhook(url, { ...options(), signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(mocks.https).not.toHaveBeenCalled()
  })

  it('never starts DNS for an already-aborted request', async () => {
    const controller = new AbortController(); controller.abort()
    await expect(requestWebhook(url, { ...options(), signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(mocks.lookup).not.toHaveBeenCalled()
  })

  it('keeps resolver and socket details out of persisted error messages', async () => {
    mocks.lookup.mockRejectedValueOnce(new Error('fixture-private-hostname'))
    await expect(requestWebhook(url, options())).rejects.toThrow('Webhook destination could not be resolved.')
    mocks.https.mockImplementationOnce(() => {
      const failedRequest = new EventEmitter()
      return Object.assign(failedRequest, { end: () => failedRequest.emit('error', new Error('fixture-private-url')) })
    })
    await expect(requestWebhook(url, options())).rejects.toThrow('Webhook delivery failed.')
  })

  it('permits explicit loopback development URLs without allowing public names to resolve to loopback', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    await requestWebhook('http://127.0.0.1:8080/events', options())
    expect(mocks.http).toHaveBeenCalledOnce()
    mocks.lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }])
    await expect(requestWebhook(url, options())).rejects.toThrow('allowed network addresses')
  })
})
