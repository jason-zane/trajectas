import { describe, it, expect } from 'vitest'
import {
  buildReportPdfFilename,
  contentDispositionAttachment,
  formatReportMonthYear,
  sanitizeReportFilename,
} from '@/lib/reports/pdf-filename'

describe('buildReportPdfFilename — canonical report PDF naming', () => {
  it('follows "<Assessment> - <Full name> - <Month Year>.pdf"', () => {
    expect(
      buildReportPdfFilename({
        assessmentTitle: 'Leadership Potential Inventory',
        firstName: 'John',
        lastName: 'Smith',
        date: '2026-04-15T10:30:00Z',
      }),
    ).toBe('Leadership Potential Inventory - John Smith - April 2026.pdf')
  })

  it('separates every segment with " - "', () => {
    const name = buildReportPdfFilename({
      assessmentTitle: 'Assessment',
      firstName: 'John',
      lastName: 'Smith',
      date: '2026-04-15T10:30:00Z',
    })
    expect(name).toBe('Assessment - John Smith - April 2026.pdf')
  })

  it('drops the name segment when the candidate name is missing', () => {
    expect(
      buildReportPdfFilename({
        assessmentTitle: 'Assessment',
        date: '2026-04-15T10:30:00Z',
      }),
    ).toBe('Assessment - April 2026.pdf')
  })

  it('handles a first name with no last name', () => {
    expect(
      buildReportPdfFilename({
        assessmentTitle: 'Assessment',
        firstName: 'John',
        date: '2026-04-15T10:30:00Z',
      }),
    ).toBe('Assessment - John - April 2026.pdf')
  })

  it('falls back to "Report" when the assessment title is missing', () => {
    expect(
      buildReportPdfFilename({
        firstName: 'John',
        lastName: 'Smith',
        date: '2026-04-15T10:30:00Z',
      }),
    ).toBe('Report - John Smith - April 2026.pdf')
  })

  it('omits the date when none is available', () => {
    expect(
      buildReportPdfFilename({
        assessmentTitle: 'Assessment',
        firstName: 'John',
        lastName: 'Smith',
      }),
    ).toBe('Assessment - John Smith.pdf')
  })

  it('strips filesystem-illegal characters but keeps it readable', () => {
    const name = buildReportPdfFilename({
      assessmentTitle: 'Sales/Ops: Review*',
      firstName: 'John',
      lastName: 'Smith',
      date: '2026-04-15T10:30:00Z',
    })
    expect(name).not.toMatch(/[/\\:*?"<>|]/)
    expect(name).toContain('John Smith')
    expect(name.endsWith('.pdf')).toBe(true)
  })

  it('preserves accented candidate names', () => {
    expect(
      buildReportPdfFilename({
        assessmentTitle: 'Assessment',
        firstName: 'José',
        lastName: 'Núñez',
        date: '2026-04-15T10:30:00Z',
      }),
    ).toBe('Assessment - José Núñez - April 2026.pdf')
  })

  it('uses the stable id fallback when there is nothing to name the file by', () => {
    expect(buildReportPdfFilename({ fallbackId: 'abc-123' })).toBe('report-abc-123.pdf')
    expect(buildReportPdfFilename({})).toBe('report.pdf')
  })
})

describe('formatReportMonthYear', () => {
  it('formats an ISO timestamp as "Month YYYY" in UTC', () => {
    expect(formatReportMonthYear('2026-04-15T10:30:00Z')).toBe('April 2026')
    expect(formatReportMonthYear('2026-12-01')).toBe('December 2026')
  })

  it('returns empty for missing or unparseable input', () => {
    expect(formatReportMonthYear(null)).toBe('')
    expect(formatReportMonthYear(undefined)).toBe('')
    expect(formatReportMonthYear('not a date')).toBe('')
  })
})

describe('sanitizeReportFilename', () => {
  it('collapses whitespace and trims', () => {
    expect(sanitizeReportFilename('  John   Smith  ')).toBe('John Smith')
  })

  it('removes leading/trailing dots so the extension is well-formed', () => {
    expect(sanitizeReportFilename('...report...')).toBe('report')
  })
})

describe('contentDispositionAttachment', () => {
  it('quotes an ASCII filename and adds an RFC 5987 filename*', () => {
    const header = contentDispositionAttachment('Assessment - John Smith - April 2026.pdf')
    expect(header).toContain('attachment; filename="Assessment - John Smith - April 2026.pdf"')
    expect(header).toContain("filename*=UTF-8''")
  })

  it('strips non-ASCII from the fallback but encodes it in filename*', () => {
    const header = contentDispositionAttachment('Assessment - José Núñez - April 2026.pdf')
    // ASCII fallback has the accents removed...
    expect(header).toContain('filename="Assessment - Jose Nunez - April 2026.pdf"')
    // ...but the UTF-8 form encodes the original.
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent('Assessment - José Núñez - April 2026.pdf')}`)
  })
})
