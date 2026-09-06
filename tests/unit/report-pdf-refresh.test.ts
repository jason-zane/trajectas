import { describe, expect, it } from 'vitest'
import { parseReportPdfRefreshTargets } from '@/lib/reports/pdf-refresh'

describe('report PDF refresh targets', () => {
  it('returns no targets when the production refresh is not configured', () => {
    expect(parseReportPdfRefreshTargets('')).toEqual([])
  })

  it('parses exact snapshot and source-PDF pairs', () => {
    expect(parseReportPdfRefreshTargets(JSON.stringify([
      { snapshotId: 'snapshot-1', sourcePdfUrl: 'reports/snapshot-1/old.pdf' },
    ]))).toEqual([
      { snapshotId: 'snapshot-1', sourcePdfUrl: 'reports/snapshot-1/old.pdf' },
    ])
  })

  it('rejects malformed and duplicate targets', () => {
    expect(() => parseReportPdfRefreshTargets('not-json')).toThrow('valid JSON')
    expect(() => parseReportPdfRefreshTargets(JSON.stringify([
      { snapshotId: 'snapshot-1', sourcePdfUrl: 'reports/one.pdf' },
      { snapshotId: 'snapshot-1', sourcePdfUrl: 'reports/two.pdf' },
    ]))).toThrow('duplicate snapshot IDs')
  })
})
