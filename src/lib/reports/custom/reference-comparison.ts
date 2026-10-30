import type { CustomReport } from './index'
import { ReferenceComparisonReport, type ReferenceComparisonData } from '@/components/reports/custom/reference-comparison'
export const referenceComparisonReport: CustomReport<ReferenceComparisonData> = {
  slug: 'ipip-reference-comparison', label: 'Personality reference comparison',
  description: 'Native scale scores with an optional approved, versioned comparison reference.',
  supportedInstrumentIds: ['ipip-neo-120-johnson-2014'], supportsReferenceComparison: true,
  Component: ReferenceComparisonReport,
  buildData(ctx) {
    const native = ctx.personalityResult
    if (!native) throw new Error('A complete native personality result is required')
    const comparison = ctx.referenceInterpretation ?? null
    if (ctx.snapshot.referenceVersionId && comparison?.reference.id !== ctx.snapshot.referenceVersionId) throw new Error('The frozen reference interpretation is unavailable or inconsistent')
    const scales = [...Object.entries(native.dimensions), ...Object.entries(native.facets)].map(([code, result]) => ({
      code, name: result.displayName, scientificName: result.scientificName,
      nativeRawSum: result.native.rawSum, scaleScore: result.display.pomp,
      referenceRank: comparison?.scores[code]?.displayPercentile ?? null, domain: code[0],
    }))
    if (comparison && scales.some(s => s.referenceRank === null)) throw new Error('The reference interpretation must cover every personality scale')
    return { schemaVersion: 'personality-reference-report-v1', editionNumber: ctx.snapshot.editionNumber ?? 1, scales, reference: comparison?.reference ?? null }
  },
}
