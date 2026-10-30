import manifest from '@/lib/instrument/ipip-neo-120/source/manifest.json'
const { formVersion: IPIP_FORM_VERSION, itemsetSha256: IPIP_ITEMSET_SHA256, scoringVersion: IPIP_SCORING_VERSION } = manifest
import type { IpipNeo120Result } from '@/lib/scoring/ipip-neo-120'
import type { ReferenceInterpretation } from '@/lib/norms/types'
import { buildPersonalityReportData, PERSONALITY_INSTRUMENT_ID } from './data'
import type { ReportContext } from '../../report-context'

/** Adapts two frozen records. Native POMP is never relabelled as a percentile. */
export function buildReferencedPersonalityReport(ctx: ReportContext) {
  const native: IpipNeo120Result | null | undefined = ctx.personalityResult
  const interpretation: ReferenceInterpretation | null | undefined = ctx.referenceInterpretation
  const ref = interpretation?.reference
  if (!native || !interpretation || !ref || interpretation.schemaVersion !== 'reference-interpretation-v1'
    || !ctx.snapshot.referenceVersionId || ref.id !== ctx.snapshot.referenceVersionId
    || native.instrumentId !== PERSONALITY_INSTRUMENT_ID || native.formVersion !== IPIP_FORM_VERSION
    || native.scoringVersion !== IPIP_SCORING_VERSION || native.itemsetSha256 !== IPIP_ITEMSET_SHA256
    || native.responseCount !== 120 || native.primaryMetric !== 'pomp'
    || ref.methodVersion !== 'weighted-empirical-midrank-v1' || !/^[a-f0-9]{64}$/.test(ref.artifactSha256)
    || !ref.name?.trim() || !ref.version?.trim()) {
    throw new Error('A matching frozen native result and norm reference are required for this report.')
  }
  if (Object.keys(interpretation.scores).length !== 35) throw new Error('The norm interpretation must cover all 35 scales.')
  function adapt(scales: IpipNeo120Result['dimensions'] | IpipNeo120Result['facets']) {
    return Object.fromEntries(Object.entries(scales).map(([code, scale]) => {
      const rank = interpretation!.scores[code]
      const reversed = code === 'N4' || code === 'N6'
      if (!rank || rank.nativeRawSum !== scale.native.rawSum || rank.displayName !== scale.displayName
        || rank.scientificName !== scale.scientificName || rank.direction !== scale.direction
        || scale.direction !== (reversed ? 'reversed' : 'original')
        || Math.abs(rank.displayPomp - scale.display.pomp) > 1e-8
        || ![rank.nativePercentile, rank.displayPercentile, rank.tiedPercent].every(v => Number.isFinite(v) && v >= 0 && v <= 100)
        || Math.abs(rank.displayPercentile - (reversed ? 100 - rank.nativePercentile : rank.nativePercentile)) > 1e-8) {
        throw new Error(`The frozen norm interpretation does not match the native scale: ${code}`)
      }
      return [code, { ...scale, display: { percentile: rank.displayPercentile } }]
    }))
  }
  const name = [ctx.session.firstName, ctx.session.lastName].filter(Boolean).join(' ')
  const result = buildPersonalityReportData({ instrumentId: native.instrumentId, primaryMetric: 'percentile',
    normReference: { id: ref.id, version: ref.version, method: ref.methodVersion, label: ref.name },
    dimensions: adapt(native.dimensions), facets: adapt(native.facets),
  }, name, ctx.snapshot.created_at, ctx.template.presentationConfig)
  return { ...result, editionNumber: ctx.snapshot.editionNumber ?? 1,
    reference: { ...result.reference, label: ref.name, ageBoundsInclusive: ref.ageBoundsInclusive,
      weighting: ref.weighting, population: ref.provenance.population, artifactSha256: ref.artifactSha256,
      rawN: ref.rawN, effectiveN: ref.effectiveN,
      attribution: typeof ref.provenance.attribution === 'string' ? ref.provenance.attribution : undefined,
      sourceUrl: typeof ref.provenance.sourceUrl === 'string' ? ref.provenance.sourceUrl : undefined,
      intendedUse: typeof ref.provenance.intendedUse === 'string' ? ref.provenance.intendedUse : undefined },
  }
}
