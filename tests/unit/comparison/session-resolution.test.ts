import { describe, it, expect } from 'vitest'
import {
  pickMostRecentCompleted,
  computeAttemptOrdinals,
  computePersonAttemptOrdinals,
  type SessionRow,
} from '@/lib/comparison/session-resolution'

const baseRow: SessionRow = {
  id: '',
  campaign_participant_id: 'cp1',
  assessment_id: 'a1',
  status: 'completed',
  started_at: null,
  completed_at: null,
}

describe('pickMostRecentCompleted', () => {
  it('returns null when no rows match', () => {
    expect(pickMostRecentCompleted([], 'cp1', 'a1')).toBeNull()
  })

  it('returns null when matches exist but none are completed', () => {
    const rows: SessionRow[] = [
      { ...baseRow, id: 's1', status: 'in_progress' },
      { ...baseRow, id: 's2', status: 'invited' },
    ]
    expect(pickMostRecentCompleted(rows, 'cp1', 'a1')).toBeNull()
  })

  it('picks the row with the latest completed_at', () => {
    const rows: SessionRow[] = [
      { ...baseRow, id: 's1', completed_at: '2026-04-01T00:00:00Z' },
      { ...baseRow, id: 's2', completed_at: '2026-04-05T00:00:00Z' },
    ]
    expect(pickMostRecentCompleted(rows, 'cp1', 'a1')?.id).toBe('s2')
  })

  it('breaks completed_at ties using started_at desc', () => {
    const rows: SessionRow[] = [
      { ...baseRow, id: 's1', completed_at: '2026-04-01T00:00:00Z', started_at: '2026-03-30T00:00:00Z' },
      { ...baseRow, id: 's2', completed_at: '2026-04-01T00:00:00Z', started_at: '2026-03-31T00:00:00Z' },
    ]
    expect(pickMostRecentCompleted(rows, 'cp1', 'a1')?.id).toBe('s2')
  })

  it('breaks completed_at + started_at ties using id desc', () => {
    const rows: SessionRow[] = [
      { ...baseRow, id: 'aaa', completed_at: 'x', started_at: 'y' },
      { ...baseRow, id: 'zzz', completed_at: 'x', started_at: 'y' },
    ]
    expect(pickMostRecentCompleted(rows, 'cp1', 'a1')?.id).toBe('zzz')
  })

  it('ignores rows for other participants or assessments', () => {
    const rows: SessionRow[] = [
      { ...baseRow, id: 's-other-cp', campaign_participant_id: 'cp2', completed_at: '2026-04-10T00:00:00Z' },
      { ...baseRow, id: 's-other-a', assessment_id: 'a2', completed_at: '2026-04-10T00:00:00Z' },
      { ...baseRow, id: 's-mine', completed_at: '2026-04-01T00:00:00Z' },
    ]
    expect(pickMostRecentCompleted(rows, 'cp1', 'a1')?.id).toBe('s-mine')
  })
})

describe('computeAttemptOrdinals', () => {
  it('numbers attempts per (cp, assessment) by started_at ascending', () => {
    const rows: SessionRow[] = [
      { ...baseRow, id: 's1', started_at: '2026-04-05T00:00:00Z' },
      { ...baseRow, id: 's2', started_at: '2026-04-01T00:00:00Z' },
      { ...baseRow, id: 's3', started_at: '2026-04-03T00:00:00Z' },
    ]
    const map = computeAttemptOrdinals(rows)
    expect(map.get('cp1:a1:s2')).toBe(1)
    expect(map.get('cp1:a1:s3')).toBe(2)
    expect(map.get('cp1:a1:s1')).toBe(3)
  })

  it('numbers each (cp, assessment) pair independently', () => {
    const rows: SessionRow[] = [
      { ...baseRow, id: 'p1-a1-1', campaign_participant_id: 'p1', assessment_id: 'a1', started_at: '2026-04-01T00:00:00Z' },
      { ...baseRow, id: 'p1-a2-1', campaign_participant_id: 'p1', assessment_id: 'a2', started_at: '2026-04-02T00:00:00Z' },
      { ...baseRow, id: 'p2-a1-1', campaign_participant_id: 'p2', assessment_id: 'a1', started_at: '2026-04-03T00:00:00Z' },
    ]
    const map = computeAttemptOrdinals(rows)
    expect(map.get('p1:a1:p1-a1-1')).toBe(1)
    expect(map.get('p1:a2:p1-a2-1')).toBe(1)
    expect(map.get('p2:a1:p2-a1-1')).toBe(1)
  })
})

describe('computePersonAttemptOrdinals', () => {
  it('continues the attempt sequence across linked campaign participants', () => {
    const rows: SessionRow[] = [
      { ...baseRow, id: 's-wave1', campaign_participant_id: 'cp-w1', started_at: '2025-09-01T00:00:00Z' },
      { ...baseRow, id: 's-wave2', campaign_participant_id: 'cp-w2', started_at: '2026-01-01T00:00:00Z' },
      { ...baseRow, id: 's-wave3', campaign_participant_id: 'cp-w3', started_at: '2026-05-01T00:00:00Z' },
    ]
    const personByCp = new Map([
      ['cp-w1', 'person-1'],
      ['cp-w2', 'person-1'],
      ['cp-w3', 'person-1'],
    ])
    const map = computePersonAttemptOrdinals(rows, personByCp)
    expect(map.get('person-1:a1:s-wave1')).toBe(1)
    expect(map.get('person-1:a1:s-wave2')).toBe(2)
    expect(map.get('person-1:a1:s-wave3')).toBe(3)
  })

  it('keeps different people and assessments in separate sequences', () => {
    const rows: SessionRow[] = [
      { ...baseRow, id: 's1', campaign_participant_id: 'cp-anna', started_at: '2026-04-01T00:00:00Z' },
      { ...baseRow, id: 's2', campaign_participant_id: 'cp-ben', started_at: '2026-04-02T00:00:00Z' },
      { ...baseRow, id: 's3', campaign_participant_id: 'cp-anna', assessment_id: 'a2', started_at: '2026-04-03T00:00:00Z' },
    ]
    const personByCp = new Map([
      ['cp-anna', 'person-anna'],
      ['cp-ben', 'person-ben'],
    ])
    const map = computePersonAttemptOrdinals(rows, personByCp)
    expect(map.get('person-anna:a1:s1')).toBe(1)
    expect(map.get('person-ben:a1:s2')).toBe(1)
    expect(map.get('person-anna:a2:s3')).toBe(1)
  })

  it('falls back to the cp id as the person bucket for unmapped rows', () => {
    const rows: SessionRow[] = [
      { ...baseRow, id: 's-legacy-1', campaign_participant_id: 'cp-legacy', started_at: '2026-04-01T00:00:00Z' },
      { ...baseRow, id: 's-legacy-2', campaign_participant_id: 'cp-legacy', started_at: '2026-04-05T00:00:00Z' },
    ]
    const map = computePersonAttemptOrdinals(rows, new Map())
    expect(map.get('cp-legacy:a1:s-legacy-1')).toBe(1)
    expect(map.get('cp-legacy:a1:s-legacy-2')).toBe(2)
  })
})
