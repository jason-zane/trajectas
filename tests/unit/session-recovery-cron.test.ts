import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ recover: vi.fn(), reports: vi.fn(), reportError: vi.fn() }))
vi.mock('@/lib/dal/session-processing-recovery', () => ({ recoverInterruptedSessionProcessing: mocks.recover }))
vi.mock('@/lib/reports/generation-sweep', () => ({ sweepReportGeneration: mocks.reports }))
vi.mock('@/lib/observability/report-error', () => ({ reportError: mocks.reportError }))
import { GET } from '@/app/api/cron/report-generation-sweep/route'

describe('report cron recovers interrupted assessment processing', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'local-test-cron-secret')
    mocks.recover.mockResolvedValue({ picked: 1, attempted: 1, failed: 0 })
    mocks.reports.mockResolvedValue({ picked: 1, processed: 1, failed: 0 })
  })
  it('does not begin recovery without cron authentication', async () => {
    expect((await GET(new Request('http://localhost/api/cron/report-generation-sweep'))).status).toBe(401)
    expect(mocks.recover).not.toHaveBeenCalled()
    expect(mocks.reports).not.toHaveBeenCalled()
  })
  it('recovers accepted submissions before draining the resulting report snapshots', async () => {
    const response = await GET(new Request('http://localhost/api/cron/report-generation-sweep', {
      headers: { authorization: 'Bearer local-test-cron-secret' },
    }))
    expect(response.status).toBe(200)
    expect(mocks.recover.mock.invocationCallOrder[0]).toBeLessThan(mocks.reports.mock.invocationCallOrder[0])
    expect(await response.json()).toMatchObject({ ok: true, sessionRecovery: { attempted: 1, failed: 0 } })
  })
})
