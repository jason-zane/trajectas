import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  snapshot: {} as Record<string, unknown>, send: vi.fn(), sign: vi.fn(), verify: vi.fn(), pdfState: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  from: (table: string) => {
    const query = {
      select: () => query, eq: () => query, is: () => query,
      maybeSingle: async () => ({ data: table === 'campaign_participants'
        ? { id: 'participant', campaign_id: 'campaign' } : mocks.snapshot, error: null }),
    }
    return query
  },
  storage: { from: () => ({ download: async () => ({ data: new Blob(['PDF']), error: null }) }) },
}) }))
vi.mock('@/lib/reports/report-access-token', () => ({ createReportAccessToken: mocks.sign, verifyReportAccessToken: mocks.verify }))
vi.mock('@/lib/email/send', () => ({ sendEmail: mocks.send }))
vi.mock('@/app/actions/brand', () => ({ getEffectiveBrand: async () => ({ name: 'Test' }) }))
vi.mock('@/lib/hosts', () => ({ buildSurfaceUrl: () => null }))
vi.mock('@/lib/security/action-errors', () => ({ logActionError: vi.fn() }))
vi.mock('@/lib/reports/pdf', () => ({
  getSnapshotPdfState: mocks.pdfState, mapReportPdfStatus: () => ({ status: 'ready' }),
  generateAndStoreReportPdf: vi.fn(), queueReportPdfGeneration: vi.fn(),
}))
vi.mock('@/lib/reports/pdf-filename', () => ({
  getReportPdfFilename: async () => 'report.pdf', contentDispositionAttachment: () => 'attachment',
}))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEvent: vi.fn() }))
vi.mock('@/lib/auth/authorization', () => ({
  AuthenticationRequiredError: class extends Error {}, AuthorizationError: class extends Error {},
  assertIndividualResultsAccess: vi.fn(), requireReportSnapshotAccess: vi.fn(),
}))
vi.mock('next/server', async importOriginal => ({ ...await importOriginal<typeof import('next/server')>(), after: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`) } }))
vi.mock('@/lib/supabase/mappers', () => ({ mapReportSnapshotRow: (row: unknown) => row }))
vi.mock('@/components/reports/report-renderer', () => ({ ReportRenderer: () => null }))
vi.mock('@/components/ui/button', () => ({ Button: () => null }))

import { requestNewReportLink } from '@/app/actions/report-resend'
import { GET as getPdf } from '@/app/api/reports/[snapshotId]/pdf/route'
import { GET as getStatus } from '@/app/api/reports/[snapshotId]/status/route'
import ReportByTokenPage from '@/app/assess/r/[snapshotId]/page'

const snapshotId = '11111111-1111-4111-8111-111111111111'
const params = { params: Promise.resolve({ snapshotId }) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.snapshot = { id: snapshotId, status: 'released', audience_type: 'hr_manager', sent_to_participant_at: null,
    participant_sessions: { campaign_participant_id: 'participant', campaign_participants: {
      id: 'participant', email: 'person@example.invalid', first_name: 'Test',
    } }, campaigns: { id: 'campaign', title: 'Campaign', client_id: 'client' }, renderedData: [] }
  mocks.sign.mockReturnValue('signed-one-snapshot-grant')
  mocks.verify.mockReturnValue({ participantId: 'participant' })
  mocks.send.mockResolvedValue(undefined)
  mocks.pdfState.mockResolvedValue({ id: snapshotId, status: 'released', pdf_url: 'reports/private.pdf' })
})

describe('participant audience versus explicit signed report grants', () => {
  it.each(['hr_manager', 'consultant'])('does not self-issue a grant for an unshared %s snapshot', async audience => {
    mocks.snapshot.audience_type = audience
    await expect(requestNewReportLink({ snapshotId, email: 'person@example.invalid' })).resolves.toEqual({ ok: true })
    expect(mocks.sign).not.toHaveBeenCalled()
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it.each([null, 'participant'])('renews a participant-owned %s-audience report', async audience => {
    mocks.snapshot.audience_type = audience
    await requestNewReportLink({ snapshotId, email: 'person@example.invalid' })
    expect(mocks.sign).toHaveBeenCalledWith(snapshotId, 'participant')
    expect(mocks.send).toHaveBeenCalledOnce()
  })
  it('renews a legacy HR report that staff explicitly sent to the same participant', async () => {
    mocks.snapshot.sent_to_participant_at = '2026-09-01T00:00:00Z'
    await requestNewReportLink({ snapshotId, email: 'person@example.invalid' })
    expect(mocks.sign).toHaveBeenCalledWith(snapshotId, 'participant')
    expect(mocks.send).toHaveBeenCalledOnce()
  })
  it('does not renew a shared report for a different email', async () => {
    mocks.snapshot.sent_to_participant_at = '2026-09-01T00:00:00Z'
    await requestNewReportLink({ snapshotId, email: 'other@example.invalid' })
    expect(mocks.sign).not.toHaveBeenCalled()
  })
  it('honors an existing signed snapshot grant on the HTML, PDF, and status paths', async () => {
    await expect(ReportByTokenPage({ ...params, searchParams: Promise.resolve({ t: 'signed-grant' }) })).resolves.toBeTruthy()
    const pdf = await getPdf(new Request(`http://localhost/api/reports/${snapshotId}/pdf?reportToken=signed-grant`), params)
    expect(pdf.status).toBe(200)
    const status = await getStatus(new Request(`http://localhost/api/reports/${snapshotId}/status?reportToken=signed-grant`), params)
    expect(status.status).toBe(200)
  })
  it.each(['hr_manager', 'consultant'])('refuses a persistent participant token for a %s PDF', async audience => {
    mocks.snapshot.audience_type = audience
    const pdf = await getPdf(new Request(`http://localhost/api/reports/${snapshotId}/pdf?token=participant-token`), params)
    expect(pdf.status).toBe(403)
    expect(mocks.pdfState).not.toHaveBeenCalled()
  })
  it.each([null, 'participant'])('allows the persistent participant token for a %s-audience PDF', async audience => {
    mocks.snapshot.audience_type = audience
    const pdf = await getPdf(new Request(`http://localhost/api/reports/${snapshotId}/pdf?token=participant-token`), params)
    expect(pdf.status).toBe(200)
  })
})
