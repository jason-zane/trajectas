import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { LIKERT_VERSION, parseLikertFormat, assertLikertMeasure, assertLikertScopeBudget, type LikertCandidate, type LikertSpec, type ItemReview, type ReviewerResult, type ItemQuality } from '@/lib/instrument/likert/contracts'
import { assessItem, blindReviewBatch, parseBlindReview, parseReview, reviewPrompt, selectItems, selectWithOverlapHints } from '@/lib/instrument/likert/review'
import { fingerprint, itemFingerprint, currentQuality, passingScores } from '@/lib/instrument/likert/identity'
import { auditCoverage } from '@/lib/instrument/blueprint'
import { parseGeneratedItems } from '@/lib/instrument/item-generation'
import { parseFairnessResponse } from '@/lib/instrument/fairness'
import { mapInstrumentBlueprintCellRow } from '@/lib/dal/instrument-mappers'
import { resolveCurrentEvidence } from '@/lib/instrument/evidence'

const format = parseLikertFormat({ id: randomUUID(), name: 'Agreement', type: 'likert', is_active: true, config: { points: 5, anchorType: 'agreement', anchors: { 1: 'Strongly disagree', 2: 'Disagree', 3: 'Neutral', 4: 'Agree', 5: 'Strongly agree' } } })
const cells = ['Planning', 'Follow-through'].map((facetLabel, i) => ({ id: `cell-${i}`, facetLabel, facetDefinition: `Specific ${facetLabel} actions within agreed commitments.`, intensity: 'mid' as const, targetItemCount: 2, displayOrder: i }))
const spec: LikertSpec = { version: LIKERT_VERSION, measureType: 'trait', brief: 'Work commitments', audience: { level: 'entry' }, useContext: 'development', timeframe: 'Past three months', readingCeiling: 8, itemsPerConstruct: 4, reverseProportion: 0.25, scoreDirection: 'More means more dependability', format, constructs: [{ id: 'construct-1', name: 'Dependability', definition: 'Following through on agreed commitments.', exclusions: ['Sociability'], cells }] }
const candidate = (id = 'item-1', cell = 'cell-0', reversed = false): LikertCandidate => ({ id, stem: 'I finish work by the date I agreed to.', blueprintCellId: cell, reverseScored: reversed, status: 'candidate', updatedAt: new Date().toISOString() })
const review = (patch: Partial<ItemReview> = {}): ItemReview => ({ id: 'item-1', constructId: 'construct-1', facetLabel: 'Planning', relevance: 4, clarity: 4, reverseScored: false, lowTypicalHigh: [1, 3, 5], paraphrase: 'I recall whether I finish work on time.', issues: [], rationale: 'Completing commitments is central to dependability.', ...patch })
const panels = (reviews = [review(), review(), review()]): ReviewerResult[] => reviews.map((item, i) => ({ model: ['anthropic/a', 'minimax/b', 'deepseek/c'][i], items: [item] }))

describe('Likert review gates', () => {
  it('accepts a complete, consistent blind panel', () => expect(assessItem(candidate(), spec, panels()).pass).toBe(true))
  it('rejects missing reviewers even if the remaining ratings are excellent', () => expect(assessItem(candidate(), spec, panels().slice(0, 2)).pass).toBe(false))
  it('rejects three samples from the same provider family', () => expect(assessItem(candidate(), spec, panels().map(p => ({ ...p, model: 'anthropic/a' }))).pass).toBe(false))
  it('rejects a majority assignment to the wrong construct despite high relevance', () => expect(assessItem(candidate(), spec, panels([review({ constructId: 'none' }), review({ constructId: 'none' }), review()])).pass).toBe(false))
  it('corrects a wrong key only after all three independently agree', () => {
    const results = panels([0, 1, 2].map(() => review({ reverseScored: true, lowTypicalHigh: [5, 3, 1] })))
    expect(assessItem(candidate(), spec, results)).toMatchObject({ pass: true, key: true, correctedKey: true })
  })
  it('fails polarity disagreement and inverted hypothetical responses', () => {
    expect(assessItem(candidate(), spec, panels([review({ reverseScored: true }), review(), review()])).pass).toBe(false)
    expect(assessItem(candidate(), spec, panels([review({ lowTypicalHigh: [5, 3, 1] }), review(), review()])).pass).toBe(false)
  })
  it('fails unresolved major fairness concerns from even one reviewer', () => expect(assessItem(candidate(), spec, panels([review({ issues: [{ code: 'opportunity', severity: 'major', evidence: 'no children', fix: 'Remove family status and measure commitment directly.' }] }), review(), review()])).pass).toBe(false))
  it('does not show keys, intended assignment or prior feedback in a blind prompt', () => {
    const prompt = reviewPrompt(spec, [{ ...candidate(), stem: 'A unique test stem' }], 0)
    const itemPayload = prompt.split('ITEMS: ')[1].split('\nFor each item')[0]
    expect(JSON.parse(itemPayload)).toEqual([{ id: 'item-1', stem: 'A unique test stem' }])
  })
  it.each([{ items: [] }, { items: [review(), review()] }, { items: [review({ id: 'alien' })] }])('rejects missing, duplicate and unknown response IDs: %j', ({ items }) => expect(() => parseReview(JSON.stringify({ items }), ['item-1'], spec)).toThrow())
  it('rejects invalid response categories, unknown facets and string keys', () => {
    for (const change of [{ lowTypicalHigh: [0, 3, 5] }, { facetLabel: 'alien' }, { reverseScored: 'false' }]) expect(() => parseReview(JSON.stringify({ items: [{ ...review(), ...change }] }), ['item-1'], spec)).toThrow()
  })
  it('requires all response categories and an explicit anchor family', () => {
    expect(() => parseLikertFormat({ id: 'x', name: 'Partial', type: 'likert', is_active: true, config: { points: 5, anchors: { 1: 'Low', 5: 'High' } } })).toThrow()
    expect(() => assertLikertMeasure('sjt')).toThrow()
    expect(() => assertLikertMeasure('forced_choice')).toThrow()
  })
})

describe('current evidence and final form assembly', () => {
  it('invalidates evidence after wording, key, anchor, definition or timeframe edits', () => {
    const item = candidate()
    const quality: ItemQuality = { version: LIKERT_VERSION, specHash: fingerprint(spec), itemHash: itemFingerprint(item), pass: true, reasons: [], score: 4, readingGrade: 4, reviewedAt: new Date().toISOString(), reviews: panels().map(panel => ({ ...panel.items[0], model: panel.model })), correctedKey: false }
    item.payload = { likertQuality: quality }
    expect(currentQuality(item, spec)).toBe(quality)
    expect(currentQuality({ ...item, stem: 'Changed item' }, spec)).toBeNull()
    expect(currentQuality({ ...item, reverseScored: true }, spec)).toBeNull()
    expect(currentQuality(item, { ...spec, timeframe: 'Last week' })).toBeNull()
    expect(currentQuality(item, { ...spec, format: { ...format, anchors: { ...format.anchors, 3: 'Sometimes' } } })).toBeNull()
    const changed = structuredClone(spec); changed.constructs[0].definition = 'Being friendly'
    expect(currentQuality(item, changed)).toBeNull()
  })
  it('selects exact coverage and reverse quota while excluding redundant pairs', () => {
    const pool = [candidate('a'), candidate('b'), candidate('r', 'cell-0', true), candidate('c', 'cell-1'), candidate('d', 'cell-1'), candidate('e', 'cell-1')]
    const result = selectItems(spec, pool, new Map(pool.map(item => [item.id, 4])), [{ a: 'a', b: 'c' }])
    expect(result.blockers).toEqual([])
    expect(result.selectedIds).toHaveLength(4)
    expect(result.selectedIds).toContain('r')
    expect(result.selectedIds.includes('a') && result.selectedIds.includes('c')).toBe(false)
  })
  it('cannot fill coverage with rejected or unreviewed items, or waive reverse quota', () => {
    const pool = [candidate('a'), candidate('b'), candidate('c', 'cell-1'), candidate('d', 'cell-1')]
    expect(selectItems(spec, pool, new Map(pool.map(item => [item.id, 4])), []).blockers.length).toBeGreaterThan(0)
    expect(auditCoverage(cells, [{ ...candidate(), status: 'rejected' }]).totalActual).toBe(0)
    expect(auditCoverage([], []).isComplete).toBe(false)
  })
  it('preserves operational facet definitions through database mapping', () => expect(mapInstrumentBlueprintCellRow({ id: 'x', facet_label: 'Planning', facet_definition: 'Sets up agreed steps.', intensity: 'mid', target_item_count: 2 })).toMatchObject({ facetDefinition: 'Sets up agreed steps.' }))
  it('does not count malformed generation or incomplete fairness as valid', () => {
    expect(parseGeneratedItems('{"items":[{"stem":{},"reverseScored":false},{"stem":"Missing key"}]}').items).toEqual([])
    expect(parseFairnessResponse('{"items":[{"id":"x"}]}', new Set(['x'])).results).toEqual([])
    expect(parseFairnessResponse('{"items":[{"id":"x","flags":[]}]}', new Set(['x'])).results).toEqual([{ id: 'x', flags: [], note: undefined }])
  })
  it('excludes explicitly superseded empirical evidence', () => expect(resolveCurrentEvidence([{ id: 'x', targetType: 'instrument', targetId: 'b', claim: 'alpha', value: 0.9, evidenceClass: 'empirical', method: 'ctt', producedAt: new Date(), supersededAt: new Date() }])).toEqual([]))
})

import { buildResponseMatrix } from '@/lib/scoring/item-statistics'
import { calculateRawScore } from '@/lib/scoring/ctt/scoring'
it('uses the same 1–5 reverse key in calibration matrices and CTT totals', () => {
  const responses = [{ participantId: 'p', itemId: 'r', value: 1, minValue: 1, maxValue: 5, reverseScored: true }]
  expect(buildResponseMatrix(responses).itemResponses.get('r')).toEqual([5])
  expect(calculateRawScore(responses).rawScore).toBe(5)
})

import { formPairs, parsePairReview, parseFormPairBatch, pairReviewPrompt } from '@/lib/instrument/likert/form-review'
it('enumerates every within-construct pair and rejects a claimed scan without individual results', () => {
  const pool = [candidate('a'), candidate('b'), candidate('c', 'cell-1'), candidate('d', 'cell-1')]
  const pairs = formPairs(spec, pool)
  expect(pairs).toHaveLength(6)
  expect(new Set(pairs.map(pair => pair.id)).size).toBe(6)
  expect(() => parsePairReview(JSON.stringify({ pairs: [{ id: pairs[0].id, redundant: false, reason: 'Different observable behaviours.' }] }), pairs.map(pair => pair.id))).toThrow()
  expect(parsePairReview(JSON.stringify({ pairs: pairs.map(pair => ({ id: pair.id, redundant: false, reason: 'Different observable behaviours.' })) }), pairs.map(pair => pair.id))).toHaveLength(6)
})


it('rejects malformed or forged pass metadata and a persisted key that contradicts its reviewers', () => {
  const item = candidate()
  const quality: ItemQuality = { version: LIKERT_VERSION, specHash: fingerprint(spec), itemHash: itemFingerprint(item), pass: true, reasons: [], score: 4, readingGrade: 4, reviewedAt: new Date().toISOString(), reviews: panels().map(panel => ({ ...panel.items[0], model: panel.model })), correctedKey: false }
  item.payload = { likertQuality: quality }
  expect(passingScores([item], spec).size).toBe(1)
  item.payload = { likertQuality: { ...quality, reviews: undefined } }
  expect(currentQuality(item, spec)).toBeNull()
  expect(passingScores([item], spec).size).toBe(0)
  item.payload = { likertQuality: { ...quality, reviews: quality.reviews.map(review => ({ ...review, reverseScored: true, lowTypicalHigh: [5, 3, 1] })) } }
  expect(passingScores([item], spec).size).toBe(0)
  item.payload = { likertQuality: { ...quality, reviews: quality.reviews.map(review => ({ ...review, clarity: 1 })) } }
  expect(passingScores([item], spec).size).toBe(0)
})


it('rejects a form whose exhaustive pair checks cannot fit the model budget before starting AI work', () => {
  expect(() => assertLikertScopeBudget(2, 10)).not.toThrow()
  expect(() => assertLikertScopeBudget(1, 30)).not.toThrow()
  expect(() => assertLikertScopeBudget(20, 30)).toThrow(/too large/)
})


it('uses broad overlap scans as hints, while confirmed pair defects remain hard exclusions', () => {
  const pool = [candidate('a', 'cell-0', true), candidate('b'), candidate('c', 'cell-1'), candidate('d', 'cell-1')]
  const scores = new Map(pool.map(item => [item.id, 4]))
  const pair = { a: 'a', b: 'c' }
  expect(selectWithOverlapHints(spec, pool, scores, [pair], []).selectedIds).toHaveLength(4)
  expect(selectWithOverlapHints(spec, pool, scores, [], [pair]).blockers.length).toBeGreaterThan(0)
})


it('maps reordered short pair judgments back to the correct item pair and rejects missing aliases', () => {
  const pool = [candidate('a'), candidate('b'), candidate('c', 'cell-1')]
  const pairs = formPairs(spec, pool)
  const prompt = pairReviewPrompt(spec, pairs, pool)
  expect(prompt).toContain('pair-1')
  const judgments = [...pairs].reverse().map((pair, index) => ({ id: `pair-${pairs.length - index}`, redundant: pair.id === 'a:b', reason: 'Specific common content or a meaningful difference.' }))
  const parsed = parseFormPairBatch(JSON.stringify({ pairs: judgments }), pairs)
  expect(parsed.find(result => result.redundant)?.id).toBe('a:b')
  expect(() => parseFormPairBatch(JSON.stringify({ pairs: judgments.slice(1) }), pairs)).toThrow()
})


it('restores short blind-review references exactly even when the response is reordered', () => {
  const batch = blindReviewBatch({ ...spec, constructs: spec.constructs.map(construct => ({ ...construct, id: 'database-blueprint-id' })) }, [candidate('real-a'), candidate('real-b')])
  expect(batch.items).toEqual([{ id: 'item-1', stem: candidate().stem }, { id: 'item-2', stem: candidate().stem }])
  const restored = parseBlindReview(JSON.stringify({ items: [review({ id: 'item-2' }), review({ id: 'item-1' })] }), batch)
  expect(restored.map(item => item.id)).toEqual(['real-b', 'real-a'])
  expect(restored.every(item => item.constructId === 'database-blueprint-id')).toBe(true)
  expect(() => parseBlindReview(JSON.stringify({ items: [review({ id: 'real-a' }), review({ id: 'item-1' })] }), batch)).toThrow()
})
