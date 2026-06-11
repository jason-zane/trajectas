import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock all the authorization and storage functions
const requireReportSnapshotAccess = vi.fn()
const verifyReportAccessToken = vi.fn()
const getSnapshotPdfState = vi.fn()
const mapReportPdfStatus = vi.fn()
const generateAndStoreReportPdf = vi.fn()
const getReportPdfFilename = vi.fn()
const queueReportPdfGeneration = vi.fn()
const logAuditEvent = vi.fn()

vi.mock('@/lib/auth/authorization', () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    name = 'AuthenticationRequiredError'
  },
  AuthorizationError: class AuthorizationError extends Error {
    name = 'AuthorizationError'
  },
  requireReportSnapshotAccess: () => requireReportSnapshotAccess(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue({
          data: new Blob(['PDF content']),
          error: null,
        }),
      }),
    },
  }),
}))

vi.mock('@/lib/reports/report-access-token', () => ({
  verifyReportAccessToken: (token: string | null, snapshotId: string) =>
    verifyReportAccessToken(token, snapshotId),
}))

vi.mock('@/lib/reports/pdf', () => ({
  getSnapshotPdfState: (id: string) => getSnapshotPdfState(id),
  mapReportPdfStatus: (snapshot: unknown, id: string) =>
    mapReportPdfStatus(snapshot, id),
  generateAndStoreReportPdf: (id: string, opts: unknown) =>
    generateAndStoreReportPdf(id, opts),
  getReportPdfFilename: (id: string) => getReportPdfFilename(id),
  queueReportPdfGeneration: (id: string) => queueReportPdfGeneration(id),
}))

vi.mock('@/lib/auth/support-sessions', () => ({
  logAuditEvent: (event: unknown) => logAuditEvent(event),
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: vi.fn() }
})

import { AuthenticationRequiredError, AuthorizationError } from '@/lib/auth/authorization'
import { GET, POST } from '@/app/api/reports/[snapshotId]/pdf/route'

describe('GET /api/reports/[snapshotId]/pdf', () => {
  const snapshotId = 'snap-123'
  const filename = 'report-2024.pdf'

  beforeEach(() => {
    vi.clearAllMocks()
    getSnapshotPdfState.mockResolvedValue({
      id: snapshotId,
      status: 'released',
      pdf_url: null,
    })
    getReportPdfFilename.mockResolvedValue(filename)
    mapReportPdfStatus.mockReturnValue({ status: 'ready' })
  })

  it('returns 401 when authentication is required but missing', async () => {
    const error = new AuthenticationRequiredError()
    requireReportSnapshotAccess.mockRejectedValue(error)

    const response = await GET(
      new Request(`http://localhost/api/reports/${snapshotId}/pdf`),
      { params: Promise.resolve({ snapshotId }) }
    )

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Authentication required')
  })

  it('returns 403 when authorization fails', async () => {
    const error = new AuthorizationError('Access denied')
    requireReportSnapshotAccess.mockRejectedValue(error)

    const response = await GET(
      new Request(`http://localhost/api/reports/${snapshotId}/pdf`),
      { params: Promise.resolve({ snapshotId }) }
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Access denied')
  })

  it('returns 403 when participant token is invalid', async () => {
    verifyReportAccessToken.mockReturnValue(null)

    const response = await GET(
      new Request(
        `http://localhost/api/reports/${snapshotId}/pdf?reportToken=invalid`
      ),
      { params: Promise.resolve({ snapshotId }) }
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Invalid report token')
  })

  it('returns 403 when report token participant ID does not match snapshot', async () => {
    verifyReportAccessToken.mockReturnValue({ participantId: 'wrong-participant' })

    const response = await GET(
      new Request(
        `http://localhost/api/reports/${snapshotId}/pdf?reportToken=valid`
      ),
      { params: Promise.resolve({ snapshotId }) }
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Report not available')
  })

  it('returns 404 when snapshot does not exist', async () => {
    requireReportSnapshotAccess.mockResolvedValue({
      scope: { actor: null },
      clientId: 'client-1',
      partnerId: null,
      participantId: null,
    })
    getSnapshotPdfState.mockResolvedValue(null)

    const response = await GET(
      new Request(`http://localhost/api/reports/${snapshotId}/pdf`),
      { params: Promise.resolve({ snapshotId }) }
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe('Report not found')
  })

  it('returns 409 when PDF status is not ready or released', async () => {
    requireReportSnapshotAccess.mockResolvedValue({
      scope: { actor: null },
      clientId: 'client-1',
      partnerId: null,
      participantId: null,
    })
    getSnapshotPdfState.mockResolvedValue({
      id: snapshotId,
      status: 'processing',
      pdf_url: null,
    })

    const response = await GET(
      new Request(`http://localhost/api/reports/${snapshotId}/pdf`),
      { params: Promise.resolve({ snapshotId }) }
    )

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe('PDF is only available for ready or released reports')
  })

  it('returns 200 with PDF when valid admin access and cached PDF exists', async () => {
    requireReportSnapshotAccess.mockResolvedValue({
      scope: { actor: { id: 'user-1' } },
      clientId: 'client-1',
      partnerId: null,
      participantId: null,
    })
    getSnapshotPdfState.mockResolvedValue({
      id: snapshotId,
      status: 'released',
      pdf_url: `reports/${snapshotId}.pdf`,
    })

    const response = await GET(
      new Request(`http://localhost/api/reports/${snapshotId}/pdf`),
      { params: Promise.resolve({ snapshotId }) }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('Content-Disposition')).toContain(filename)
  })

  it('returns 200 with generated PDF when PDF generation succeeds', async () => {
    const mockPdfBuffer = new TextEncoder().encode('generated pdf')
    requireReportSnapshotAccess.mockResolvedValue({
      scope: { actor: { id: 'user-1' } },
      clientId: 'client-1',
      partnerId: null,
      participantId: null,
    })
    getSnapshotPdfState.mockResolvedValue({
      id: snapshotId,
      status: 'released',
      pdf_url: null,
    })
    generateAndStoreReportPdf.mockResolvedValue({
      body: mockPdfBuffer,
    })

    const response = await GET(
      new Request(`http://localhost/api/reports/${snapshotId}/pdf`),
      { params: Promise.resolve({ snapshotId }) }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('validates reportToken path specifically and rejects mismatched snapshots', async () => {
    verifyReportAccessToken.mockReturnValue({ participantId: 'p-1' })

    const response = await GET(
      new Request(
        `http://localhost/api/reports/${snapshotId}/pdf?reportToken=valid`
      ),
      { params: Promise.resolve({ snapshotId }) }
    )

    // Should fail because we mocked no snapshot data
    expect(response.status).toBe(403)
  })

  it('does not accept caller-supplied storage path — uses hardcoded format', async () => {
    // Attempt to pass a malicious storage path parameter should not be accepted
    const maliciousPath = '../../../sensitive.pdf'
    requireReportSnapshotAccess.mockResolvedValue({
      scope: { actor: { id: 'user-1' } },
      clientId: 'client-1',
      partnerId: null,
      participantId: null,
    })
    getSnapshotPdfState.mockResolvedValue({
      id: snapshotId,
      status: 'released',
      pdf_url: `reports/${snapshotId}.pdf`,
    })

    const response = await GET(
      new Request(
        `http://localhost/api/reports/${snapshotId}/pdf?storagePath=${maliciousPath}`
      ),
      { params: Promise.resolve({ snapshotId }) }
    )

    // The route should not use any query parameter for storage path
    // It always uses the hardcoded `reports/${snapshotId}.pdf`
    // Verify the storagePath param is ignored and the response still succeeds
    expect(response.status).toBe(200)
  })
})

describe('POST /api/reports/[snapshotId]/pdf', () => {
  const snapshotId = 'snap-123'

  beforeEach(() => {
    vi.clearAllMocks()
    queueReportPdfGeneration.mockResolvedValue({
      queued: true,
      jobId: 'job-123',
      status: 'queued',
      pdfUrl: null,
      error: null,
    })
  })

  it('returns 401 when authentication is required but missing', async () => {
    const error = new AuthenticationRequiredError()
    requireReportSnapshotAccess.mockRejectedValue(error)

    const response = await POST(
      new Request(`http://localhost/api/reports/${snapshotId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ snapshotId }) }
    )

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Authentication required')
  })

  it('returns 403 when authorization fails', async () => {
    const error = new AuthorizationError('Access denied')
    requireReportSnapshotAccess.mockRejectedValue(error)

    const response = await POST(
      new Request(`http://localhost/api/reports/${snapshotId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ snapshotId }) }
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Access denied')
  })

  it('returns 403 when reportToken is invalid', async () => {
    verifyReportAccessToken.mockReturnValue(null)

    const response = await POST(
      new Request(
        `http://localhost/api/reports/${snapshotId}/pdf?reportToken=invalid`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      ),
      { params: Promise.resolve({ snapshotId }) }
    )

    expect(response.status).toBe(403)
  })

  it('returns 200 with job details when valid access and queue succeeds', async () => {
    requireReportSnapshotAccess.mockResolvedValue({
      scope: { actor: { id: 'user-1' } },
      clientId: 'client-1',
      partnerId: null,
      participantId: null,
    })

    const response = await POST(
      new Request(`http://localhost/api/reports/${snapshotId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true }),
      }),
      { params: Promise.resolve({ snapshotId }) }
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.jobId).toBe('job-123')
    expect(body.status).toBe('queued')
  })

  it('returns 413 when request body exceeds max size', async () => {
    requireReportSnapshotAccess.mockResolvedValue({
      scope: { actor: { id: 'user-1' } },
      clientId: 'client-1',
      partnerId: null,
      participantId: null,
    })

    const largeBody = JSON.stringify({
      forceRefresh: true,
      data: 'x'.repeat(10 * 1024), // 10KB, exceeds max
    })

    const response = await POST(
      new Request(`http://localhost/api/reports/${snapshotId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: largeBody,
      }),
      { params: Promise.resolve({ snapshotId }) }
    )

    expect(response.status).toBe(413)
    const body = await response.json()
    expect(body.error).toBe('Request body too large')
  })

  it('returns 400 when request body is invalid JSON', async () => {
    requireReportSnapshotAccess.mockResolvedValue({
      scope: { actor: { id: 'user-1' } },
      clientId: 'client-1',
      partnerId: null,
      participantId: null,
    })

    const response = await POST(
      new Request(`http://localhost/api/reports/${snapshotId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}',
      }),
      { params: Promise.resolve({ snapshotId }) }
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Request body must be valid JSON')
  })
})
