import { expect, it } from 'vitest'
import { parseReferenceRefresh } from '@/lib/norms/refresh'

const group = () => ({ id: 'country-australia', label: 'Australia, ages 18–64', rawN: 1200, kishEffectiveN: 1200,
  ageBoundsInclusive: [18, 64], countryLabels: ['Australia'], weighting: 'pooled',
  nativeScoreMass: Object.fromEntries(['N','E','O','A','C'].flatMap(d => [d,...[1,2,3,4,5,6].map(n => d+n)]).map(code => {
    const n = code.length === 1 ? 97 : 17
    return [code, Array(n).fill(1/n)]
  })),
})
it('accepts complete aggregate distributions and strips unrelated fields', () => {
  const input = { ...group(), responses: [{ email: 'should-not-be-retained@example.test' }] }
  expect(parseReferenceRefresh(JSON.stringify(input))).toEqual(group())
})
it.each(['mass', 'scale', 'sample', 'age', 'size'])('rejects invalid %s data before storage', kind => {
  const value = group()
  if (kind === 'mass') value.nativeScoreMass.N[0] = -.5
  if (kind === 'scale') delete value.nativeScoreMass.N1
  if (kind === 'sample') value.kishEffectiveN = 1500
  if (kind === 'age') value.ageBoundsInclusive = [64,18]
  expect(() => parseReferenceRefresh(kind === 'size' ? ' '.repeat(200_001) : JSON.stringify(value))).toThrow()
})
