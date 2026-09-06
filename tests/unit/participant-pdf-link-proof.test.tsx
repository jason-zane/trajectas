import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { verifyParticipantPdfRateLimitProof } from '@/lib/reports/pdf-rate-limit-proof'

const mocks = vi.hoisted(() => ({ getSnapshot: vi.fn() }))
vi.mock('@/app/actions/assess', () => ({ getParticipantReportSnapshot: mocks.getSnapshot }))
vi.mock('@/lib/hosts', () => ({ buildSurfaceUrl: (_surface: string, path: string, query: string) => new URL(`${path}?${query}`, 'https://admin.trajectas.test') }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('not-found') } }))
vi.mock('@/components/reports/report-renderer', () => ({ ReportRenderer: () => null }))
vi.mock('@/components/ui/button', () => ({ Button: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }))

import ParticipantReportPage from '@/app/assess/[token]/report/[snapshotId]/page'

const snapshotId = '11111111-1111-4111-8111-111111111111'
const token = 'a'.repeat(64)
const props = { params: Promise.resolve({ token, snapshotId }) }
beforeEach(() => {
  vi.stubEnv('REPORT_ACCESS_TOKEN_SECRET', 'synthetic-signing-key-'.repeat(3))
  mocks.getSnapshot.mockResolvedValue({ id: snapshotId, status: 'released', renderedData: [] })
})

describe('authorised participant PDF link', () => {
  it('mints a bound allowance only after the existing released-report authorization succeeds', async () => {
    const markup = renderToStaticMarkup(await ParticipantReportPage(props))
    const href = markup.match(/href="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&')
    expect(href).toBeTruthy()
    const url = new URL(href!)
    expect(mocks.getSnapshot).toHaveBeenCalledWith(token, snapshotId)
    expect(url.origin).toBe('https://admin.trajectas.test')
    expect(url.searchParams.get('token')).toBe(token)
    expect(url.searchParams.has('reportToken')).toBe(false)
    expect(verifyParticipantPdfRateLimitProof(url.searchParams.get('pdfRateLimitProof'), { token, snapshotId })).not.toBeNull()
  })

  it.each([null, { id: snapshotId, status: 'pending' }])('does not mint or render a link for denied/unreleased reports', async snapshot => {
    mocks.getSnapshot.mockResolvedValue(snapshot)
    // With the required secret absent, signing would throw. The authorization
    // boundary must reject before reaching it.
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('REPORT_ACCESS_TOKEN_SECRET', '')
    await expect(ParticipantReportPage(props)).rejects.toThrow('not-found')
  })
})
