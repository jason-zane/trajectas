import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import Papa from 'papaparse'
import {
  IPIP_DOMAINS, IPIP_FACETS, IPIP_FORM, IPIP_ITEMS, IPIP_ITEMSET_SHA256,
  assertIpipNeo120Form, assertIpipNeo120Selection,
  type IpipDomainCode, type IpipForm,
} from '@/lib/instrument/ipip-neo-120/definition'
import { scoreIpipNeo120, type IpipResponse } from '@/lib/scoring/ipip-neo-120'
import fixtures from '@/lib/instrument/ipip-neo-120/source/scoring-fixtures.json'
import sourceItems from '@/lib/instrument/ipip-neo-120/source/source-items.json'
import taxonomy from '@/lib/instrument/ipip-neo-120/source/authored-taxonomy.json'
import integrity from '@/lib/instrument/ipip-neo-120/source/checksums.json'

const root = resolve(import.meta.dirname, '../..')
const responses = (value: unknown = 3): IpipResponse[] => IPIP_ITEMS.map(item => ({ itemId: item.itemId, value }))
const entries = (values: Record<string, number>) => Object.entries(values).map(([itemId, value]) => ({ itemId, value }))

function readCsv(name: string) {
  const content = readFileSync(resolve(root, 'docs/assessments/ipip-neo-120', name), 'utf8')
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true })
  expect(parsed.errors).toEqual([])
  return parsed.data
}

describe('IPIP-NEO-120 canonical source and approved presentation', () => {
  it('preserves the captured source files and exact versioned itemset hash', () => {
    for (const [name, checksum] of Object.entries(integrity.files)) {
      const bytes = readFileSync(resolve(root, 'src/lib/instrument/ipip-neo-120/source', name))
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(checksum)
    }
    const scientific = sourceItems.map(item => ({ facetCode: item.facetCode, itemNumber: item.itemNumber, reverseScored: item.reverseScored, stem: item.stem }))
    expect(createHash('sha256').update(JSON.stringify(scientific)).digest('hex')).toBe('0a1c55b136a3a6021cfaeb210931b61d19f4e0d5ced7787c6daf3228cfdd50e6')
    expect(IPIP_ITEMSET_SHA256).toBe('0a1c55b136a3a6021cfaeb210931b61d19f4e0d5ced7787c6daf3228cfdd50e6')
    expect(IPIP_ITEMS.filter(item => item.reverseScored)).toHaveLength(55)
    expect(IPIP_ITEMS.map(item => item.stem)).toEqual(sourceItems.map(item => item.stem))
    expect(IPIP_ITEMS[57].stem).toBe('Believe that there is no absolute right or wrong.')
  })

  it('uses all 35 approved labels, with exactly two reversed display facets', () => {
    expect(IPIP_DOMAINS.map(domain => domain.displayName)).toEqual(['Emotional Reactivity', 'Extraversion', 'Openness', 'Agreeableness', 'Conscientiousness'])
    const expected = {
      N: ['Anxiety', 'Irritability', 'Discouragement', 'Social Confidence', 'Indulgence', 'Stress Tolerance'],
      E: ['Friendliness', 'Sociability', 'Assertiveness', 'Activity Level', 'Excitement-Seeking', 'Cheerfulness'],
      O: ['Imagination', 'Artistic Interests', 'Emotional Sensitivity', 'Variety Seeking', 'Intellectual Curiosity', 'Liberalism'],
      A: ['Trust', 'Fairness', 'Helpfulness', 'Cooperation', 'Modesty', 'Compassion'],
      C: ['Perceived Competence', 'Orderliness', 'Dependability', 'Achievement Striving', 'Self-Discipline', 'Deliberation'],
    }
    for (const [code, names] of Object.entries(expected)) expect(IPIP_FACETS.filter(facet => facet.domainCode === code).map(facet => facet.displayName)).toEqual(names)
    expect(IPIP_FACETS.filter(facet => facet.reverseDisplay).map(facet => facet.code)).toEqual(['N4', 'N6'])
    expect(IPIP_FACETS.find(facet => facet.code === 'N4')).toMatchObject({ scientificName: 'Self-Consciousness', constructSlug: 'ipip-neo-120-johnson-2014-n4-self-consciousness' })
    expect(Object.isFrozen(IPIP_ITEMS[0])).toBe(true)
  })

  it('reproduces the checked-in preparation artifacts without writes', () => {
    expect(execFileSync(process.execPath, ['scripts/instruments/prepare-ipip-neo-120.mjs', '--check'], { cwd: root, env: { NODE_ENV: 'test' }, encoding: 'utf8' })).toContain('activation blocked')
  })

  it('prepares every descriptor and preserves item keys, ordering and parent links', () => {
    const rows = readCsv('library-bundle.csv')
    expect(rows).toHaveLength(155)
    const dimensions = rows.filter(row => row.entity === 'dimension')
    const constructs = rows.filter(row => row.entity === 'construct')
    const items = rows.filter(row => row.entity === 'item')
    expect(dimensions).toHaveLength(5)
    expect(constructs).toHaveLength(30)
    expect(items).toHaveLength(120)
    for (const node of [...dimensions, ...constructs]) {
      expect(node.is_active).toBe('false')
      for (const field of ['description', 'definition', 'indicators_low', 'indicators_mid', 'indicators_high', 'anchor_low', 'anchor_high', 'strength_commentary', 'development_suggestion', 'source']) expect(node[field].length).toBeGreaterThan(0)
    }
    for (const facet of IPIP_FACETS) {
      const row = constructs.find(row => row.slug === facet.constructSlug)!
      expect(row.name).toBe(facet.displayName)
      expect(row.factor).toBe('')
      expect(row.dimension).toBe(IPIP_DOMAINS.find(domain => domain.code === facet.domainCode)!.slug)
      expect(items.filter(item => item.construct === facet.constructSlug)).toHaveLength(4)
      const original = taxonomy.facets.find(node => node.code === facet.code)!
      expect(row.indicators_low).toBe((facet.reverseDisplay ? original.high : original.low).join('\n'))
      expect(row.indicators_high).toBe((facet.reverseDisplay ? original.low : original.high).join('\n'))
    }
    for (const [index, item] of items.entries()) {
      expect(item).toMatchObject({ stem: IPIP_ITEMS[index].stem, reverse_scored: String(IPIP_ITEMS[index].reverseScored), display_order: String(index), status: 'draft', weight: '1' })
    }
  })
})

describe('IPIP native scoring and separate display orientation', () => {
  it.each(fixtures)('matches independent domain totals for $id', fixture => {
    const result = scoreIpipNeo120(entries(fixture.responses))
    for (const [code, expected] of Object.entries(fixture.expectedDomainRawSums)) expect(result.dimensions[code as IpipDomainCode].native.rawSum).toBe(expected)
  })

  it('has 35 scientific scores, exact native ranges and no overall or norm claim', () => {
    const result = scoreIpipNeo120(responses())
    expect(Object.keys(result.facets)).toHaveLength(30)
    expect(Object.keys(result.dimensions)).toHaveLength(5)
    for (const facet of Object.values(result.facets)) expect(facet.native).toEqual({ rawSum: 12, itemMean: 3, pomp: 50, itemsUsed: 4 })
    for (const domain of Object.values(result.dimensions)) expect(domain.native).toEqual({ rawSum: 72, itemMean: 3, pomp: 50, itemsUsed: 24 })
    expect(result).toMatchObject({ responseCount: 120, primaryMetric: 'pomp', overallScore: null, normReference: null, formVersion: 'johnson-2014-table1-v1', scoringVersion: 'ipip-neo-120-raw-v1', presentationVersion: 'trajectas-personality-labels-v1' })
    expect(JSON.stringify(result)).not.toMatch(/percentile|sten|populationBand/)
    expect(Object.isFrozen(result.facets.N4.display)).toBe(true)
  })

  it.each([1, 5])('preserves native endpoints for effective item response %i', value => {
    const given = IPIP_ITEMS.map(item => ({ itemId: item.itemId, value: item.reverseScored ? 6 - value : value }))
    const result = scoreIpipNeo120(given)
    for (const facet of IPIP_FACETS) {
      expect(result.facets[facet.code].native.rawSum).toBe(4 * value)
      expect(result.facets[facet.code].display.rawSum).toBe(4 * (facet.reverseDisplay ? 6 - value : value))
    }
    for (const domain of Object.values(result.dimensions)) expect(domain.native.rawSum).toBe(24 * value)
  })

  it.each(IPIP_ITEMS)('scores $itemId by its original key, changing only its facet and domain', item => {
    const given = responses()
    given[item.itemNumber - 1] = { itemId: item.itemId, value: 5 }
    const result = scoreIpipNeo120(given)
    const delta = item.reverseScored ? -2 : 2
    for (const facet of IPIP_FACETS) {
      const expected = 12 + (facet.code === item.facetCode ? delta : 0)
      expect(result.facets[facet.code].native.rawSum).toBe(expected)
      expect(result.facets[facet.code].display.rawSum).toBe(facet.reverseDisplay ? 24 - expected : expected)
    }
    for (const domain of IPIP_DOMAINS) expect(result.dimensions[domain.code].native.rawSum).toBe(72 + (domain.code === item.facetCode[0] ? delta : 0))
  })

  it('reverses both display scales without aggregating them into Emotional Reactivity', () => {
    const result = scoreIpipNeo120(responses(1))
    for (const code of ['N4', 'N6'] as const) {
      expect(result.facets[code]).toMatchObject({ direction: 'reversed', native: { rawSum: 8, itemMean: 2, pomp: 25 }, display: { rawSum: 16, itemMean: 4, pomp: 75 } })
    }
    expect(result.dimensions.N.native.rawSum).toBe(52)
    expect(result.dimensions.N.display.rawSum).toBe(52)
  })

  it('accepts response order independently of fixed presentation order and does not mutate inputs', () => {
    const given = responses().reverse()
    const original = structuredClone(given)
    expect(scoreIpipNeo120(given)).toEqual(scoreIpipNeo120(responses()))
    expect(given).toEqual(original)
  })

  it.each([null, true, false, '3', 3.5, 0, 6, NaN, Infinity, -Infinity])('rejects invalid response %s', value => {
    const given = responses()
    given[0] = { itemId: 'q001', value }
    expect(() => scoreIpipNeo120(given)).toThrow('integer from 1 to 5')
  })

  it('rejects incomplete, extra, unknown and duplicate responses', () => {
    expect(() => scoreIpipNeo120(responses().slice(1))).toThrow('Exactly 120')
    expect(() => scoreIpipNeo120([...responses(), { itemId: 'q121', value: 3 }])).toThrow('Exactly 120')
    const given = responses()
    given[0] = { itemId: 'q121', value: 3 }
    expect(() => scoreIpipNeo120(given)).toThrow('Unknown')
    given[0] = given[1]
    expect(() => scoreIpipNeo120(given)).toThrow('Duplicate')
    expect(() => scoreIpipNeo120(null as unknown as IpipResponse[])).toThrow('Exactly 120')
  })
})

describe('fixed form and selection guards, awaiting delivery integration', () => {
  it('accepts the intact form and unrestricted or complete campaign selection', () => {
    expect(() => assertIpipNeo120Form(IPIP_FORM)).not.toThrow()
    expect(() => assertIpipNeo120Selection(null, null)).not.toThrow()
    expect(() => assertIpipNeo120Selection(IPIP_FACETS.map(facet => facet.code), 4)).not.toThrow()
  })

  it('rejects different versions, itemset hashes, counts and order', () => {
    for (const form of [
      { ...IPIP_FORM, formVersion: 'another-form' },
      { ...IPIP_FORM, itemsetSha256: 'another-hash' },
      { ...IPIP_FORM, items: IPIP_ITEMS.slice(1) },
      { ...IPIP_FORM, items: [...IPIP_ITEMS].reverse() },
    ]) expect(() => scoreIpipNeo120(responses(), form)).toThrow(/form|itemset/)
  })

  it.each(['itemId', 'itemNumber', 'original300ItemNumber', 'stem', 'facetCode', 'reverseScored', 'displayOrder'])('rejects altered form identity field %s', key => {
    const items = structuredClone(IPIP_ITEMS)
    const changed = { ...items[0], [key]: key === 'reverseScored' ? true : 'changed' }
    const form = { ...IPIP_FORM, items: [changed, ...items.slice(1)] } as unknown as IpipForm
    expect(() => scoreIpipNeo120(responses(), form)).toThrow('form item 1 has changed')
  })

  it('rejects facet filtering, substitution, duplicates and changed item caps', () => {
    const all = IPIP_FACETS.map(facet => facet.code)
    expect(() => assertIpipNeo120Selection(all.slice(1), null)).toThrow('cannot be omitted')
    expect(() => assertIpipNeo120Selection([...all.slice(1), all[1]], null)).toThrow('cannot be omitted')
    expect(() => assertIpipNeo120Selection([...all.slice(1), 'X1'], null)).toThrow('cannot be omitted')
    for (const count of [0, 1, 3, 5, 4.5, NaN]) expect(() => assertIpipNeo120Selection(null, count)).toThrow('exactly four')
  })
})
