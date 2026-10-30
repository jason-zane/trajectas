import { expect, it } from 'vitest'
import { interleaveSupplementalItems } from '@/lib/assess/supplemental-sequence'
import { IPIP_ITEMS } from '@/lib/instrument/ipip-neo-120/definition'
import { INTEGRATED_QUALITY_QUESTIONS, INTEGRATED_QUALITY_ANCHORS } from '@/lib/instrument/ipip-neo-120/response-quality'

const native = IPIP_ITEMS.map((item, index) => ({ id: item.itemId, stem: item.stem, displayOrder: index, options: [] }))
it('interleaves eight independent questions without changing any canonical item or its relative order', () => {
  const before = JSON.stringify(native)
  const delivered = interleaveSupplementalItems(native, INTEGRATED_QUALITY_QUESTIONS, INTEGRATED_QUALITY_ANCHORS)
  expect(delivered).toHaveLength(128)
  expect(delivered.filter(item => !item.id.startsWith('supplemental:'))).toEqual(native)
  expect(delivered[12].stem).toContain('Very Accurate')
  expect(delivered[124].stem).toContain('Very Inaccurate')
  expect(delivered.at(-1)).toBe(native.at(-1))
  expect(JSON.stringify(native)).toBe(before)
})
it('supports other native lengths without a hardcoded 120-question offset', () => {
  expect(interleaveSupplementalItems(native.slice(0, 2), [{ id: 'check', stem: 'Check', afterItem: 1 }], ['No', 'Yes']).map(q => q.id)).toEqual([native[0].id, 'supplemental:check', native[1].id])
  expect(() => interleaveSupplementalItems(native, [{ id: 'check', stem: 'Check', afterItem: 121 }], [])).toThrow('Invalid')
})
