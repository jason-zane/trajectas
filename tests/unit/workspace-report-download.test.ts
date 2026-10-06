import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'
const state = vi.hoisted(() => ({ features: {} as Record<string, unknown>, sign: vi.fn(), access: vi.fn() }))
vi.mock('@/lib/dal/workspace-features', () => ({ getEffectiveWorkspaceFeatures: async () => state.features }))
vi.mock('@/lib/auth/authorization', async original => ({ ...await original<typeof import('@/lib/auth/authorization')>(), requireReportSnapshotReadAccess: state.access, requireParticipantAccess: state.access }))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEvent: vi.fn(), logReportViewed: vi.fn(), logSupportSessionDataAccess: vi.fn() }))
vi.mock('@/lib/reports/pdf-access', () => ({ getSignedReportPdfUrl: state.sign, downloadSnapshotPdfBase64: vi.fn() }))
const id = '11111111-1111-4111-8111-111111111111'
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: (table: string) => {
  const query: Record<string, unknown> = {}
  for (const method of ['select','eq','in','order']) query[method] = () => query
  const snapshot = { id: '11111111-1111-4111-8111-111111111111', pdf_url: 'reports/synthetic.pdf', content: { synthetic: true }, status: 'released' }
  query.maybeSingle = async () => ({ data: snapshot, error: null })
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === 'participant_sessions' ? [{ id: 'synthetic-session' }] : [snapshot], error: null }).then(resolve)
  return query
} }) }))
import { getReportSnapshot, getReportSnapshotsForParticipant } from '@/app/actions/reports'
beforeEach(() => { state.features=defaultWorkspaceFeatures('client'); state.sign.mockReset().mockResolvedValue('https://synthetic.test/signed.pdf'); state.access.mockReset().mockResolvedValue({ scope: { isPlatformAdmin: true }, confidentialityMode: 'standard' }) })
describe('staff report viewing and PDF issuance remain separate', () => {
  it('retains report content without issuing a signed download when downloads are disabled', async () => {
    state.features.reportDownload=false
    expect(await getReportSnapshot(id)).toMatchObject({ id, status: 'released', pdfUrl: undefined })
    expect(await getReportSnapshotsForParticipant(id)).toEqual([expect.objectContaining({ id, status: 'released', pdfUrl: undefined })])
    expect(state.sign).not.toHaveBeenCalled()
    expect(state.access).toHaveBeenCalledTimes(2)
  })
  it('keeps the previously permitted signing behavior when viewing and download are enabled', async () => {
    expect(await getReportSnapshot(id)).toMatchObject({ pdfUrl: 'https://synthetic.test/signed.pdf' })
    expect(state.sign).toHaveBeenCalledWith('reports/synthetic.pdf')
  })
  it('still rejects a denied snapshot scope before signing even when every feature is enabled', async () => {
    state.access.mockRejectedValue(new Error('Snapshot not accessible'))
    await expect(getReportSnapshot(id)).rejects.toThrow('Snapshot not accessible')
    expect(state.sign).not.toHaveBeenCalled()
  })
})
