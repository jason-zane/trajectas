import { expect, it } from 'vitest'
import { IPIP_ITEMS } from '@/lib/instrument/ipip-neo-120/definition'
import { firstPersonPersonalityStem } from '@/lib/instrument/ipip-neo-120/administration'

it('completes all 120 fragments without altering their content or psychometric keys', () => {
  const before = JSON.stringify(IPIP_ITEMS)
  const displayed = IPIP_ITEMS.map(item => firstPersonPersonalityStem(item.stem))
  expect(displayed).toHaveLength(120)
  for (const [index, text] of displayed.entries()) {
    expect(text.startsWith('I ')).toBe(true)
    expect(text.slice(2).toLowerCase()).toBe(IPIP_ITEMS[index].stem.toLowerCase())
  }
  expect(displayed[0]).toBe('I worry about things.')
  expect(displayed[16]).toBe('I am always busy.')
  expect(displayed[102]).toBe("I don't understand people who get emotional.")
  expect(JSON.stringify(IPIP_ITEMS)).toBe(before)
})
