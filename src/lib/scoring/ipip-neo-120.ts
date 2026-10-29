import 'server-only'

import {
  IPIP_DOMAINS, IPIP_FACETS, IPIP_FORM, IPIP_FORM_VERSION, IPIP_ID,
  IPIP_ITEMS, IPIP_ITEMSET_SHA256, IPIP_PRESENTATION_VERSION, IPIP_PRIMARY_METRIC, IPIP_SCORING_VERSION,
  assertIpipNeo120Form,
  type IpipDomainCode, type IpipFacetCode, type IpipForm,
} from '@/lib/instrument/ipip-neo-120/definition'

export type IpipResponse = Readonly<{ itemId: string; value: unknown }>
export type IpipScaleStatistics = Readonly<{
  rawSum: number
  itemMean: number
  pomp: number
  itemsUsed: number
}>
export type IpipScaleResult = Readonly<{
  scientificName: string
  displayName: string
  direction: 'original' | 'reversed'
  native: IpipScaleStatistics
  display: IpipScaleStatistics
}>
export type IpipNeo120Result = Readonly<{
  instrumentId: string
  formVersion: string
  scoringVersion: string
  presentationVersion: string
  itemsetSha256: string
  responseCount: 120
  primaryMetric: 'pomp'
  facets: Readonly<Record<IpipFacetCode, IpipScaleResult>>
  dimensions: Readonly<Record<IpipDomainCode, IpipScaleResult>>
  overallScore: null
  normReference: null
}>

function statistics(rawSum: number, itemsUsed: number): IpipScaleStatistics {
  return Object.freeze({
    rawSum, itemsUsed,
    itemMean: rawSum / itemsUsed,
    pomp: 100 * (rawSum - itemsUsed) / (4 * itemsUsed),
  })
}

/**
 * Published native scoring, with separately versioned presentation.
 * No database writes, normative interpretation, imputation or overall score.
 * This core is deliberately not registered in session dispatch until the
 * UUID/form adapter, persistence and result surfaces have acceptance evidence.
 */
export function scoreIpipNeo120(
  responses: readonly IpipResponse[],
  form: IpipForm = IPIP_FORM,
): IpipNeo120Result {
  assertIpipNeo120Form(form)
  if (!Array.isArray(responses) || responses.length !== 120) {
    throw new Error('Exactly 120 IPIP-NEO-120 responses are required')
  }
  const expected = new Set(IPIP_ITEMS.map(item => item.itemId))
  const answers = new Map<string, number>()
  for (const response of responses) {
    if (!response || !expected.has(response.itemId)) throw new Error('Unknown IPIP-NEO-120 response item')
    if (answers.has(response.itemId)) throw new Error(`Duplicate IPIP-NEO-120 response: ${response.itemId}`)
    const value = response.value
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
      throw new Error(`IPIP-NEO-120 response ${response.itemId} must be an integer from 1 to 5`)
    }
    answers.set(response.itemId, value)
  }

  const totals = new Map<IpipFacetCode, number>(IPIP_FACETS.map(facet => [facet.code, 0]))
  for (const item of IPIP_ITEMS) {
    // Membership, uniqueness and cardinality above guarantee every item exists.
    const response = answers.get(item.itemId)!
    const effective = item.reverseScored ? 6 - response : response
    totals.set(item.facetCode, totals.get(item.facetCode)! + effective)
  }

  const facets = Object.fromEntries(IPIP_FACETS.map(facet => {
    const native = statistics(totals.get(facet.code)!, 4)
    // Four items, each 1–5: the inverse sum is 24 − native sum.
    const display = facet.reverseDisplay ? statistics(24 - native.rawSum, 4) : native
    return [facet.code, Object.freeze({
      scientificName: facet.scientificName,
      displayName: facet.displayName,
      direction: facet.reverseDisplay ? 'reversed' as const : 'original' as const,
      native, display,
    })]
  })) as Record<IpipFacetCode, IpipScaleResult>

  const dimensions = Object.fromEntries(IPIP_DOMAINS.map(domain => {
    // Aggregate original facet scores once. Display reversals never enter this sum.
    const raw = IPIP_FACETS.filter(facet => facet.domainCode === domain.code)
      .reduce((total, facet) => total + facets[facet.code].native.rawSum, 0)
    const native = statistics(raw, 24)
    return [domain.code, Object.freeze({
      scientificName: domain.scientificName,
      displayName: domain.displayName,
      direction: 'original' as const,
      native, display: native,
    })]
  })) as Record<IpipDomainCode, IpipScaleResult>

  return Object.freeze({
    instrumentId: IPIP_ID,
    formVersion: IPIP_FORM_VERSION,
    scoringVersion: IPIP_SCORING_VERSION,
    presentationVersion: IPIP_PRESENTATION_VERSION,
    itemsetSha256: IPIP_ITEMSET_SHA256,
    responseCount: 120,
    primaryMetric: IPIP_PRIMARY_METRIC,
    facets: Object.freeze(facets),
    dimensions: Object.freeze(dimensions),
    overallScore: null,
    normReference: null,
  })
}
