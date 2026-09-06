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
})
