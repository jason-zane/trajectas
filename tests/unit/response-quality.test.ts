import { describe, expect, it } from 'vitest'
import { analyseResponseQuality } from '@/lib/scoring/response-quality'
import { QUALITY_MODULE_VERSION, QUALITY_QUESTIONS } from '@/lib/instrument/ipip-neo-120/response-quality'
import { readFileSync } from 'node:fs'

const core = () => Array.from({ length: 120 }, (_, i) => ({ value: i % 5 + 1, timeMs: 3000 as number | null }))
const supplement = () => ({ version: QUALITY_MODULE_VERSION, answers: Object.fromEntries(QUALITY_QUESTIONS.map(q => [q.id, q.id === 'attention_agree' ? 4 : q.id === 'attention_disagree' ? 1 : 2])) })

describe('pilot response-quality policy', () => {
  it('detects no concerns only when all five checks have usable evidence', () => {
    const result = analyseResponseQuality(core(), supplement())
    expect(result.status).toBe('no_concerns_detected')
    expect(result.provisional).toBe(true)
    expect(result.indicators.every(i => i.status === 'clear')).toBe(true)
  })
  it('never treats missing or partly answered checks as passed', () => {
    for (const input of [null, { version: QUALITY_MODULE_VERSION, answers: {} }]) {
      const result = analyseResponseQuality(core(), input)
      expect(result.status).toBe('insufficient_information')
      expect(result.indicators.slice(0, 3).every(i => i.status === 'unavailable')).toBe(true)
    }
    const s = supplement(); delete s.answers.presentation_lie
    expect(analyseResponseQuality(core(), s).indicators.find(i => i.id === 'presentation')?.status).toBe('unavailable')
  })
  it.each([['attention_agree', 3, 'attention'], ['attention_disagree', 2, 'attention'], ['infrequency_sleep', 4, 'infrequency'], ['infrequency_languages', 5, 'infrequency']] as const)('records a specific review cue for %s', (key, value, id) => {
    const s = supplement(); s.answers[key] = value
    const result = analyseResponseQuality(core(), s)
    expect(result.status).toBe('review_recommended')
    expect(result.indicators.find(i => i.id === id)).toMatchObject({ status: 'flagged', observed: 1, denominator: 2 })
  })
  it('requires all four strongest idealised endorsements; it never returns a dishonesty verdict', () => {
    const s = supplement()
    for (const q of QUALITY_QUESTIONS.filter(q => q.id.startsWith('presentation_'))) s.answers[q.id] = 4
    expect(analyseResponseQuality(core(), s).indicators[2].status).toBe('clear')
    for (const q of QUALITY_QUESTIONS.filter(q => q.id.startsWith('presentation_'))) s.answers[q.id] = 5
    const result = analyseResponseQuality(core(), s)
    expect(result.indicators[2]).toMatchObject({ status: 'flagged', observed: 4 })
    expect(result.indicators[2].detail).toContain('not evidence of dishonesty')
  })
  it('uses a conservative raw-answer run threshold with the canonical sequence', () => {
    const responses = core()
    for (let i = 0; i < 19; i++) responses[i].value = 1
    expect(analyseResponseQuality(responses, supplement()).indicators[3].status).toBe('clear')
    responses[19].value = 1
    expect(analyseResponseQuality(responses, supplement()).indicators[3]).toMatchObject({ status: 'flagged', observed: 21 })
  })
  it('requires 100 positive finite timings and more than half below one second', () => {
    const responses = core()
    responses.forEach((r, i) => { r.timeMs = i < 50 ? 999 : i < 100 ? 1000 : null })
    expect(analyseResponseQuality(responses, supplement()).indicators[4]).toMatchObject({ status: 'clear', observed: 50, denominator: 100 })
    responses[50].timeMs = 999
    expect(analyseResponseQuality(responses, supplement()).indicators[4].status).toBe('flagged')
    responses[99].timeMs = 0
    expect(analyseResponseQuality(responses, supplement()).indicators[4]).toMatchObject({ status: 'unavailable', observed: null, denominator: 99 })
  })
  it('rejects incomplete/invalid native answers and unsupported supplement versions', () => {
    expect(() => analyseResponseQuality(core().slice(1), supplement())).toThrow('complete')
    const responses = core(); responses[0].value = 1.5
    expect(() => analyseResponseQuality(responses, supplement())).toThrow('complete')
    expect(() => analyseResponseQuality(core(), { ...supplement(), version: 'future' })).toThrow('Unsupported')
  })
  it('does not mutate native answers or generate any trait, percentile or validity score', () => {
    const responses = core(), s = supplement(), before = JSON.stringify([responses, s])
    const result = analyseResponseQuality(responses, s)
    expect(JSON.stringify([responses, s])).toBe(before)
    expect(Object.keys(result).sort()).toEqual(['indicators','moduleVersion','policyVersion','provisional','status'].sort())
  })
  it('keeps the immutable SQL delivery snapshot identical to the supported question definition', () => {
    const sql = readFileSync('supabase/migrations/20261029233035_ipip_response_quality.sql', 'utf8')
    const snapshot = sql.match(/\$questions\$([\s\S]+?)\$questions\$/)![1]
    expect(JSON.parse(snapshot)).toEqual(QUALITY_QUESTIONS)
  })
})
