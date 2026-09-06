import { describe, expect, it } from 'vitest'
import { redactDiagnosticContext, redactDiagnosticText } from '@/lib/observability/redact'

describe('diagnostic credential redaction', () => {
  it('preserves route context without assessment and PDF bearer credentials', () => {
    const input = 'GET /assess/private-participant-key/section/2?pdfToken=private-pdf-key&format=print'
    expect(redactDiagnosticText(input)).toBe('GET /assess/[redacted]/section/2?pdfToken=[redacted]&format=print')
    expect(redactDiagnosticText('/assess/join/private-campaign-key')).toBe('/assess/join/[redacted]')
    expect(redactDiagnosticText('Authorization: Bearer private.jwt.value')).toBe('Authorization: Bearer [redacted]')
  })

  it('redacts nested secrets while retaining useful IDs and safely handling cycles', () => {
    const context: Record<string, unknown> = {
      session_id: 'session-123',
      request: { authorization: 'Bearer secret', access_token: 'secret', path: '/assess/secret/review' },
    }
    context.self = context
    const sanitized = redactDiagnosticContext(context)
    expect(sanitized).toEqual({
      session_id: 'session-123',
      request: { authorization: '[redacted]', access_token: '[redacted]', path: '/assess/[redacted]/review' },
      self: '[circular]',
    })
    expect(JSON.stringify(sanitized)).not.toContain('secret')
    expect(context.request).toHaveProperty('access_token', 'secret')
  })

  it('redacts the participant PDF rate-limit proof in URLs and structured context', () => {
    expect(redactDiagnosticText('/api/reports/report-id/pdf?token=private-token&pdfRateLimitProof=private-proof'))
      .toBe('/api/reports/report-id/pdf?token=[redacted]&pdfRateLimitProof=[redacted]')
    expect(redactDiagnosticContext({ pdfRateLimitProof: 'private-proof', pdf_rate_limit_proof: 'private-proof', snapshotId: 'report-id' }))
      .toEqual({ pdfRateLimitProof: '[redacted]', pdf_rate_limit_proof: '[redacted]', snapshotId: 'report-id' })
  })
})
