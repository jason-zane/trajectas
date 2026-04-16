import { describe, it, expect, beforeAll } from 'vitest'
import {
  createPreviewPdfToken,
  verifyPreviewPdfToken,
} from '@/lib/reports/preview-pdf-token'

beforeAll(() => {
  process.env.REPORT_PDF_TOKEN_SECRET = 'test-secret-for-unit-tests'
})

describe('preview PDF token', () => {
  it('round-trips for matching templateId + assessmentId', () => {
    const token = createPreviewPdfToken('template-1', 'assess-1')
    expect(verifyPreviewPdfToken(token, 'template-1', 'assess-1')).toBe(true)
  })

  it('rejects mismatched templateId', () => {
    const token = createPreviewPdfToken('template-1', 'assess-1')
    expect(verifyPreviewPdfToken(token, 'template-OTHER', 'assess-1')).toBe(false)
  })

  it('rejects mismatched assessmentId', () => {
    const token = createPreviewPdfToken('template-1', 'assess-1')
    expect(verifyPreviewPdfToken(token, 'template-1', 'assess-OTHER')).toBe(false)
  })

  it('rejects missing token', () => {
    expect(verifyPreviewPdfToken(null, 't', 'a')).toBe(false)
    expect(verifyPreviewPdfToken(undefined, 't', 'a')).toBe(false)
    expect(verifyPreviewPdfToken('', 't', 'a')).toBe(false)
  })

  it('rejects tampered signature', () => {
    const token = createPreviewPdfToken('template-1', 'assess-1')
    const [payload] = token.split('.')
    const tampered = `${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`
    expect(verifyPreviewPdfToken(tampered, 'template-1', 'assess-1')).toBe(false)
  })
})
