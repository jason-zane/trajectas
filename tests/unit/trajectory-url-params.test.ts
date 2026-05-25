import { describe, expect, it } from 'vitest'
import {
  decodeTrajectoryParams,
  defaultUrlState,
  encodeTrajectoryParams,
  encodeTrajectoryParamsAsQuery,
  type TrajectoryUrlState,
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

  it('parses viewLevel=factor; everything else is dimension', () => {
    expect(decodeTrajectoryParams(new URLSearchParams('level=factor')).viewLevel).toBe('factor')
    expect(decodeTrajectoryParams(new URLSearchParams('level=dimension')).viewLevel).toBe('dimension')
    expect(decodeTrajectoryParams(new URLSearchParams('level=construct')).viewLevel).toBe('dimension')
    expect(decodeTrajectoryParams(new URLSearchParams('')).viewLevel).toBe('dimension')
  })

  it('parses parentFilter', () => {
    expect(decodeTrajectoryParams(new URLSearchParams('parent=dim123')).parentFilter).toBe('dim123')
    expect(decodeTrajectoryParams(new URLSearchParams('')).parentFilter).toBeNull()
    expect(decodeTrajectoryParams(new URLSearchParams('parent=')).parentFilter).toBeNull()
  })

  it('parses selectedEntityIds', () => {
    expect(
      decodeTrajectoryParams(new URLSearchParams('selected=a,b,c')).selectedEntityIds,
    ).toEqual(['a', 'b', 'c'])
    expect(decodeTrajectoryParams(new URLSearchParams('')).selectedEntityIds).toBeNull()
  })
})

describe('encodeTrajectoryParams', () => {
  it('omits all defaults', () => {
    const out = encodeTrajectoryParams(defaultUrlState())
    expect(out.toString()).toBe('')
  })

  it('encodes drill, mode=change, matrix=1, assessments', () => {
    const out = encodeTrajectoryParams({
      ...defaultUrlState(),
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

  it('encodes viewLevel=factor + parent + selected', () => {
    const out = encodeTrajectoryParams({
      ...defaultUrlState(),
      viewLevel: 'factor',
      parentFilter: 'dim1',
      selectedEntityIds: ['f1', 'f2'],
    })
    const s = out.toString()
    expect(s).toContain('level=factor')
    expect(s).toContain('parent=dim1')
    expect(s).toContain('selected=f1%2Cf2')
  })

  it('roundtrips a non-default state through decode→encode→decode', () => {
    const state: TrajectoryUrlState = {
      viewLevel: 'factor',
      parentFilter: 'pinkbrain',
      selectedEntityIds: ['cap1', 'cap2'],
      drillEntityIds: ['x', 'y'],
      mode: 'change',
      matrix: true,
      assessmentIds: ['z'],
    }
    const re = decodeTrajectoryParams(encodeTrajectoryParams(state))
    expect(re).toEqual(state)
  })

  it('omits empty selectedEntityIds (treated equivalently to null)', () => {
    const out = encodeTrajectoryParams({
      ...defaultUrlState(),
      selectedEntityIds: [],
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
        ...defaultUrlState(),
        drillEntityIds: ['a'],
      }),
    ).toBe('?drill=a')
  })
})
