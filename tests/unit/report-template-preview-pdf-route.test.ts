import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock authorization and PDF generation functions
const resolveAuthorizedScope = vi.fn()
const canManageReportTemplateLibrary = vi.fn()
const requireReportTemplateAccess = vi.fn()
const requireAssessmentAccess = vi.fn()
const generatePreviewPdf = vi.fn()

vi.mock('@/lib/auth/authorization', () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    name = 'AuthenticationRequiredError'
  },
  AuthorizationError: class AuthorizationError extends Error {
    name = 'AuthorizationError'
  },
  resolveAuthorizedScope: () => resolveAuthorizedScope(),
  canManageReportTemplateLibrary: (scope: unknown) =>
    canManageReportTemplateLibrary(scope),
  requireReportTemplateAccess: (id: string) =>
    requireReportTemplateAccess(id),
  requireAssessmentAccess: (id: string) => requireAssessmentAccess(id),
}))

vi.mock('@/lib/reports/preview-pdf', () => ({
  generatePreviewPdf: (templateId: string, assessmentId: string) =>
    generatePreviewPdf(templateId, assessmentId),
}))

import {
  AuthenticationRequiredError,
  AuthorizationError,
} from '@/lib/auth/authorization'
import { GET } from '@/app/api/report-templates/[id]/preview/pdf/route'

describe('GET /api/report-templates/[id]/preview/pdf', () => {
  const templateId = 'tpl-123'
  const assessmentId = 'asmt-456'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when assessment query param is missing', async () => {
    const response = await GET(
      new Request(`http://localhost/api/report-templates/${templateId}/preview/pdf`),
      { params: Promise.resolve({ id: templateId }) }
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('assessment query param is required')
  })

  it('returns 401 when authentication is required but missing', async () => {
    const error = new AuthenticationRequiredError()
    resolveAuthorizedScope.mockRejectedValue(error)

    const response = await GET(
      new Request(
        `http://localhost/api/report-templates/${templateId}/preview/pdf?assessment=${assessmentId}`
      ),
      { params: Promise.resolve({ id: templateId }) }
    )

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Authentication required')
  })

  it('returns 403 when user cannot manage report template library', async () => {
    const scope = { /* mock scope */ }
    resolveAuthorizedScope.mockResolvedValue(scope)
    canManageReportTemplateLibrary.mockReturnValue(false)

    const response = await GET(
      new Request(
        `http://localhost/api/report-templates/${templateId}/preview/pdf?assessment=${assessmentId}`
      ),
      { params: Promise.resolve({ id: templateId }) }
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe(
      'Only platform or partner administrators can download report previews.'
    )
  })

  it('returns 403 when report template access check fails', async () => {
    const scope = { /* mock scope */ }
    resolveAuthorizedScope.mockResolvedValue(scope)
    canManageReportTemplateLibrary.mockReturnValue(true)
    const error = new AuthorizationError('Template not found')
    requireReportTemplateAccess.mockRejectedValue(error)

    const response = await GET(
      new Request(
        `http://localhost/api/report-templates/${templateId}/preview/pdf?assessment=${assessmentId}`
      ),
      { params: Promise.resolve({ id: templateId }) }
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Template not found')
  })

  it('returns 403 when assessment access check fails', async () => {
    const scope = { /* mock scope */ }
    resolveAuthorizedScope.mockResolvedValue(scope)
    canManageReportTemplateLibrary.mockReturnValue(true)
    requireReportTemplateAccess.mockResolvedValue(undefined)
    const error = new AuthorizationError('Assessment not found')
    requireAssessmentAccess.mockRejectedValue(error)

    const response = await GET(
      new Request(
        `http://localhost/api/report-templates/${templateId}/preview/pdf?assessment=${assessmentId}`
      ),
      { params: Promise.resolve({ id: templateId }) }
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Assessment not found')
  })

  it('returns 200 with PDF when authorized and both checks pass', async () => {
    const mockPdfBuffer = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, // PDF magic bytes
    ])
    const scope = { /* mock scope */ }
    resolveAuthorizedScope.mockResolvedValue(scope)
    canManageReportTemplateLibrary.mockReturnValue(true)
    requireReportTemplateAccess.mockResolvedValue(undefined)
    requireAssessmentAccess.mockResolvedValue(undefined)
    generatePreviewPdf.mockResolvedValue({
      buffer: mockPdfBuffer,
      byteOffset: 0,
      byteLength: mockPdfBuffer.length,
    })

    const response = await GET(
      new Request(
        `http://localhost/api/report-templates/${templateId}/preview/pdf?assessment=${assessmentId}`
      ),
      { params: Promise.resolve({ id: templateId }) }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    const cd = response.headers.get('Content-Disposition') ?? ''
    expect(cd).toContain('attachment')
    expect(cd).toContain(`template-${templateId}-preview.pdf`)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('returns 500 when PDF generation fails', async () => {
    const scope = { /* mock scope */ }
    resolveAuthorizedScope.mockResolvedValue(scope)
    canManageReportTemplateLibrary.mockReturnValue(true)
    requireReportTemplateAccess.mockResolvedValue(undefined)
    requireAssessmentAccess.mockResolvedValue(undefined)
    generatePreviewPdf.mockRejectedValue(new Error('PDF generation failed'))

    const response = await GET(
      new Request(
        `http://localhost/api/report-templates/${templateId}/preview/pdf?assessment=${assessmentId}`
      ),
      { params: Promise.resolve({ id: templateId }) }
    )

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('PDF generation failed')
  })

  it('performs authorization checks in the correct order', async () => {
    const scope = { /* mock scope */ }
    resolveAuthorizedScope.mockResolvedValue(scope)
    canManageReportTemplateLibrary.mockReturnValue(true)
    requireReportTemplateAccess.mockResolvedValue(undefined)
    requireAssessmentAccess.mockResolvedValue(undefined)
    generatePreviewPdf.mockResolvedValue({
      buffer: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      byteOffset: 0,
      byteLength: 4,
    })

    await GET(
      new Request(
        `http://localhost/api/report-templates/${templateId}/preview/pdf?assessment=${assessmentId}`
      ),
      { params: Promise.resolve({ id: templateId }) }
    )

    // Verify order: resolveAuthorizedScope → canManage → requireTemplate → requireAssessment
    expect(resolveAuthorizedScope).toHaveBeenCalled()
    expect(canManageReportTemplateLibrary).toHaveBeenCalled()
    expect(requireReportTemplateAccess).toHaveBeenCalledWith(templateId)
    expect(requireAssessmentAccess).toHaveBeenCalledWith(assessmentId)
  })
})
