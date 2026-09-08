import { describe, expect, it } from 'vitest'
import { parseIntentPlan, parsePlannedDrafts } from '@/lib/instrument/likert/generation'

const intents = [
  { index: 0, focus: 'Completing small agreed tasks', condition: 'No special condition', distinction: 'Follows through on small tasks rather than tracking dates.', reverseScored: false },
  { index: 1, focus: 'Missing agreed due dates', condition: 'A due date was agreed', distinction: 'Covers timing rather than whether a task is eventually completed.', reverseScored: true },
]
const drafts = [
  { intentIndex: 1, stem: 'I missed the due dates I agreed to.', reverseScored: true, rationale: 'Opposite pole of agreed timing.', replacesId: null },
  { intentIndex: 0, stem: 'I finished small tasks I agreed to do.', reverseScored: false, rationale: 'Follows through on small tasks.', replacesId: null },
]
describe('Likert item-intent contracts', () => {
  it('preserves the intended direction and identity when writers reorder output', () => {
    const planned = parseIntentPlan(JSON.stringify({ intents: [...intents].reverse(), coverageBlocker: null }), 2, 1)
    expect(parsePlannedDrafts(JSON.stringify({ items: drafts }), planned.intents, []).items).toEqual(drafts)
  })
  it('rejects missing or repeated plan indices, repeated content and wrong key counts', () => {
    for (const invalid of [[intents[0]], [intents[0], { ...intents[1], index: 0 }], [intents[0], { ...intents[1], focus: intents[0].focus }], intents.map(intent => ({ ...intent, reverseScored: false }))]) {
      expect(() => parseIntentPlan(JSON.stringify({ intents: invalid, coverageBlocker: null }), 2, 1)).toThrow()
    }
  })
  it('accepts honest coverage limits without treating partial plans as complete', () => {
    const coverageBlocker = 'The facet does not support two different manifestations.'
    expect(parseIntentPlan(JSON.stringify({ intents: [], coverageBlocker }), 2, 1).coverageBlocker).toBe(coverageBlocker)
    expect(() => parseIntentPlan(JSON.stringify({ intents, coverageBlocker }), 2, 1)).toThrow()
  })
  it('rejects missing, duplicated or unknown writer intent IDs and swapped keys', () => {
    for (const items of [[drafts[0]], [drafts[0], drafts[0]], [drafts[0], { ...drafts[1], intentIndex: 4 }], drafts.map(item => ({ ...item, reverseScored: !item.reverseScored }))]) {
      expect(() => parsePlannedDrafts(JSON.stringify({ items }), intents, [])).toThrow()
    }
  })
  it('allows repairs only to identified failed sources', () => {
    const items = [{ ...drafts[0], replacesId: 'source-1' }, drafts[1]]
    expect(() => parsePlannedDrafts(JSON.stringify({ items }), intents, [])).toThrow('Unknown repair source')
    expect(parsePlannedDrafts(JSON.stringify({ items }), intents, ['source-1']).items).toEqual(items)
  })
})
