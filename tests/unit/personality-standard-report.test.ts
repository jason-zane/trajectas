import { describe, expect, it } from 'vitest'
import { buildPersonalityPreviewData, buildPersonalityReportData, PERSONALITY_INSTRUMENT_ID } from '@/lib/reports/custom/personality-standard/data'
import { personalityStandardReport } from '@/lib/reports/custom/personality-standard'
import type { ReportContext } from '@/lib/reports/report-context'

function normedInput() {
  const sample = buildPersonalityPreviewData()
  const scale = (s: { name: string; percentile: number }, reversed = false) => ({ displayName: s.name, direction: reversed ? 'reversed' : 'original', display: { percentile: s.percentile } })
  return {
    instrumentId: PERSONALITY_INSTRUMENT_ID, primaryMetric: 'percentile',
    normReference: { id: 'test-reference', version: 'v1', method: 'midrank' },
    dimensions: Object.fromEntries(sample.dimensions.map(d => [d.code, scale(d)])),
    facets: Object.fromEntries(sample.dimensions.flatMap(d => d.facets.map(f => [f.code, scale(f, f.reversed)]))),
  }
}
const adapt = (input: unknown) => buildPersonalityReportData(input, 'Test Person', '2026-10-30T00:00:00Z')

describe('standard personality report input boundary', () => {
  it('refuses the current unnormed result and never substitutes POMP', () => {
    expect(() => adapt({ ...normedInput(), primaryMetric: 'pomp', normReference: null })).toThrow(/percentiles/)
    expect(() => adapt({ ...normedInput(), normReference: null })).toThrow()
    expect(() => personalityStandardReport.buildData({ session: { firstName: 'Test' }, snapshot: { created_at: '2026-10-30' }, scores: { O: 78 } } as unknown as ReportContext)).toThrow(/frozen/)
  })
  it('refuses an ability score or a rank with incomplete norm provenance', () => {
    expect(() => adapt({ ...normedInput(), instrumentId: 'logical-reasoning', primaryMetric: 't_score' })).toThrow(/IPIP/)
    expect(() => adapt({ ...normedInput(), normReference: { id: 'reference', version: '', method: 'midrank' } })).toThrow(/provenance/)
    const missing = normedInput()
    delete (missing.facets.N4.display as { percentile?: number }).percentile
    expect(() => adapt(missing)).toThrow(/percentile/)
  })
  it('retains all 35 explicitly normed display ranks, including reversed traits', () => {
    const input = normedInput(), result = adapt(input)
    expect(result.dimensions.flatMap(d => d.facets)).toHaveLength(30)
    const n = result.dimensions.find(d => d.code === 'N')!
    expect(n.percentile).toBe(24)
    expect(n.facets.find(f => f.code === 'N4')?.percentile).toBe(65)
    expect(n.facets.find(f => f.code === 'N6')?.percentile).toBe(78)
    expect(result.reference).toEqual({ id: 'test-reference', version: 'v1', method: 'midrank', label: 'Peers' })
  })
  it('rejects missing ranks, incomplete profiles and incorrect display orientation', () => {
    const input = normedInput()
    input.facets.N4.direction = 'original'
    expect(() => adapt(input)).toThrow(/direction/)
    input.facets.N4.direction = 'reversed'
    input.facets.N4.display.percentile = Number.NaN
    expect(() => adapt(input)).toThrow(/percentile/)
    delete input.facets.N4
    expect(() => adapt(input)).toThrow(/complete/)
  })
  it('accepts endpoints and rejects out-of-range values', () => {
    const input = normedInput()
    input.facets.O1.display.percentile = 0
    input.facets.O2.display.percentile = 100
    expect(adapt(input).dimensions[0].facets.slice(0, 2).map(f => f.percentile)).toEqual([0, 100])
    input.facets.O2.display.percentile = 101
    expect(() => adapt(input)).toThrow(/invalid/)
  })
})
