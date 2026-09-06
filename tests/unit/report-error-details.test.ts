import { beforeEach, describe, expect, it, vi } from 'vitest'

const { insert, from, sendOpsAlert } = vi.hoisted(() => ({ insert: vi.fn(), from: vi.fn(), sendOpsAlert: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from }) }))
vi.mock('@/lib/observability/ops-alert', () => ({ sendOpsAlert }))

import { reportError } from '@/lib/observability/report-error'

describe('plain SDK error diagnostics', () => {
  beforeEach(() => {
    from.mockReturnValue({ insert })
    insert.mockResolvedValue({ error: null })
    sendOpsAlert.mockResolvedValue(true)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('retains the PostgREST message and recognised code in logs, persistence and alerts', async () => {
    await reportError({ message: 'canceling statement due to statement timeout', code: '57014', details: 'RPC save was cancelled', hint: 'Inspect query duration' }, {
      source: 'apiAssessSaveBatch.rpc', severity: 'fatal', context: { request_kind: 'save' },
    })
    const event = insert.mock.calls[0][0]
    expect(event).toMatchObject({
      message: 'canceling statement due to statement timeout', stack: null,
      fingerprint: 'apiAssessSaveBatch.rpc:canceling statement due to statement timeout',
      context: { request_kind: 'save', errorDetails: { code: '57014' } },
      alerted: true,
    })
    expect(console.error).toHaveBeenCalledWith('[apiAssessSaveBatch.rpc]', { message: event.message, stack: null }, event.context)
    expect(sendOpsAlert.mock.calls[0][0].body).toContain('57014')
    expect(sendOpsAlert.mock.calls[0][0].body).not.toContain('Inspect query duration')
    expect(JSON.stringify(insert.mock.calls)).not.toContain('RPC save was cancelled')
  })

  it('redacts every accepted field before it reaches any diagnostic destination', async () => {
    await reportError({
      message: 'GET /assess/private-participant-token/section/2 failed',
      code: 'Bearer private.jwt.code',
      details: 'Key (access_token)=(private-pdf-token) already exists; private-proof',
      hint: 'Failing row contains (private-campaign-token, customer@example.invalid)',
      arbitraryPayload: { access_token: 'private-payload' },
    }, { source: 'sdk', alert: true })
    const allOutput = JSON.stringify({ logs: vi.mocked(console.error).mock.calls, events: insert.mock.calls, alerts: sendOpsAlert.mock.calls })
    for (const secret of ['private-participant-token', 'private.jwt.code', 'private-pdf-token', 'private-proof', 'private-campaign-token', 'private-payload']) {
      expect(allOutput).not.toContain(secret)
    }
    expect(allOutput).toContain('[redacted]')
    expect(insert.mock.calls[0][0].context).toEqual({})
    expect(allOutput).not.toContain('customer@example.invalid')
    expect(allOutput).not.toContain('Failing row contains')
  })

  it('ignores getters, inherited values, non-string fields and cyclic arbitrary payloads', async () => {
    const getter = vi.fn(() => { throw new Error('must not execute') })
    const coercion = vi.fn(() => { throw new Error('must not coerce') })
    const input: Record<string, unknown> = Object.create({ code: 'inherited-code', hint: 'inherited-hint' })
    Object.defineProperties(input, {
      message: { get: getter }, details: { get: getter }, arbitraryPayload: { get: getter },
      toString: { value: coercion }, [Symbol.toPrimitive]: { get: getter },
    })
    input.self = input
    await reportError(input, { source: 'sdk' })
    expect(getter).not.toHaveBeenCalled(); expect(coercion).not.toHaveBeenCalled()
    expect(insert.mock.calls[0][0]).toMatchObject({ message: '[object Object]', stack: null, context: {} })
    await reportError({ message: 7, code: 57014, details: { token: 'do-not-dump' }, hint: ['do-not-dump'] }, { source: 'sdk' })
    expect(insert.mock.calls[1][0]).toMatchObject({ message: '[object Object]', context: {} })
    expect(JSON.stringify(insert.mock.calls)).not.toContain('do-not-dump')
  })

  it.each(['57014', '42P01', 'PGRST301'])('accepts recognised diagnostic code %s', async code => {
    await reportError({ message: 'database failed', code }, { source: 'sdk' })
    expect(insert.mock.calls[0][0].context).toEqual({ errorDetails: { code } })
  })

  it.each(['private-credential', 'Bearer credential', 'PGRST1234', '42p01', ''])('omits unrecognised code %s', async code => {
    await reportError({ message: 'database failed', code }, { source: 'sdk' })
    expect(insert.mock.calls[0][0].context).toEqual({})
  })

  it('accepts a null-prototype message without invoking coercion', async () => {
    const input = Object.assign(Object.create(null), { message: 'connection failed', code: '08006' })
    await expect(reportError(input, { source: 'sdk' })).resolves.toBeUndefined()
    expect(insert.mock.calls[0][0]).toMatchObject({ message: 'connection failed', context: { errorDetails: { code: '08006' } } })
  })

  it('does not invoke Proxy traps while normalizing an unknown error', async () => {
    const trap = vi.fn(() => { throw new Error('must not execute') })
    const input = new Proxy({}, { get: trap, getPrototypeOf: trap, getOwnPropertyDescriptor: trap })
    await expect(reportError(input, { source: 'sdk' })).resolves.toBeUndefined()
    expect(trap).not.toHaveBeenCalled()
    expect(insert.mock.calls[0][0].message).toBe('[object Object]')
  })

  it('preserves Error message and stack handling with redaction', async () => {
    const error = new Error('Failed /assess/private-token/report')
    error.stack = 'Error: Failed /assess/private-token/report\n at handler'
    await reportError(error, { source: 'native' })
    expect(insert.mock.calls[0][0]).toMatchObject({
      message: 'Failed /assess/[redacted]/report', stack: 'Error: Failed /assess/[redacted]/report\n at handler', context: {},
    })
  })

  it.each([[null, 'null'], [undefined, 'undefined'], [42, '42'], [false, 'false'], ['plain failure', 'plain failure']])('preserves primitive fallback %s', async (error, message) => {
    await reportError(error, { source: 'primitive' })
    expect(insert.mock.calls[0][0]).toMatchObject({ message, stack: null })
  })

  it.each(['returned', 'thrown'])('normalizes and redacts a %s persistence failure without recursively reporting it', async failureMode => {
    const failure = { message: 'Cannot persist /assess/private-persist-token/report', code: '42501', payload: { token: 'private-payload' } }
    if (failureMode === 'returned') insert.mockResolvedValueOnce({ error: failure })
    else insert.mockRejectedValueOnce(failure)
    await expect(reportError({ message: 'original failure' }, { source: 'sdk' })).resolves.toBeUndefined()
    expect(insert).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenLastCalledWith('[report-error] failed to persist error_event', {
      message: 'Cannot persist /assess/[redacted]/report', stack: null, errorDetails: { code: '42501' },
    })
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private-')
  })
})
