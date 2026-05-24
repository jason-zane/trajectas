import { describe, expect, it } from 'vitest'
import {
  decodeTrajectoryParams,
  defaultUrlState,
  encodeTrajectoryParams,
  encodeTrajectoryParamsAsQuery,
} from '@/lib/trajectory/url-params'

describe('decodeTrajectoryParams', () => {
  it('returns defaults for an empty params bag', () => {
    const s = decodeTrajectoryParams(new URLSearchParams())
    expect(s).toEqual(defaultUrlState())
  })

  it('parses a drill chain in order', () => {
    const s = decodeTrajectoryParams(new URLSearchParams('drill=dim1,fac2,con3'))
    expect(s.drillEntityIds).toEqual(['dim1', 'fac2', 'con3'])
  })

  it('treats only mode=change as non-default; anything else is absolute', () => {
    expect(decodeTrajectoryParams(new URLSearchParams('mode=change')).mode).toBe('change')
    expect(decodeTrajectoryParams(new URLSearchParams('mode=absolute')).mode).toBe('absolute')
    expect(decodeTrajectoryParams(new URLSearchParams('mode=bogus')).mode).toBe('absolute')
  })

  it('treats matrix=1 as true; everything else as false', () => {
    expect(decodeTrajectoryParams(new URLSearchParams('matrix=1')).matrix).toBe(true)
    expect(decodeTrajectoryParams(new URLSearchParams('matrix=0')).matrix).toBe(false)
    expect(decodeTrajectoryParams(new URLSearchParams('matrix=true')).matrix).toBe(false)
  })

  it('null assessmentIds when absent; array when present', () => {
    expect(decodeTrajectoryParams(new URLSearchParams('')).assessmentIds).toBeNull()
    expect(
      decodeTrajectoryParams(new URLSearchParams('assessments=a1,a2')).assessmentIds,
    ).toEqual(['a1', 'a2'])
  })

  it('drops empty segments in comma-separated lists', () => {
    expect(
      decodeTrajectoryParams(new URLSearchParams('drill=a,,b,')).drillEntityIds,
    ).toEqual(['a', 'b'])
  })
})

describe('encodeTrajectoryParams', () => {
  it('omits all defaults', () => {
    const out = encodeTrajectoryParams(defaultUrlState())
    expect(out.toString()).toBe('')
  })

  it('encodes drill, mode=change, matrix=1, assessments', () => {
    const out = encodeTrajectoryParams({
      drillEntityIds: ['d1', 'f1'],
      mode: 'change',
      matrix: true,
      assessmentIds: ['a1', 'a2'],
    })
    const s = out.toString()
    expect(s).toContain('drill=d1%2Cf1')
    expect(s).toContain('mode=change')
    expect(s).toContain('matrix=1')
    expect(s).toContain('assessments=a1%2Ca2')
  })

  it('roundtrips a non-default state through decode→encode→decode', () => {
    const state = {
      drillEntityIds: ['x', 'y'],
      mode: 'change' as const,
      matrix: true,
      assessmentIds: ['z'],
    }
    const re = decodeTrajectoryParams(encodeTrajectoryParams(state))
    expect(re).toEqual(state)
  })

  it('omits empty assessmentIds (treated equivalently to null)', () => {
    const out = encodeTrajectoryParams({
      drillEntityIds: [],
      mode: 'absolute',
      matrix: false,
      assessmentIds: [],
    })
    expect(out.toString()).toBe('')
  })
})

describe('encodeTrajectoryParamsAsQuery', () => {
  it('returns empty string for defaults', () => {
    expect(encodeTrajectoryParamsAsQuery(defaultUrlState())).toBe('')
  })

  it('prefixes ? when non-empty', () => {
    expect(
      encodeTrajectoryParamsAsQuery({
        drillEntityIds: ['a'],
        mode: 'absolute',
        matrix: false,
        assessmentIds: null,
      }),
    ).toBe('?drill=a')
  })
})
