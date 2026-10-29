import 'server-only'

import manifest from './source/manifest.json'
import presentation from './presentation.json'

export type IpipDomainCode = 'N' | 'E' | 'O' | 'A' | 'C'
export type IpipFacetCode = `${IpipDomainCode}${1 | 2 | 3 | 4 | 5 | 6}`
export type IpipItem = Readonly<{
  itemId: string
  itemNumber: number
  original300ItemNumber: number
  stem: string
  facetCode: IpipFacetCode
  reverseScored: boolean
  displayOrder: number
}>

export const IPIP_ID = manifest.instrumentId
export const IPIP_FORM_VERSION = manifest.formVersion
export const IPIP_SCORING_VERSION = manifest.scoringVersion
export const IPIP_ITEMSET_SHA256 = manifest.itemsetSha256
export const IPIP_PRESENTATION_VERSION = presentation.version
const primaryMetric = presentation.primaryMetric
if (primaryMetric !== 'pomp') throw new Error('The approved IPIP primary metric is POMP')
export const IPIP_PRIMARY_METRIC = primaryMetric

function displayName(code: string, scientificName: string): string {
  const names: Readonly<Record<string, string>> = presentation.displayNames
  return names[code] ?? scientificName
}

export const IPIP_DOMAINS = Object.freeze(manifest.dimensions.map(domain => Object.freeze({
  code: domain.code as IpipDomainCode,
  scientificName: domain.name,
  displayName: displayName(domain.code, domain.name),
  slug: domain.slug,
})))

export const IPIP_FACETS = Object.freeze(manifest.facets.map(facet => Object.freeze({
  code: facet.code as IpipFacetCode,
  domainCode: facet.code[0] as IpipDomainCode,
  scientificName: facet.name,
  displayName: displayName(facet.code, facet.name),
  constructSlug: facet.constructSlug,
  factorSlug: facet.factorSlug,
  reverseDisplay: presentation.reversedDisplayFacets.includes(facet.code),
})))

export const IPIP_ITEMS: readonly IpipItem[] = Object.freeze(manifest.items.map(item => Object.freeze({
  itemId: item.itemId,
  itemNumber: item.itemNumber,
  original300ItemNumber: item.original300ItemNumber,
  stem: item.stem,
  facetCode: item.facetCode as IpipFacetCode,
  reverseScored: item.reverseScored,
  displayOrder: item.displayOrder,
})))

export type IpipForm = Readonly<{
  formVersion: string
  itemsetSha256: string
  items: readonly IpipItem[]
}>

export const IPIP_FORM: IpipForm = Object.freeze({
  formVersion: IPIP_FORM_VERSION,
  itemsetSha256: IPIP_ITEMSET_SHA256,
  items: IPIP_ITEMS,
})

/** The database adapter resolves canonical UUIDs to these stable IDs. */
export function assertIpipNeo120Form(form: IpipForm): void {
  if (form.formVersion !== IPIP_FORM_VERSION || form.itemsetSha256 !== IPIP_ITEMSET_SHA256) {
    throw new Error('IPIP-NEO-120 form version or source itemset does not match')
  }
  if (!Array.isArray(form.items) || form.items.length !== 120) {
    throw new Error('IPIP-NEO-120 requires the complete ordered 120-item form')
  }
  for (const [index, expected] of IPIP_ITEMS.entries()) {
    const actual = form.items[index]
    if (!actual || Object.keys(expected).some(key => actual[key as keyof IpipItem] !== expected[key as keyof IpipItem])) {
      throw new Error(`IPIP-NEO-120 form item ${index + 1} has changed`)
    }
  }
}

/** Pure selection validation; database delivery also rejects facet subsets. */
export function assertIpipNeo120Selection(
  facetCodes: readonly string[] | null,
  itemsPerConstruct: number | null,
): void {
  if (itemsPerConstruct !== null && itemsPerConstruct !== 4) {
    throw new Error('IPIP-NEO-120 requires exactly four items in every facet')
  }
  if (facetCodes !== null) {
    const selected = new Set(facetCodes)
    if (facetCodes.length !== 30 || selected.size !== 30 || IPIP_FACETS.some(facet => !selected.has(facet.code))) {
      throw new Error('IPIP-NEO-120 facets cannot be omitted, duplicated or replaced')
    }
  }
}
