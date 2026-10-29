/** Reproducible, offline preparation only. Never imports or activates records. */
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const source = join(root, 'src/lib/instrument/ipip-neo-120/source')
const output = join(root, 'docs/assessments/ipip-neo-120')
const load = async name => JSON.parse(await readFile(join(source, name), 'utf8'))
const sha256 = value => createHash('sha256').update(value).digest('hex')
const json = value => `${JSON.stringify(value, null, 2)}\n`
const check = process.argv.slice(2)
if (check.some(arg => arg !== '--check') || check.length > 1) throw new Error('Usage: node scripts/instruments/prepare-ipip-neo-120.mjs [--check]')

const integrity = await load('checksums.json')
for (const [name, digest] of Object.entries(integrity.files)) {
  if (sha256(await readFile(join(source, name))) !== digest) throw new Error(`Source checksum mismatch: ${name}`)
}
const manifest = await load('manifest.json')
const items = await load('source-items.json')
const taxonomy = await load('authored-taxonomy.json')
const responseFormat = await load('response-format.json')
const presentation = JSON.parse(await readFile(join(root, 'src/lib/instrument/ipip-neo-120/presentation.json'), 'utf8'))
if (presentation.primaryMetric !== 'pomp') throw new Error('The approved primary metric is POMP')
const expectedHash = '0a1c55b136a3a6021cfaeb210931b61d19f4e0d5ced7787c6daf3228cfdd50e6'
const itemset = items.map(item => ({ facetCode: item.facetCode, itemNumber: item.itemNumber, reverseScored: item.reverseScored, stem: item.stem }))
if (sha256(JSON.stringify(itemset)) !== expectedHash || manifest.itemsetSha256 !== expectedHash) throw new Error('Canonical itemset has changed')
if (manifest.items.length !== 120 || taxonomy.domains.length !== 5 || taxonomy.facets.length !== 30) throw new Error('Incomplete instrument')
for (const [index, item] of manifest.items.entries()) {
  if (item.itemNumber !== index + 1 || item.itemId !== `q${String(index + 1).padStart(3, '0')}` ||
    ['stem', 'facetCode', 'reverseScored', 'original300ItemNumber', 'itemNumber'].some(key => item[key] !== items[index][key])) {
    throw new Error(`Canonical mapping changed at ${index + 1}`)
  }
}
const reversed = new Set(presentation.reversedDisplayFacets)
if ([...reversed].sort().join(',') !== 'N4,N6') throw new Error('Unexpected display orientation')
const labels = new Map()
const dimensions = new Map(manifest.dimensions.map(domain => [domain.code, domain]))
const facets = new Map(manifest.facets.map(facet => [facet.code, facet]))
for (const code of Object.keys(presentation.displayNames)) {
  if (!dimensions.has(code) && !facets.has(code)) throw new Error(`Unknown display label: ${code}`)
}

function describe(node) {
  const name = presentation.displayNames[node.code] ?? node.name
  const inverse = reversed.has(node.code)
  const low = inverse ? node.high : node.low
  const high = inverse ? node.low : node.high
  const canonical = dimensions.get(node.code) ?? facets.get(node.code)
  const definition = presentation.definitions[node.code] ?? node.definition
  labels.set(node.code, { code: node.code, scientificName: node.name, displayName: name, direction: inverse ? 'reversed' : 'original' })
  return {
    name, slug: canonical.slug ?? canonical.constructSlug,
    description: `${node.code} — ${definition}`,
    definition,
    // Import preparation must not make this library content selectable/active.
    is_active: 'false',
    indicators_low: low.join('\n'),
    indicators_mid: 'Expression can vary by context; examine examples of both ends. This text does not define a population-average band.',
    indicators_high: high.join('\n'),
    anchor_low: low[0], anchor_high: high[0],
    strength_commentary: node.context,
    development_suggestion: node.reflection,
    source: manifest.instrumentId,
  }
}

const rows = []
for (const [index, node] of taxonomy.domains.entries()) rows.push({ entity: 'dimension', ...describe(node), display_order: index })
for (const [index, node] of taxonomy.facets.entries()) {
  rows.push({ entity: 'construct', ...describe(node), dimension: dimensions.get(node.code[0]).slug, factor: '', display_order: index })
}
for (const item of manifest.items) {
  rows.push({ entity: 'item', stem: item.stem, purpose: 'construct', construct: item.constructSlug,
    response_format: responseFormat.name,
    reverse_scored: String(item.reverseScored), weight: 1, difficulty: 'medium', status: 'draft',
    display_order: item.displayOrder, source: manifest.instrumentId })
}
const headers = ['entity', 'name', 'slug', 'dimension', 'factor', 'description', 'definition', 'display_order', 'is_active',
  'indicators_low', 'indicators_mid', 'indicators_high', 'anchor_low', 'anchor_high', 'strength_commentary',
  'development_suggestion', 'source', 'stem', 'purpose', 'construct', 'response_format', 'reverse_scored', 'weight', 'difficulty', 'status']
function csv(headers, records) {
  const escape = value => {
    const text = String(value ?? '')
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [headers.join(','), ...records.map(row => headers.map(header => escape(row[header])).join(','))].join('\n') + '\n'
}

const files = {
  'library-bundle.csv': csv(headers, rows),
  'label-map.csv': csv(['code', 'scientificName', 'displayName', 'direction'], [...labels.values()]),
  'source-record.json': json(await load('source-record.json')),
  'response-format.json': json(await load('response-format.json')),
  'manifest.json': json({
    ...manifest,
    preparationVersion: 'trajectas-import-preparation-v2',
    presentationVersion: presentation.version,
    primaryMetric: presentation.primaryMetric,
    primaryScoreLabel: presentation.primaryScoreLabel,
    descriptiveTextProvenance: { ...manifest.descriptiveTextProvenance,
      displayLabels: 'Approved by Jason on 2026-10-29; scientific labels and slugs preserved.',
      direction: 'N4 and N6 reverse for display only. Domain aggregation always uses original native facet scores.',
    },
    dimensions: manifest.dimensions.map(node => ({ ...node, name: labels.get(node.code).displayName, scientificName: node.name })),
    facets: manifest.facets.map(node => ({ ...node, name: labels.get(node.code).displayName, scientificName: node.name, displayDirection: labels.get(node.code).direction })),
    activationReady: false,
    taxonomyActive: false,
    scorerCoreImplemented: true,
    scoringDispatchInstalled: false,
    deliveryGuardsInstalled: false,
    normReference: null,
    prerequisites: [
      'Verify source and response-format records and all namespaced slug collisions in an isolated synthetic environment.',
      'Import inactive library records; verify 5 dimensions, 30 constructs, 30 locked factor mirrors and 120 items.',
      'Install the native scoring profile, UUID-to-stable-ID adapter and immutable versioned result persistence.',
      'Connect exact-form and campaign-selection validation to assembly, activation and submission.',
      'Connect approved display directions to every result/report surface and suppress the overall composite.',
      'Primary result display is POMP; agree the norm reference policy with Jason after verifying the dataset.',
      'Pass synthetic end-to-end acceptance before activation; follow the repository release runbook.',
    ],
  }),
  'assessment-setup.json': json({
    artifactKind: 'Draft specification; not a server-action payload or activation request',
    instrumentId: manifest.instrumentId,
    formVersion: manifest.formVersion,
    itemsetSha256: manifest.itemsetSha256,
    scoringVersion: manifest.scoringVersion,
    presentationVersion: presentation.version,
    primaryMetric: presentation.primaryMetric,
    primaryScoreLabel: presentation.primaryScoreLabel,
    nativeDraftFields: { title: 'IPIP-NEO-120 (Johnson, 2014)', status: 'draft', creationMode: 'manual', formatMode: 'traditional', itemSelectionStrategy: 'fixed', scoringMethod: 'ctt', scoringLevel: 'factor' },
    sourceSlug: manifest.instrumentId,
    responseFormatName: responseFormat.name,
    factorSlugs: manifest.facets.map(facet => facet.factorSlug),
    requiredTotalItems: 120, itemCountPerFacet: 4, weightPerFactor: 1,
    requiredScoringProfile: { proposedName: 'ipip_neo_120_v1', coreImplemented: true, installed: false },
    requiresUuidResolution: true,
    section: { title: 'About you', role: 'scored', itemOrdering: 'fixed', timeLimitSeconds: null,
      instructions: 'Indicate how accurately each statement describes you as you generally are. Use all five response options as appropriate. Answer for yourself rather than how you would like to be. There are no right or wrong answers.',
      itemsInOrder: manifest.items.map(item => item.itemId) },
    reportTemplateIds: [], normReference: null, activationReady: false,
  }),
}
files['checksums.json'] = json(Object.fromEntries(Object.entries(files).map(([name, content]) => [name, sha256(content)])))
if (!check.length) await mkdir(output, { recursive: true })
for (const [name, content] of Object.entries(files)) {
  const path = join(output, name)
  if (check.length) {
    if (await readFile(path, 'utf8') !== content) throw new Error(`Generated file is stale: ${name}`)
  } else await writeFile(path, content)
}
console.log(`${check.length ? 'Verified' : 'Prepared'} ${Object.keys(files).length} artifacts: 155 input rows, 35 scientific scales; activation blocked.`)
