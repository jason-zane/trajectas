import { describe, expect, it } from 'vitest'
import { IPIP_ITEMS } from '@/lib/instrument/ipip-neo-120/definition'
import { scoreIpipNeo120 } from '@/lib/scoring/ipip-neo-120'
import { personalityStandardReport } from '@/lib/reports/custom/personality-standard'
import { buildReferencedPersonalityReport } from '@/lib/reports/custom/personality-standard/reference-adapter'
import { parsePersonalityPresentation } from '@/lib/reports/custom/personality-standard/presentation-config'
import type { ReportContext } from '@/lib/reports/report-context'
import type { ReferenceInterpretation } from '@/lib/norms/types'
function context(): ReportContext {
  const native = scoreIpipNeo120(IPIP_ITEMS.map((item, i) => ({ itemId: item.itemId, value: i % 5 + 1 })))
  const comparison: ReferenceInterpretation = { schemaVersion: 'reference-interpretation-v1',
    reference: { id: 'reference-a', name: 'SYNTHETIC A', version: 'synthetic-v1', groupKey: 'synthetic-a', methodVersion: 'weighted-empirical-midrank-v1', artifactSha256: 'a'.repeat(64), rawN: 1000, effectiveN: 900, ageBoundsInclusive: [18,64], countryLabels: null, weighting: 'pooled', provenance: { population: 'Synthetic only' } },
    scores: Object.fromEntries([...Object.entries(native.dimensions), ...Object.entries(native.facets)].map(([code, s]) => [code, { nativeRawSum: s.native.rawSum, displayPomp: s.display.pomp, displayName: s.displayName, scientificName: s.scientificName, direction: s.direction, nativePercentile: 40, displayPercentile: s.direction === 'reversed' ? 60 : 40, tiedPercent: 10 }])),
  }
  return { personalityResult: native, referenceInterpretation: comparison, snapshot: { referenceVersionId: 'reference-a', editionNumber: 2, created_at: '2026-10-30T00:00:00Z' }, session: { firstName: 'Synthetic', lastName: 'Person' }, template: { presentationConfig: {} } } as unknown as ReportContext
}
describe('standard report frozen-reference adapter', () => {
  it('uses the independently normed dimensions and already oriented facet ranks', () => {
    const ctx = context(), saved = structuredClone(ctx.personalityResult)
    const data = buildReferencedPersonalityReport(ctx)
    expect(personalityStandardReport.supportsReferenceComparison).toBe(true)
    expect(data.dimensions).toHaveLength(5)
    expect(data.dimensions.flatMap(d => d.facets)).toHaveLength(30)
    expect(data.dimensions.find(d => d.code === 'N')?.percentile).toBe(40)
    expect(data.dimensions.find(d => d.code === 'N')?.facets.filter(f => f.reversed).map(f => f.percentile)).toEqual([60,60])
    expect(data.reference).toMatchObject({ id: 'reference-a', label: 'SYNTHETIC A', version: 'synthetic-v1' })
    expect(data.editionNumber).toBe(2)
    expect(ctx.personalityResult).toEqual(saved)
  })
  it.each(['missing', 'wrong-reference', 'wrong-form', 'wrong-method', 'wrong-rank', 'wrong-raw', 'wrong-direction', 'missing-scale'])('refuses %s instead of guessing', failure => {
    const ctx = context()
    if (failure === 'missing') ctx.referenceInterpretation = null
    if (failure === 'wrong-reference') ctx.snapshot.referenceVersionId = 'other'
    if (failure === 'wrong-form') ctx.personalityResult = { ...ctx.personalityResult!, itemsetSha256: '0'.repeat(64) }
    if (failure === 'wrong-method') ctx.referenceInterpretation!.reference.methodVersion = 'unknown'
    if (failure === 'wrong-rank') ctx.referenceInterpretation!.scores.N4.displayPercentile = 40
    if (failure === 'wrong-raw') ctx.referenceInterpretation!.scores.N.nativeRawSum += 1
    if (failure === 'wrong-direction') ctx.referenceInterpretation!.scores.N4.direction = 'original'
    if (failure === 'missing-scale') delete ctx.referenceInterpretation!.scores.C6
    expect(() => buildReferencedPersonalityReport(ctx)).toThrow()
  })
  it('freezes edited display copy without changing measurement labels or direction', () => {
    const ctx = context(), native = structuredClone(ctx.personalityResult)
    ctx.template.presentationConfig = { version: 1, coverHeadline: 'Your profile', scales: { N4: { name: 'Edited display label', definition: 'Edited definition' } } }
    const data = buildReferencedPersonalityReport(ctx)
    expect(data.coverHeadline).toBe('Your profile')
    expect(data.dimensions.find(d => d.code === 'N')?.facets.find(f => f.code === 'N4')).toMatchObject({ name: 'Edited display label', definition: 'Edited definition', percentile: 60, reversed: true })
    expect(ctx.personalityResult).toEqual(native)
  })
  it('refuses presentation changes to codes, score direction, unknown scales or oversized copy', () => {
    for (const input of [{ scales: { N4: { reversed: false } } }, { scales: { X: { name: 'Unknown' } } }, { coverHeadline: 'x'.repeat(101) }]) expect(() => parsePersonalityPresentation(input)).toThrow()
  })
})
