import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, reportError } = vi.hoisted(() => ({ rpc: vi.fn(), reportError: vi.fn() }))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc }) }))
vi.mock('@/lib/observability/report-error', () => ({ reportError }))
vi.mock('@/lib/reports/pdf-jobs', () => ({ drainReportPdfJobs: vi.fn(async () => ({})) }))
vi.mock('@/lib/reports/pdf', () => ({ getSnapshotPdfState: vi.fn(), queueReportPdfGeneration: vi.fn() }))
vi.mock('@/lib/reports/pdf-refresh', () => ({ parseReportPdfRefreshTargets: () => [] }))

import { GET } from '@/app/api/cron/report-pdf-sweep/route'
import { isSupabaseGatewayError } from '@/lib/supabase/gateway-error'

const call = () =>
  GET(new Request('http://localhost/api/cron/report-pdf-sweep', { headers: { authorization: 'Bearer s3cret' } }))

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 's3cret')
  rpc.mockReset()
  reportError.mockReset()
})

describe('isSupabaseGatewayError', () => {
  it.each(['Bad Gateway', 'Service Unavailable', 'Service Temporarily Unavailable', 'Gateway Timeout', '<html><h1>502 Bad Gateway</h1></html>'])(
    'recognises %s',
    (message) => expect(isSupabaseGatewayError({ message })).toBe(true),
  )

  it.each([{ message: 'permission denied for table report_snapshots', code: '42501' }, new Error('boom'), null, 'Bad Gateway'])(
    'rejects %j',
    (error) => expect(isSupabaseGatewayError(error)).toBe(false),
  )
})

describe('report PDF sweep cron', () => {
  it('records a gateway blip as a warning without paging', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Bad Gateway' } })
    const res = await call()
    expect(res.status).toBe(503)
    expect(reportError).toHaveBeenCalledWith(
      { message: 'Bad Gateway' },
      expect.objectContaining({ severity: 'warning', alert: false }),
    )
  })

  it('still alerts on a genuine database error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist', code: '42883' } })
    const res = await call()
    expect(res.status).toBe(500)
    expect(reportError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ severity: 'error', alert: true }),
    )
  })

  it('succeeds when the database answers', async () => {
    rpc.mockResolvedValue({ data: 0, error: null })
    const res = await call()
    expect(res.status).toBe(200)
    expect(reportError).not.toHaveBeenCalled()
  })
})
